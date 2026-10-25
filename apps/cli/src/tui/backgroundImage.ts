import * as fs from "fs";
import * as os from "os";
import { PNG } from "pngjs";

// Fraction of the original brightness kept, so text stays readable on top.
const DIM_FACTOR = 0.4;

export interface BackgroundImage {
  width: number;
  height: number;
  /** Dimmed RGBA pixels. */
  data: Buffer;
  /** The dimmed image re-encoded as PNG, for the kitty graphics protocol. */
  png: Buffer;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function expandHome(file: string): string {
  return file === "~" || file.startsWith("~/") ? os.homedir() + file.slice(1) : file;
}

export function loadBackgroundImage(file: string): BackgroundImage {
  let decoded: PNG;
  try {
    decoded = PNG.sync.read(fs.readFileSync(expandHome(file)));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load background image (PNG only): ${reason}`);
  }

  for (let i = 0; i < decoded.data.length; i += 4) {
    decoded.data[i] = Math.round(decoded.data[i]! * DIM_FACTOR);
    decoded.data[i + 1] = Math.round(decoded.data[i + 1]! * DIM_FACTOR);
    decoded.data[i + 2] = Math.round(decoded.data[i + 2]! * DIM_FACTOR);
    decoded.data[i + 3] = 255;
  }

  return { width: decoded.width, height: decoded.height, data: decoded.data, png: PNG.sync.write(decoded) };
}

// Terminal cells are about twice as tall as wide, so a cols x rows area has the
// aspect ratio of a cols x (rows * 2) pixel grid. Crop the image to that ratio
// (centered) so it covers the area without being stretched.
export function coverCrop(imageWidth: number, imageHeight: number, cols: number, rows: number): CropRect {
  const targetAspect = cols / (rows * 2);
  const imageAspect = imageWidth / imageHeight;

  if (imageAspect > targetAspect) {
    const w = Math.round(imageHeight * targetAspect);
    return { x: Math.floor((imageWidth - w) / 2), y: 0, w, h: imageHeight };
  }

  const h = Math.round(imageWidth / targetAspect);
  return { x: 0, y: Math.floor((imageHeight - h) / 2), w: imageWidth, h };
}

// --- Kitty graphics protocol -------------------------------------------------

const ESC = "\x1b";
const KITTY_ID = 7357;
const CHUNK_SIZE = 4096;
const QUERY_ID = 31;

export const KITTY_QUERY = `${ESC}_Gi=${QUERY_ID},s=1,v=1,a=q,t=d,f=24;AAAA${ESC}\\${ESC}[c`;

export function kittyTransmit(png: Buffer): string {
  const base64 = png.toString("base64");
  let out = "";
  for (let offset = 0; offset < base64.length; offset += CHUNK_SIZE) {
    const chunk = base64.slice(offset, offset + CHUNK_SIZE);
    const more = offset + CHUNK_SIZE < base64.length ? 1 : 0;
    const control = offset === 0 ? `a=t,f=100,i=${KITTY_ID},q=2,m=${more}` : `m=${more},q=2`;
    out += `${ESC}_G${control};${chunk}${ESC}\\`;
  }
  return out;
}

// Places (or re-places) the transmitted image at the top-left of the screen,
// z=-1 so the terminal draws it underneath the text cells.
export function kittyPlace(image: { width: number; height: number }, cols: number, rows: number): string {
  const crop = coverCrop(image.width, image.height, cols, rows);
  const control = `a=p,i=${KITTY_ID},p=1,x=${crop.x},y=${crop.y},w=${crop.w},h=${crop.h},c=${cols},r=${rows},z=-1,C=1,q=2`;
  return `${ESC}7${ESC}[1;1H${ESC}_G${control}${ESC}\\${ESC}8`;
}

export function kittyDelete(): string {
  return `${ESC}_Ga=d,d=I,i=${KITTY_ID},q=2${ESC}\\`;
}

// A terminal that speaks the protocol answers the query with `_Gi=31;OK`; every
// terminal answers the trailing DA1 request (`...c`), which marks the end.
export function parseKittyReply(reply: string): { done: boolean; supported: boolean } {
  return {
    done: /\x1b\[\?[\d;]*c/.test(reply),
    supported: reply.includes(`_Gi=${QUERY_ID};OK`),
  };
}

export function detectKittyGraphics(
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
  timeoutMs = 300,
): Promise<boolean> {
  if (!stdin.isTTY || !stdout.isTTY) return Promise.resolve(false);

  return new Promise((resolve) => {
    let reply = "";
    const wasRaw = stdin.isRaw;

    const finish = (supported: boolean): void => {
      clearTimeout(timer);
      stdin.off("data", onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      resolve(supported);
    };

    const onData = (chunk: Buffer): void => {
      reply += chunk.toString();
      const parsed = parseKittyReply(reply);
      if (parsed.done) finish(parsed.supported);
    };

    const timer = setTimeout(() => finish(parseKittyReply(reply).supported), timeoutMs);

    stdin.setRawMode(true);
    stdin.on("data", onData);
    stdin.resume();
    stdout.write(KITTY_QUERY);
  });
}

// --- Half-block fallback -----------------------------------------------------

export type ColorDepth = "truecolor" | "256";

export function detectColorDepth(env: NodeJS.ProcessEnv = process.env): ColorDepth {
  return env.COLORTERM === "truecolor" || env.COLORTERM === "24bit" ? "truecolor" : "256";
}

function ansiColor(kind: 38 | 48, r: number, g: number, b: number, depth: ColorDepth): string {
  if (depth === "truecolor") return `${ESC}[${kind};2;${r};${g};${b}m`;
  const cube = (v: number): number => Math.round(v / 51);
  return `${ESC}[${kind};5;${16 + 36 * cube(r) + 6 * cube(g) + cube(b)}m`;
}

// Each text row packs two image pixels per cell: "▀" in the top pixel's color
// over the bottom pixel's background. Returns one ANSI string per row.
export function halfBlockRows(image: BackgroundImage, cols: number, rows: number, depth: ColorDepth): string[] {
  const crop = coverCrop(image.width, image.height, cols, rows);
  const pixelRows = rows * 2;

  const sample = (col: number, pixelRow: number): [number, number, number] => {
    const x = Math.min(crop.x + Math.floor(((col + 0.5) * crop.w) / cols), image.width - 1);
    const y = Math.min(crop.y + Math.floor(((pixelRow + 0.5) * crop.h) / pixelRows), image.height - 1);
    const i = (y * image.width + x) * 4;
    return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!];
  };

  const result: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const [tr, tg, tb] = sample(col, row * 2);
      const [br, bg, bb] = sample(col, row * 2 + 1);
      line += ansiColor(38, tr, tg, tb, depth) + ansiColor(48, br, bg, bb, depth) + "▀";
    }
    result.push(line + `${ESC}[0m`);
  }
  return result;
}
