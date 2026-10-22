import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PNG } from "pngjs";
import {
  coverCrop,
  halfBlockRows,
  kittyPlace,
  kittyTransmit,
  loadBackgroundImage,
  parseKittyReply,
} from "./backgroundImage.js";

function writePng(file: string, width: number, height: number, rgb: [number, number, number]): void {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = rgb[0];
    png.data[i * 4 + 1] = rgb[1];
    png.data[i * 4 + 2] = rgb[2];
    png.data[i * 4 + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

describe("backgroundImage", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-bg-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("loads a PNG and dims it", () => {
    const file = path.join(dir, "a.png");
    writePng(file, 4, 2, [200, 100, 50]);

    const image = loadBackgroundImage(file);

    expect([image.width, image.height]).toEqual([4, 2]);
    expect([...image.data.subarray(0, 4)]).toEqual([80, 40, 20, 255]);
    expect(PNG.sync.read(image.png).width).toBe(4);
  });

  it("throws a readable error for a missing or non-PNG file", () => {
    const bogus = path.join(dir, "b.png");
    fs.writeFileSync(bogus, "not a png");

    expect(() => loadBackgroundImage(path.join(dir, "missing.png"))).toThrow(/Could not load background image/);
    expect(() => loadBackgroundImage(bogus)).toThrow(/Could not load background image/);
  });

  it("crops a wide image horizontally and a tall image vertically to cover the area", () => {
    // 100x20 cells -> 100x40 pixel grid, aspect 2.5
    expect(coverCrop(500, 100, 100, 20)).toEqual({ x: 125, y: 0, w: 250, h: 100 });
    expect(coverCrop(100, 400, 100, 20)).toEqual({ x: 0, y: 180, w: 100, h: 40 });
  });

  it("splits large PNG payloads into continued kitty chunks", () => {
    const sequence = kittyTransmit(Buffer.alloc(10000, 1));
    const chunks = sequence.split("\x1b\\").filter(Boolean);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("a=t,f=100");
    expect(chunks[0]).toContain("m=1");
    expect(chunks.at(-1)).toContain("m=0");
  });

  it("places the image below text (z=-1) over the requested cell area", () => {
    expect(kittyPlace({ width: 100, height: 400 }, 100, 20)).toContain("c=100,r=20,z=-1");
  });

  it("recognizes a kitty reply only when the OK precedes the DA1 answer", () => {
    expect(parseKittyReply("\x1b_Gi=31;OK\x1b\\\x1b[?62;c")).toEqual({ done: true, supported: true });
    expect(parseKittyReply("\x1b[?62;c")).toEqual({ done: true, supported: false });
    expect(parseKittyReply("")).toEqual({ done: false, supported: false });
  });

  it("renders half-block rows covering the requested size", () => {
    const file = path.join(dir, "c.png");
    writePng(file, 8, 8, [255, 0, 0]);
    const image = loadBackgroundImage(file);

    const rows = halfBlockRows(image, 5, 3, "truecolor");

    expect(rows).toHaveLength(3);
    expect(rows[0]!.match(/▀/g)).toHaveLength(5);
    expect(rows[0]).toContain("38;2;102;0;0");
    expect(halfBlockRows(image, 5, 3, "256")[0]).toContain("38;5;");
  });
});
