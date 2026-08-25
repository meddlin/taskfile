import type { ReactElement } from "react";
import { Text } from "ink";

export function Divider({ width, dotted }: { width: number; dotted?: boolean }): ReactElement {
  return <Text dimColor>{(dotted ? "·" : "─").repeat(width)}</Text>;
}
