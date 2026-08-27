import { useEffect, useState, type ReactElement } from "react";
import { useApp, useInput } from "ink";
import { Frame } from "./Frame.js";
import { TodosPage } from "./TodosPage.js";
import { SettingsPage } from "./SettingsPage.js";
import { AddTaskInput } from "./AddTaskInput.js";
import { SnapshotsModal } from "./SnapshotsModal.js";
import { SnapshotDetailView } from "./SnapshotDetailView.js";
import type { Page } from "./Sidebar.js";
import { loadSettings, saveSettings, type Settings } from "../settings.js";
import { computeProgress, createList, loadLists, loadTasks, renameList, type List } from "../store.js";
import {
  deleteSnapshot,
  listSnapshots,
  loadSnapshotDetail,
  type SnapshotDetail,
  type SnapshotSummary,
} from "../snapshots.js";

type Mode = "normal" | "new-list" | "nav-rename-list" | "snapshots";
type Focus = "nav" | "content";

const NAV_HINT = "↑/↓ cycle pages · ←/→ switch focus · r rename list · Tab switch · Ctrl+N new list · h snapshots · q quit";
const SNAPSHOT_MODAL_HINT = "↑/k ↓/j select · enter/space view · d delete · esc close";
const SNAPSHOT_CONFIRM_DELETE_HINT = "y confirm delete · n/esc cancel";
const VIEW_SNAPSHOT_HINT = "esc/h back to live view";

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
  const [focus, setFocus] = useState<Focus>("content");
  const [navLocked, setNavLocked] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [hint, setHint] = useState<string>("");
  const [progress, setProgress] = useState<{ done: number; total: number }>(() => {
    const activeListId = page.type === "list" ? page.listId : lists[0]!.id;
    const { done, total } = computeProgress(loadTasks(activeListId));
    return { done, total };
  });
  const [snapshotSummaries, setSnapshotSummaries] = useState<SnapshotSummary[]>([]);
  const [snapshotSelectedIndex, setSnapshotSelectedIndex] = useState(0);
  const [snapshotModalMode, setSnapshotModalMode] = useState<"list" | "confirm-delete">("list");
  const [pendingDeleteSnapshotId, setPendingDeleteSnapshotId] = useState<number | undefined>(undefined);
  const [viewingSnapshot, setViewingSnapshot] = useState<SnapshotDetail | undefined>(undefined);

  useEffect(() => {
    if (page.type === "list") {
      setSettings(saveSettings({ lastActiveListId: page.listId }));
    }
  }, [page]);

  function refreshLists(): void {
    setLists(loadLists());
  }

  const renamingListId = mode === "nav-rename-list" && page.type === "list" ? page.listId : undefined;

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

    if (viewingSnapshot) {
      if (key.escape || input === "h") {
        setViewingSnapshot(undefined);
        setHint(NAV_HINT);
      }
      return;
    }

    if (mode === "snapshots") {
      if (snapshotModalMode === "confirm-delete") {
        if (input === "y" || input === "d" || key.return) {
          if (pendingDeleteSnapshotId !== undefined) {
            deleteSnapshot(pendingDeleteSnapshotId);
            const next = listSnapshots();
            setSnapshotSummaries(next);
            setSnapshotSelectedIndex((index) => Math.min(index, Math.max(next.length - 1, 0)));
          }
          setPendingDeleteSnapshotId(undefined);
          setSnapshotModalMode("list");
          setHint(SNAPSHOT_MODAL_HINT);
        } else if (input === "n" || key.escape) {
          setPendingDeleteSnapshotId(undefined);
          setSnapshotModalMode("list");
          setHint(SNAPSHOT_MODAL_HINT);
        }
        return;
      }

      if (key.escape) {
        setMode("normal");
        setHint(NAV_HINT);
        return;
      }

      if (key.upArrow || input === "k") {
        setSnapshotSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (key.downArrow || input === "j") {
        setSnapshotSelectedIndex((index) => Math.min(index + 1, snapshotSummaries.length - 1));
        return;
      }

      if (input === " " || key.return) {
        const summary = snapshotSummaries[snapshotSelectedIndex];
        if (summary) {
          const detail = loadSnapshotDetail(summary.id);
          if (detail) {
            setViewingSnapshot(detail);
            setMode("normal");
            setHint(VIEW_SNAPSHOT_HINT);
          }
        }
        return;
      }

      if (input === "d" || input === "x") {
        const summary = snapshotSummaries[snapshotSelectedIndex];
        if (summary) {
          setPendingDeleteSnapshotId(summary.id);
          setSnapshotModalMode("confirm-delete");
          setHint(SNAPSHOT_CONFIRM_DELETE_HINT);
        }
        return;
      }

      return;
    }

    if (mode === "new-list" || mode === "nav-rename-list") {
      if (key.escape) {
        setMode("normal");
        setHint(NAV_HINT);
      }
      return;
    }

    if (navLocked) {
      return;
    }

    if (input === "h") {
      setMessage(undefined);
      setSnapshotSummaries(listSnapshots());
      setSnapshotSelectedIndex(0);
      setSnapshotModalMode("list");
      setMode("snapshots");
      setHint(SNAPSHOT_MODAL_HINT);
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
      return;
    }

    if (key.leftArrow) {
      setFocus("nav");
      setHint(NAV_HINT);
      return;
    }

    if (key.rightArrow) {
      setFocus("content");
      return;
    }

    if (focus === "nav") {
      if (key.upArrow) {
        setMessage(undefined);
        cyclePage(-1);
        return;
      }

      if (key.downArrow) {
        setMessage(undefined);
        cyclePage(1);
        return;
      }

      if (input === "r" && page.type === "list") {
        setMessage(undefined);
        setHint("enter save · esc cancel");
        setMode("nav-rename-list");
        return;
      }
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
      navFocused={focus === "nav"}
      snapshotDate={viewingSnapshot?.date}
    >
      {lists.map((list) => {
        const visible = !viewingSnapshot && mode === "normal" && page.type === "list" && page.listId === list.id;
        return (
          <TodosPage
            key={list.id}
            listId={list.id}
            listName={list.name}
            onListRenamed={refreshLists}
            visible={visible}
            active={visible && focus === "content"}
            setMessage={setMessage}
            onNavLockChange={setNavLocked}
            onHintChange={setHint}
            onProgressChange={setProgress}
          />
        );
      })}
      <SettingsPage
        visible={!viewingSnapshot && mode === "normal" && page.type === "settings"}
        active={!viewingSnapshot && mode === "normal" && page.type === "settings" && focus === "content"}
        settings={settings}
        onSettingsChange={setSettings}
        setMessage={setMessage}
        onNavLockChange={setNavLocked}
        onHintChange={setHint}
      />
      {viewingSnapshot && <SnapshotDetailView detail={viewingSnapshot} />}
      {mode === "snapshots" && (
        <SnapshotsModal
          summaries={snapshotSummaries}
          selectedIndex={snapshotSelectedIndex}
          modalMode={snapshotModalMode}
          pendingDeleteId={pendingDeleteSnapshotId}
        />
      )}
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
      {renamingListId !== undefined && (
        <AddTaskInput
          label="Rename list: "
          initialValue={lists.find((l) => l.id === renamingListId)?.name ?? ""}
          onSubmit={(text) => {
            const result = renameList(renamingListId, text);
            if (result.status === "blocked") {
              setMessage(result.reason);
            } else if (result.status === "ok") {
              refreshLists();
            }
            setMode("normal");
            setHint(NAV_HINT);
          }}
        />
      )}
    </Frame>
  );
}
