import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";

export type Page = "todos" | "settings";

const PAGES: { key: Page; label: string }[] = [
  { key: "todos", label: "TODOs" },
  { key: "settings", label: "Settings" },
];

export function Sidebar({ width, activePage }: { width: number; activePage: Page }): ReactElement {
  const contentWidth = width - 1; // 1 column reserved for the right border

  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false}>
      {PAGES.map(({ key, label }) => {
        const active = key === activePage;
        const row = ` ${label}`.padEnd(contentWidth, " ");
        return (
          <Text key={key} backgroundColor={active ? theme.navHighlightBg : undefined} color={active ? theme.navHighlightFg : undefined} bold={active}>
            {row}
          </Text>
        );
      })}
    </Box>
  );
}
