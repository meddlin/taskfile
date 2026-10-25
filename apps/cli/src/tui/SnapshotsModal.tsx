import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";
import type { SnapshotSummary } from "../snapshots.js";

export function SnapshotsModal({
  summaries,
  selectedIndex,
  modalMode,
  pendingDeleteId,
}: {
  summaries: SnapshotSummary[];
  selectedIndex: number;
  modalMode: "list" | "confirm-delete";
  pendingDeleteId: number | undefined;
}): ReactElement {
  const pending = summaries.find((summary) => summary.id === pendingDeleteId);

  return (
    <Box borderStyle="round" borderColor={theme.accent} flexDirection="column" paddingX={1}>
      <Text bold>Daily Snapshots</Text>
      <Text> </Text>
      {summaries.length === 0 && <Text dimColor>No snapshots yet.</Text>}
      {summaries.map((summary, index) => (
        <Text key={summary.id} inverse={index === selectedIndex}>
          {summary.date}
        </Text>
      ))}
      {modalMode === "confirm-delete" && pending && (
        <Box marginTop={1}>
          <Text>Delete snapshot from {pending.date}? (y/n)</Text>
        </Box>
      )}
    </Box>
  );
}
