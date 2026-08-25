import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";

export function Frame({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" width={120} height={40} paddingX={1}>
      <Text bold color="cyan">
        Taskfile
      </Text>
      {children}
    </Box>
  );
}
