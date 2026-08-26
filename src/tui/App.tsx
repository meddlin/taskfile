import { useEffect, useState, type ReactElement } from "react";
import { useApp, useInput } from "ink";
import { Frame } from "./Frame.js";
import { TodosPage } from "./TodosPage.js";
import { SettingsPage } from "./SettingsPage.js";
import { AddTaskInput } from "./AddTaskInput.js";
import type { Page } from "./Sidebar.js";
import { loadSettings, saveSettings, type Settings } from "../settings.js";
import { computeProgress, createList, loadLists, loadTasks, type List } from "../store.js";

type Mode = "normal" | "new-list";

function buildPages(lists: List[]): Page[] {
  return [...lists.map((list) => ({ type: "list" as const, listId: list.id })), { type: "settings" as const }];
}

function pagesEqual(a: Page, b: Page): boolean {
  if (a.type === "settings" || b.type === "settings") {
    return a.type === b.type;
  }
  return a.listId === b.listId;
}

export function App(): ReactElement {
  const { exit } = useApp();
  const [lists, setLists] = useState<List[]>(() => loadLists());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [page, setPage] = useState<Page>(() => {
    const savedId = settings.lastActiveListId;
    const match = savedId !== null && lists.some((list) => list.id === savedId);
    return { type: "list", listId: match ? savedId! : lists[0]!.id };
  });
  const [mode, setMode] = useState<Mode>("normal");
  const [navLocked, setNavLocked] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [hint, setHint] = useState<string>("");
  const [progress, setProgress] = useState<{ done: number; total: number }>(() => {
    const activeListId = page.type === "list" ? page.listId : lists[0]!.id;
    const { done, total } = computeProgress(loadTasks(activeListId));
    return { done, total };
  });

  useEffect(() => {
    if (page.type === "list") {
      setSettings(saveSettings({ lastActiveListId: page.listId }));
    }
  }, [page]);

  function refreshLists(): void {
    setLists(loadLists());
  }

  function cyclePage(delta: number): void {
    const pages = buildPages(lists);
    const currentIndex = pages.findIndex((candidate) => pagesEqual(candidate, page));
    const nextIndex = (currentIndex + delta + pages.length) % pages.length;
    setPage(pages[nextIndex]!);
  }

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (mode === "new-list") {
      if (key.escape) {
        setMode("normal");
      }
      return;
    }

    if (navLocked) {
      return;
    }

    if (key.ctrl && input === "n") {
      setMessage(undefined);
      setHint("enter save · esc cancel");
      setMode("new-list");
      return;
    }

    if (key.tab) {
      setMessage(undefined);
      cyclePage(key.shift ? -1 : 1);
    }
  });

  return (
    <Frame
      message={message}
      hint={hint}
      width={settings.width}
      height={settings.height}
      lists={lists}
      activePage={page}
      progress={progress}
      progressAnimated={settings.progressAnimation}
    >
      {lists.map((list) => (
        <TodosPage
          key={list.id}
          listId={list.id}
          listName={list.name}
          onListRenamed={refreshLists}
          active={mode === "normal" && page.type === "list" && page.listId === list.id}
          setMessage={setMessage}
          onNavLockChange={setNavLocked}
          onHintChange={setHint}
          onProgressChange={setProgress}
        />
      ))}
      <SettingsPage
        active={mode === "normal" && page.type === "settings"}
        settings={settings}
        onSettingsChange={setSettings}
        setMessage={setMessage}
        onNavLockChange={setNavLocked}
        onHintChange={setHint}
      />
      {mode === "new-list" && (
        <AddTaskInput
          label="New list: "
          onSubmit={(name) => {
            const list = createList(name);
            setLists(loadLists());
            setPage({ type: "list", listId: list.id });
            setMode("normal");
          }}
        />
      )}
    </Frame>
  );
}
