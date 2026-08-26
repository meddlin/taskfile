import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import type { List } from "../store.js";

export type Page = { type: "list"; listId: number } | { type: "settings" };

function NavRow({ label, active, contentWidth }: { label: string; active: boolean; contentWidth: number }): ReactElement {
  const truncated = label.length > contentWidth ? `${label.slice(0, Math.max(contentWidth - 1, 0))}…` : label;
  const row = ` ${truncated}`.padEnd(contentWidth, " ");
  return (
    <Text backgroundColor={active ? theme.navHighlightBg : undefined} color={active ? theme.navHighlightFg : undefined} bold={active}>
      {row}
    </Text>
  );
}

export function Sidebar({
  width,
  lists,
  activePage,
  focused,
}: {
  width: number;
  lists: List[];
  activePage: Page;
  focused: boolean;
}): ReactElement {
  const contentWidth = width - 1; // 1 column reserved for the right border

  return (
    <Box
      flexDirection="column"
      width={width}
      flexGrow={1}
      borderStyle="single"
      borderColor={focused ? theme.accent : undefined}
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
    >
      {lists.map((list) => (
        <NavRow
          key={list.id}
          label={list.name}
          active={activePage.type === "list" && activePage.listId === list.id}
          contentWidth={contentWidth}
        />
      ))}
      <Box flexGrow={1} />
      <NavRow label="Settings" active={activePage.type === "settings"} contentWidth={contentWidth} />
    </Box>
  );
}
