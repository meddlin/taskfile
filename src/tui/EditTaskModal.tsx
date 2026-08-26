import type { ReactElement } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "./theme.js";

export type EditFocus = "input" | "priority" | "save" | "cancel";

export function EditTaskModal({
  value,
  onChange,
  onSubmit,
  focus,
  priority,
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  focus: EditFocus;
  priority: boolean;
}): ReactElement {
  return (
    <Box borderStyle="round" borderColor={theme.accent} flexDirection="column" paddingX={1}>
      <Text>Edit task:</Text>
      <TextInput value={value} onChange={onChange} onSubmit={onSubmit} focus={focus === "input"} />
      <Box marginTop={1}>
        <Text inverse={focus === "priority"}> [{priority ? "★" : " "}] Priority </Text>
      </Box>
      <Box marginTop={1}>
        <Text inverse={focus === "save"}> [Save] </Text>
        <Text>  </Text>
        <Text inverse={focus === "cancel"}> [Cancel] </Text>
      </Box>
    </Box>
  );
}
