import { useState, type ReactElement } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { addTask, loadTasks, removeTask, toggleTask, type Task } from "../store.js";
import { TaskList } from "./TaskList.js";
import { AddTaskInput } from "./AddTaskInput.js";

type Mode = "list" | "add" | "confirm-delete";

export function App(): ReactElement {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | undefined>(undefined);

  function refresh(): void {
    setTasks(loadTasks());
  }

  function clampSelection(nextTasks: Task[], index: number): number {
    if (nextTasks.length === 0) return 0;
    return Math.min(Math.max(index, 0), nextTasks.length - 1);
  }

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (mode === "add") {
      if (key.escape) {
        setMode("list");
      }
      return;
    }

    if (mode === "confirm-delete") {
      if (input === "y" || input === "d" || key.return) {
        if (pendingDeleteId !== undefined) {
          removeTask(pendingDeleteId);
          const nextTasks = loadTasks();
          setTasks(nextTasks);
          setSelectedIndex((index) => clampSelection(nextTasks, index));
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
        toggleTask(task.id);
        refresh();
      }
      return;
    }

    if (input === "d" || input === "x") {
      const task = tasks[selectedIndex];
      if (task) {
        setPendingDeleteId(task.id);
        setMode("confirm-delete");
      }
      return;
    }

    if (input === "a") {
      setMode("add");
      return;
    }
  });

  const pendingDeleteTask = tasks.find((task) => task.id === pendingDeleteId);

  return (
    <Box flexDirection="column">
      <TaskList tasks={tasks} selectedIndex={selectedIndex} />
      {mode === "confirm-delete" && pendingDeleteTask && (
        <Text>
          Delete "{pendingDeleteTask.text}"? (y/n)
        </Text>
      )}
      {mode === "add" && (
        <AddTaskInput
          onSubmit={(text) => {
            addTask(text);
            refresh();
            setMode("list");
          }}
        />
      )}
      {mode === "list" && (
        <Text dimColor>↑/k ↓/j move · space/enter toggle · a add · d delete · q quit</Text>
      )}
    </Box>
  );
}
