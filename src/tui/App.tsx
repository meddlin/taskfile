import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Text, useApp, useInput, useWindowSize } from "ink";
import { Frame } from "./Frame.js";
import { TodosPage } from "./TodosPage.js";
import { SettingsPage } from "./SettingsPage.js";
import { AddTaskInput } from "./AddTaskInput.js";
import { SnapshotsModal } from "./SnapshotsModal.js";
import { SnapshotDetailView } from "./SnapshotDetailView.js";
import { BackgroundLayer, type GraphicsSupport } from "./BackgroundLayer.js";
import { loadBackgroundImage, type BackgroundImage } from "./backgroundImage.js";
import { fitFrameToWindow } from "./frameSize.js";
import type { Page } from "./Sidebar.js";
import { loadSettings, saveSettings, type Settings } from "../settings.js";
import { computeProgress, createList, deleteList, loadLists, loadTasks, renameList, type List } from "../store.js";
import {
  deleteSnapshot,
  listSnapshots,
  loadSnapshotDetail,
  type SnapshotDetail,
  type SnapshotSummary,
} from "../snapshots.js";

type Mode = "normal" | "new-list" | "nav-rename-list" | "confirm-delete-list" | "snapshots";
type Focus = "nav" | "content";

const NAV_HINT = "↑/↓ cycle pages · ←/→ switch focus · r rename list · D delete list · Tab switch · Ctrl+N new list · h snapshots · q quit";
const CONFIRM_DELETE_LIST_HINT = "y/enter confirm delete · n/esc cancel";
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

export function App({ graphics = "none" }: { graphics?: GraphicsSupport } = {}): ReactElement {
  const { exit } = useApp();
  const [lists, setLists] = useState<List[]>(() => loadLists());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const frameSize = fitFrameToWindow(settings, useWindowSize());
  const background = useMemo<{ image?: BackgroundImage; notice?: string }>(() => {
    if (settings.backgroundImage === null) return {};
    try {
      const image = loadBackgroundImage(settings.backgroundImage);
      return graphics === "kitty"
        ? { image }
        : { image, notice: "This terminal doesn't support kitty graphics; showing a low-fidelity backdrop." };
    } catch (error) {
      return { notice: error instanceof Error ? error.message : String(error) };
    }
  }, [settings.backgroundImage, graphics]);
  const [page, setPage] = useState<Page>(() => {
    const savedId = settings.lastActiveListId;
    const match = savedId !== null && lists.some((list) => list.id === savedId);
    return { type: "list", listId: match ? savedId! : lists[0]!.id };
  });
  const [mode, setMode] = useState<Mode>("normal");
  const [focus, setFocus] = useState<Focus>("content");
  const [navLocked, setNavLocked] = useState(false);
  const [message, setMessage] = useState<string | undefined>(background.notice);
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
  const [pendingDeleteListId, setPendingDeleteListId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (page.type === "list") {
      setSettings(saveSettings({ lastActiveListId: page.listId }));
    }
  }, [page]);

  function refreshLists(): void {
    setLists(loadLists());
  }

  const renamingListId = mode === "nav-rename-list" && page.type === "list" ? page.listId : undefined;

  const pendingDeleteList = mode === "confirm-delete-list" ? lists.find((list) => list.id === pendingDeleteListId) : undefined;
  const pendingDeleteTaskCount = pendingDeleteList ? loadTasks(pendingDeleteList.id).length : 0;

  function confirmDeleteList(listId: number): void {
    const index = lists.findIndex((list) => list.id === listId);
    const result = deleteList(listId);
    if (result.status === "blocked") {
      setMessage(result.reason);
    } else if (result.status === "ok") {
      const nextLists = loadLists();
      setLists(nextLists);
      // Land on the list that took the deleted one's place (or the new last list).
      const neighbor = nextLists[Math.min(Math.max(index, 0), nextLists.length - 1)]!;
      setPage({ type: "list", listId: neighbor.id });
    }
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

    if (mode === "confirm-delete-list") {
      if (input === "y" || key.return) {
        if (pendingDeleteListId !== undefined) {
          confirmDeleteList(pendingDeleteListId);
        }
      } else if (!(input === "n" || key.escape)) {
        return;
      }
      setPendingDeleteListId(undefined);
      setMode("normal");
      setHint(NAV_HINT);
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

    if (input === "D" && page.type === "list") {
      setMessage(undefined);
      if (lists.length <= 1) {
        setMessage("Can't delete the only list.");
        return;
      }
      setPendingDeleteListId(page.listId);
      setMode("confirm-delete-list");
      setHint(CONFIRM_DELETE_LIST_HINT);
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
      width={frameSize.width}
      height={frameSize.height}
      lists={lists}
      activePage={page}
      progress={progress}
      progressAnimated={settings.progressAnimation}
      navFocused={focus === "nav"}
      snapshotDate={viewingSnapshot?.date}
      background={background.image ? "default" : settings.background}
      backdrop={
        background.image ? (
          <BackgroundLayer image={background.image} graphics={graphics} width={frameSize.width} height={frameSize.height} />
        ) : undefined
      }
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
        backgroundNotice={background.notice}
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
      {pendingDeleteList && (
        <Text>
          Delete list "{pendingDeleteList.name}" and its {pendingDeleteTaskCount} task(s)? (y/n)
        </Text>
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
