import { useEffect, useMemo, type ReactElement } from "react";
import { Box, Text, useStdout } from "ink";
import {
  detectColorDepth,
  halfBlockRows,
  kittyDelete,
  kittyPlace,
  kittyTransmit,
  type BackgroundImage,
} from "./backgroundImage.js";

export type GraphicsSupport = "kitty" | "none";

// Delay so the placement lands after Ink has repainted (a resize clears the screen).
const PLACE_DELAY_MS = 30;

function KittyLayer({ image, width, height }: { image: BackgroundImage; width: number; height: number }): null {
  const { write } = useStdout();

  useEffect(() => {
    write(kittyTransmit(image.png));
    return () => {
      write(kittyDelete());
    };
  }, [image, write]);

  useEffect(() => {
    const timer = setTimeout(() => write(kittyPlace(image, width, height)), PLACE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [image, width, height, write]);

  return null;
}

// Absolutely positioned underneath the frame's content: cells the content draws
// replace the backdrop, so it only shows through the empty space.
function HalfBlockLayer({ image, width, height }: { image: BackgroundImage; width: number; height: number }): ReactElement {
  const rows = useMemo(() => halfBlockRows(image, width, height, detectColorDepth()), [image, width, height]);

  return (
    <Box position="absolute" flexDirection="column" width={width} height={height}>
      {rows.map((row, index) => (
        <Text key={index}>{row}</Text>
      ))}
    </Box>
  );
}

export function BackgroundLayer({
  image,
  graphics,
  width,
  height,
}: {
  image: BackgroundImage;
  graphics: GraphicsSupport;
  width: number;
  height: number;
}): ReactElement {
  // The half-block backdrop sits inside the frame's border.
  return graphics === "kitty" ? (
    <KittyLayer image={image} width={width} height={height} />
  ) : (
    <HalfBlockLayer image={image} width={Math.max(width - 2, 1)} height={Math.max(height - 2, 1)} />
  );
}
