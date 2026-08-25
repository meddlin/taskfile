import type { ReactElement } from "react";
import { Text } from "ink";

export function Divider({ width }: { width: number }): ReactElement {
  return <Text dimColor>{"─".repeat(width)}</Text>;
}
