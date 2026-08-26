import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { Divider } from "./Divider.js";
import { MessageArea } from "./MessageArea.js";
import { ProgressBar } from "./ProgressBar.js";
import { Sidebar, type Page } from "./Sidebar.js";
import { theme } from "./theme.js";

const BORDER_WIDTH = 1; // each side
const PADDING_X = 1; // each side
const SIDEBAR_WIDTH = 16;
const TITLE = "Taskfile";
const TITLE_SEPARATOR = " │ ";

export function Frame({
  children,
  message,
  hint,
  width,
  height,
  activePage,
  progress,
  progressAnimated,
}: {
  children: ReactNode;
  message?: string;
  hint?: string;
  width: number;
  height: number;
  activePage: Page;
  progress: { done: number; total: number };
  progressAnimated: boolean;
}): ReactElement {
  const innerWidth = width - BORDER_WIDTH * 2 - PADDING_X * 2;
  const contentWidth = innerWidth - SIDEBAR_WIDTH;
  const contentPaddingLeft = 1;
  const messageAreaWidth = contentWidth - contentPaddingLeft;
  const titleWidth = SIDEBAR_WIDTH;
  const progressBarWidth = Math.max(innerWidth - titleWidth - TITLE_SEPARATOR.length, 0);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} width={width} height={height} paddingX={PADDING_X}>
      <Box flexDirection="row">
        <Text bold color={theme.accent}>
          {TITLE.padEnd(titleWidth, " ")}
        </Text>
        <Text dimColor>{TITLE_SEPARATOR}</Text>
        <ProgressBar done={progress.done} total={progress.total} width={progressBarWidth} animated={progressAnimated} />
      </Box>
      <Divider width={innerWidth} />
      <Box flexDirection="row" flexGrow={1}>
        <Sidebar width={SIDEBAR_WIDTH} activePage={activePage} />
        <Box flexDirection="column" width={contentWidth} paddingLeft={contentPaddingLeft}>
          <MessageArea message={message} width={messageAreaWidth} />
          {children}
        </Box>
      </Box>
      <Divider width={innerWidth} />
      <Text dimColor>{hint || " "}</Text>
    </Box>
  );
}
