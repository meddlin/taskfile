import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";

export function ProgressBar({ done, total }: { done: number; total: number }): ReactElement {
  if (total === 0) return <></>;

  const fraction = done / total;
  const percent = Math.round(fraction * 100);

  return (
    <Box flexDirection="column">
      <Box width="100%" height={1}>
        <Box width={`${fraction * 100}%`} backgroundColor={theme.accent} />
        <Box flexGrow={1} backgroundColor={theme.navHighlightBg} />
      </Box>
      <Text dimColor>{`${percent}% complete (${done}/${total})`}</Text>
    </Box>
  );
}
