import { useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

export function AddTaskInput({ onSubmit }: { onSubmit: (text: string) => void }): ReactElement {
  const [value, setValue] = useState("");

  return (
    <Box>
      <Text>New task: </Text>
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
