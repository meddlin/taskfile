import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { Task } from "../store.js";

export function TaskList({ tasks, selectedIndex }: { tasks: Task[]; selectedIndex: number }): ReactElement {
  if (tasks.length === 0) {
    return <Text dimColor>No tasks yet. Press a to add one.</Text>;
  }

  return (
    <Box flexDirection="column">
      {tasks.map((task, index) => {
        const marker = task.done ? "[x]" : "[ ]";
        const selected = index === selectedIndex;
        const label =
          task.parentId !== null
            ? `  - ${marker} #${task.id} ${task.text}`
            : `${marker} #${task.id} ${task.text}`;
        return (
          <Text key={task.id} inverse={selected}>
            {label}
          </Text>
        );
      })}
    </Box>
  );
}
