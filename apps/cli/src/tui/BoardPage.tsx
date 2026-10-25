import { useEffect, useState, type ReactElement } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { STATUS_LABELS, TASK_STATUSES, groupByStatus, stepStatus } from "../board.js";
import { loadBoardTasks, setStatus, type Task } from "../store.js";
import { theme } from "./theme.js";

const BOARD_HINT =
  "↑/k ↓/j card · [ ] column · , . move card · r remove from board · ←/→ nav focus · Tab switch · q quit";

export function BoardPage({
  visible,
  active,
  setMessage,
  onHintChange,
}: {
  visible: boolean;
  active: boolean;
  setMessage: (message: string | undefined) => void;
  onHintChange: (hint: string) => void;
}): ReactElement {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>(() => loadBoardTasks());
  const [column, setColumn] = useState(0);
  const [row, setRow] = useState(0);

  useEffect(() => {
    if (visible) setTasks(loadBoardTasks());
  }, [visible]);

  useEffect(() => {
    if (active) onHintChange(BOARD_HINT);
  }, [active, onHintChange]);

  const columns = groupByStatus(tasks);
  const selectedRow = Math.min(row, Math.max(columns[TASK_STATUSES[column]!].length - 1, 0));
  const selected = columns[TASK_STATUSES[column]!][selectedRow];

  function selectColumn(next: number): void {
    setColumn(Math.min(Math.max(next, 0), TASK_STATUSES.length - 1));
    setRow(0);
  }

  // Applies a status change to the selected card, then keeps the cursor on it (or its neighbour
  // when it leaves the board).
  function changeStatus(task: Task, status: ReturnType<typeof stepStatus>): void {
    const result = setStatus(task.id, status);
    if (result.status === "blocked") {
      setMessage(result.reason);
      return;
    }
    const nextTasks = loadBoardTasks();
    setTasks(nextTasks);
    if (status !== null) {
      const nextColumn = TASK_STATUSES.indexOf(status);
      setColumn(nextColumn);
      setRow(groupByStatus(nextTasks)[status].findIndex((candidate) => candidate.id === task.id));
    }
  }

  useInput(
    (input, key) => {
      setMessage(undefined);

      if (input === "q" || key.escape) {
        exit();
        return;
      }

      if (key.upArrow || input === "k") {
        setRow(Math.max(selectedRow - 1, 0));
      } else if (key.downArrow || input === "j") {
        setRow(Math.min(selectedRow + 1, Math.max(columns[TASK_STATUSES[column]!].length - 1, 0)));
      } else if (input === "[") {
        selectColumn(column - 1);
      } else if (input === "]") {
        selectColumn(column + 1);
      } else if (selected && (input === "," || input === ".")) {
        const delta = input === "." ? 1 : -1;
        const status = stepStatus(selected.status, delta, false);
        if (status !== selected.status) changeStatus(selected, status);
      } else if (selected && input === "r") {
        changeStatus(selected, null);
      }
    },
    { isActive: active },
  );

  if (!visible) return <></>;

  return (
    <Box flexDirection="row" flexGrow={1}>
      {TASK_STATUSES.map((status, index) => (
        <Box key={status} flexDirection="column" width="25%" paddingRight={1}>
          <Text bold color={index === column ? theme.accent : undefined}>
            {STATUS_LABELS[status]} ({columns[status].length})
          </Text>
          {columns[status].map((task, cardIndex) => (
            <Text
              key={task.id}
              wrap="truncate-end"
              inverse={index === column && cardIndex === selectedRow}
              strikethrough={status === "done"}
            >
              {`#${task.id} ${task.text}`}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
