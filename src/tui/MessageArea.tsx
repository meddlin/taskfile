import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { Divider } from "./Divider.js";

export function MessageArea({ message, width }: { message: string | undefined; width: number }): ReactElement {
  return (
    <Box height={4} width={width} flexDirection="column">
      <Text color="yellow">{message || " "}</Text>
      <Text> </Text>
      <Divider width={width} dotted />
      <Text> </Text>
    </Box>
  );
}
