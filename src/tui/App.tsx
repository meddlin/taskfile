import { useState, type ReactElement } from "react";
import { useApp, useInput } from "ink";
import { Frame } from "./Frame.js";
import { TodosPage } from "./TodosPage.js";
import { SettingsPage } from "./SettingsPage.js";
import type { Page } from "./Sidebar.js";
import { loadSettings, type Settings } from "../settings.js";
import { computeProgress, loadTasks } from "../store.js";

export function App(): ReactElement {
  const { exit } = useApp();
  const [page, setPage] = useState<Page>("todos");
  const [navLocked, setNavLocked] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [hint, setHint] = useState<string>("");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [progress, setProgress] = useState<{ done: number; total: number }>(() => {
    const { done, total } = computeProgress(loadTasks());
    return { done, total };
  });

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (key.tab && !navLocked) {
      setMessage(undefined);
      setPage((current) => (current === "todos" ? "settings" : "todos"));
    }
  });

  return (
    <Frame
      message={message}
      hint={hint}
      width={settings.width}
      height={settings.height}
      activePage={page}
      progress={progress}
      progressAnimated={settings.progressAnimation}
    >
      <TodosPage
        active={page === "todos"}
        setMessage={setMessage}
        onNavLockChange={setNavLocked}
        onHintChange={setHint}
        onProgressChange={setProgress}
      />
      <SettingsPage
        active={page === "settings"}
        settings={settings}
        onSettingsChange={setSettings}
        setMessage={setMessage}
        onNavLockChange={setNavLocked}
        onHintChange={setHint}
      />
    </Frame>
  );
}
