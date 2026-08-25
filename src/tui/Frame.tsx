import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { Divider } from "./Divider.js";
import { MessageArea } from "./MessageArea.js";

const FRAME_WIDTH = 120;
const FRAME_HEIGHT = 40;
const BORDER_WIDTH = 1; // each side
const PADDING_X = 1; // each side
const INNER_WIDTH = FRAME_WIDTH - BORDER_WIDTH * 2 - PADDING_X * 2;

export function Frame({ children, message }: { children: ReactNode; message?: string }): ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
      paddingX={PADDING_X}
    >
      <Text bold color="cyan">
        Taskfile
      </Text>
      <Divider width={INNER_WIDTH} />
      <MessageArea message={message} />
      {children}
    </Box>
  );
}
