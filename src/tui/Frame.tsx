import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { Divider } from "./Divider.js";
import { MessageArea } from "./MessageArea.js";
import { Sidebar, type Page } from "./Sidebar.js";
import { theme } from "./theme.js";

const BORDER_WIDTH = 1; // each side
const PADDING_X = 1; // each side
const SIDEBAR_WIDTH = 16;

export function Frame({
  children,
  message,
  width,
  height,
  activePage,
}: {
  children: ReactNode;
  message?: string;
  width: number;
  height: number;
  activePage: Page;
}): ReactElement {
  const innerWidth = width - BORDER_WIDTH * 2 - PADDING_X * 2;
  const contentWidth = innerWidth - SIDEBAR_WIDTH;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} width={width} height={height} paddingX={PADDING_X}>
      <Text bold color={theme.accent}>
        Taskfile
      </Text>
      <Divider width={innerWidth} />
      <Box flexDirection="row" flexGrow={1}>
        <Sidebar width={SIDEBAR_WIDTH} activePage={activePage} />
        <Box flexDirection="column" width={contentWidth} paddingLeft={1}>
          <MessageArea message={message} />
          {children}
        </Box>
      </Box>
    </Box>
  );
}
