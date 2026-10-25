import { useEffect, useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import type { Task } from "../store.js";

const TWINKLE_FRAMES = ["yellow", "yellowBright", "white", "yellowBright"] as const;
const TWINKLE_INTERVAL_MS = 400;

export function TaskList({ tasks, selectedIndex }: { tasks: Task[]; selectedIndex: number }): ReactElement {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => (t + 1) % TWINKLE_FRAMES.length), TWINKLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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
          <Box key={task.id}>
            <Text color={task.priority ? TWINKLE_FRAMES[tick] : undefined}>{task.priority ? "*" : " "}</Text>
            <Text inverse={selected} strikethrough={task.done}>
              {" " + label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
