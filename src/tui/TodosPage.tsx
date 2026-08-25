import { useEffect, useState, type ReactElement } from "react";
import { Text, useApp, useInput } from "ink";
import { addTask, hasSubItems, loadTasks, removeTask, toggleTask, type Task } from "../store.js";
import { TaskList } from "./TaskList.js";
import { AddTaskInput } from "./AddTaskInput.js";

type Mode = "list" | "add" | "confirm-delete";

const LIST_HINT = "↑/k ↓/j move · space/enter toggle · a add · s add sub-item · d delete · Tab settings · q quit";

function resolveGroupParentId(tasks: Task[], index: number): number | undefined {
  const task = tasks[index];
  if (!task) return undefined;
  return task.parentId === null ? task.id : task.parentId;
}

export function TodosPage({
  active,
  setMessage,
  onNavLockChange,
  onHintChange,
}: {
  active: boolean;
  setMessage: (message: string | undefined) => void;
  onNavLockChange: (locked: boolean) => void;
  onHintChange: (hint: string) => void;
}): ReactElement {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | undefined>(undefined);
  const [addParentId, setAddParentId] = useState<number | null>(null);

  useEffect(() => {
    onNavLockChange(mode === "add");
    if (active) {
      onHintChange(mode === "list" ? LIST_HINT : "");
    }
  }, [mode, active, onNavLockChange, onHintChange]);

  function refresh(): void {
    setTasks(loadTasks());
  }

  function clampSelection(nextTasks: Task[], index: number): number {
    if (nextTasks.length === 0) return 0;
    return Math.min(Math.max(index, 0), nextTasks.length - 1);
  }

  useInput(
    (input, key) => {
      setMessage(undefined);

      if (mode === "add") {
        if (key.escape) {
          setMode("list");
        }
        return;
      }

      if (mode === "confirm-delete") {
        if (input === "y" || input === "d" || key.return) {
          if (pendingDeleteId !== undefined) {
            const result = removeTask(pendingDeleteId);
            if (result.status === "blocked") {
              setMessage(result.reason);
            } else {
              const nextTasks = loadTasks();
              setTasks(nextTasks);
              setSelectedIndex((index) => clampSelection(nextTasks, index));
            }
          }
          setPendingDeleteId(undefined);
          setMode("list");
        } else if (input === "n" || key.escape) {
          setPendingDeleteId(undefined);
          setMode("list");
        }
        return;
      }

      // mode === "list"
      if (input === "q" || key.escape) {
        exit();
        return;
      }

      if (key.upArrow || input === "k") {
        setSelectedIndex((index) => clampSelection(tasks, index - 1));
        return;
      }

      if (key.downArrow || input === "j") {
        setSelectedIndex((index) => clampSelection(tasks, index + 1));
        return;
      }

      if (input === " " || key.return) {
        const task = tasks[selectedIndex];
        if (task) {
          const result = toggleTask(task.id);
          if (result.status === "blocked") {
            setMessage(result.reason);
          } else {
            refresh();
          }
        }
        return;
      }

      if (input === "d" || input === "x") {
        const task = tasks[selectedIndex];
        if (task) {
          if (hasSubItems(task.id)) {
            setMessage("Delete all sub-items first.");
            return;
          }
          setPendingDeleteId(task.id);
          setMode("confirm-delete");
        }
        return;
      }

      if (input === "a") {
        setAddParentId(null);
        setMode("add");
        return;
      }

      if (input === "s") {
        const groupParentId = resolveGroupParentId(tasks, selectedIndex);
        if (groupParentId === undefined) {
          setMessage("Add a task first before adding sub-items.");
          return;
        }
        setAddParentId(groupParentId);
        setMode("add");
        return;
      }
    },
    { isActive: active },
  );

  const pendingDeleteTask = tasks.find((task) => task.id === pendingDeleteId);

  if (!active) return <></>;

  return (
    <>
      <TaskList tasks={tasks} selectedIndex={selectedIndex} />
      {mode === "confirm-delete" && pendingDeleteTask && <Text>Delete "{pendingDeleteTask.text}"? (y/n)</Text>}
      {mode === "add" && (
        <AddTaskInput
          label={addParentId === null ? "New task: " : "New sub-item: "}
          onSubmit={(text) => {
            addTask(text, addParentId);
            refresh();
            setMode("list");
          }}
        />
      )}
    </>
  );
}
