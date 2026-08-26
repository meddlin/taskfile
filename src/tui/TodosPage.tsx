import { useEffect, useState, type ReactElement } from "react";
import { Text, useApp, useInput } from "ink";
import {
  addTask,
  computeProgress,
  hasSubItems,
  loadTasks,
  removeTask,
  setPriority,
  toggleTask,
  updateTask,
  type Task,
} from "../store.js";
import { TaskList } from "./TaskList.js";
import { AddTaskInput } from "./AddTaskInput.js";
import { EditTaskModal, type EditFocus } from "./EditTaskModal.js";

type Mode = "list" | "add" | "confirm-delete" | "edit";

const LIST_HINT =
  "↑/k ↓/j move · space/enter toggle · a add · s add sub-item · e edit · d delete · Tab settings · q quit";
const EDIT_HINT = "tab cycle · space toggle priority · enter save · esc cancel";

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
  onProgressChange,
}: {
  active: boolean;
  setMessage: (message: string | undefined) => void;
  onNavLockChange: (locked: boolean) => void;
  onHintChange: (hint: string) => void;
  onProgressChange: (progress: { done: number; total: number }) => void;
}): ReactElement {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | undefined>(undefined);
  const [addParentId, setAddParentId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | undefined>(undefined);
  const [editValue, setEditValue] = useState("");
  const [editPriority, setEditPriority] = useState(false);
  const [editFocus, setEditFocus] = useState<EditFocus>("input");

  useEffect(() => {
    onNavLockChange(mode === "add" || mode === "edit");
    if (active) {
      onHintChange(mode === "list" ? LIST_HINT : mode === "edit" ? EDIT_HINT : "");
    }
  }, [mode, active, onNavLockChange, onHintChange]);

  useEffect(() => {
    const { done, total } = computeProgress(tasks);
    onProgressChange({ done, total });
  }, [tasks, onProgressChange]);

  function refresh(): void {
    setTasks(loadTasks());
  }

  function commitEdit(): void {
    if (editingTaskId === undefined) {
      setMode("list");
      return;
    }
    const result = updateTask(editingTaskId, editValue);
    if (result.status === "blocked") {
      setMessage(result.reason);
      return;
    }
    if (result.status === "ok") {
      setPriority(editingTaskId, editPriority);
      refresh();
    }
    setEditingTaskId(undefined);
    setMode("list");
  }

  function cancelEdit(): void {
    setEditingTaskId(undefined);
    setMode("list");
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

      if (mode === "edit") {
        if (key.escape) {
          cancelEdit();
          return;
        }

        if (key.tab) {
          const order: EditFocus[] = ["input", "priority", "save", "cancel"];
          const delta = key.shift ? -1 : 1;
          const nextIndex = (order.indexOf(editFocus) + delta + order.length) % order.length;
          setEditFocus(order[nextIndex]!);
          return;
        }

        if (editFocus === "input") {
          return;
        }

        if (editFocus === "priority") {
          if (input === " " || key.return) {
            setEditPriority((p) => !p);
          }
          return;
        }

        if (key.return) {
          if (editFocus === "save") {
            commitEdit();
          } else {
            cancelEdit();
          }
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

      if (input === "e") {
        const task = tasks[selectedIndex];
        if (task) {
          setEditingTaskId(task.id);
          setEditValue(task.text);
          setEditPriority(task.priority);
          setEditFocus("input");
          setMode("edit");
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
      {mode === "edit" && (
        <EditTaskModal
          value={editValue}
          onChange={setEditValue}
          onSubmit={commitEdit}
          focus={editFocus}
          priority={editPriority}
        />
      )}
    </>
  );
}
