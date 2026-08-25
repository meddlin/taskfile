import type { ReactElement } from "react";
import { Box, Text } from "ink";

export function MessageArea({ message }: { message: string | undefined }): ReactElement {
  return (
    <Box height={2} flexDirection="column">
      <Text color="yellow">{message ?? ""}</Text>
      <Text> </Text>
    </Box>
  );
}
