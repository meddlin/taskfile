import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { TaskList } from "./TaskList.js";
import type { SnapshotDetail } from "../snapshots.js";

export function SnapshotDetailView({ detail }: { detail: SnapshotDetail }): ReactElement {
  return (
    <Box flexDirection="column">
      {detail.lists.map((list, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Text bold underline>
            {list.name}
          </Text>
          <TaskList tasks={list.tasks} selectedIndex={-1} />
        </Box>
      ))}
    </Box>
  );
}
