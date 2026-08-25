import { useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

export function AddTaskInput({
  onSubmit,
  label = "New task: ",
}: {
  onSubmit: (text: string) => void;
  label?: string;
}): ReactElement {
  const [value, setValue] = useState("");

  return (
    <Box>
      <Text>{label}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={(text) => {
          const trimmed = text.trim();
          if (trimmed.length > 0) {
            onSubmit(trimmed);
          }
        }}
      />
    </Box>
  );
}
