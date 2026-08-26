import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { render } from "ink-testing-library";
import { App } from "./App.js";
import { addTask, getDefaultListId, loadLists, loadTasks, toggleTask } from "../store.js";
import { loadSettings } from "../settings.js";

function delay(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ink-text-input tracks cursor offset in local state that's only refreshed on
// re-render, so multiple backspace bytes sent in a single stdin.write() are
// processed against the same stale closure. Sending one at a time (like real
// keystrokes) lets React re-render between each.
async function backspace(stdin: { write: (data: string) => void }, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    stdin.write("\x7F");
    await delay();
  }
}

describe("App", () => {
  let tempHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-test-"));
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("toggles the selected task's done state with space", async () => {
    addTask(getDefaultListId(), "Buy milk");
    addTask(getDefaultListId(), "Walk the dog");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("j");
    await delay();
    stdin.write(" ");
    await delay();

    const tasks = loadTasks(getDefaultListId());
    expect(tasks.find((t) => t.text === "Walk the dog")?.done).toBe(true);
    expect(tasks.find((t) => t.text === "Buy milk")?.done).toBe(false);

    unmount();
  });

  it("updates the progress bar live as tasks are toggled done", async () => {
    addTask(getDefaultListId(), "Buy milk");
    addTask(getDefaultListId(), "Walk the dog");

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    expect(lastFrame()).toContain("Progress 0 %");

    stdin.write(" ");
    await delay();

    expect(lastFrame()).toContain("Progress 50 %");

    unmount();
  });

  it("removes the selected task after confirming with y", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("d");
    await delay();
    stdin.write("y");
    await delay();

    expect(loadTasks(getDefaultListId())).toHaveLength(0);

    unmount();
  });

  it("does not remove the selected task when the delete is cancelled", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("d");
    await delay();
    stdin.write("n");
    await delay();

    expect(loadTasks(getDefaultListId())).toHaveLength(1);

    unmount();
  });

  it("adds a new task from the add-mode text input", async () => {
    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("a");
    await delay();
    stdin.write("Write plan doc");
    await delay();
    stdin.write("\r");
    await delay();

    const tasks = loadTasks(getDefaultListId());
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe("Write plan doc");

    unmount();
  });

  it("adds a sub-item under the selected main item with s", async () => {
    addTask(getDefaultListId(), "Plan trip");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("s");
    await delay();
    stdin.write("Book flights");
    await delay();
    stdin.write("\r");
    await delay();

    const tasks = loadTasks(getDefaultListId());
    const subItem = tasks.find((t) => t.text === "Book flights");
    expect(subItem?.parentId).toBe(1);

    unmount();
  });

  it("adds a sibling sub-item when s is pressed with a sub-item selected", async () => {
    addTask(getDefaultListId(), "Plan trip");
    addTask(getDefaultListId(), "Book flights", 1);

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("j"); // select the sub-item
    await delay();
    stdin.write("s");
    await delay();
    stdin.write("Book hotel");
    await delay();
    stdin.write("\r");
    await delay();

    const tasks = loadTasks(getDefaultListId());
    const sibling = tasks.find((t) => t.text === "Book hotel");
    expect(sibling?.parentId).toBe(1);

    unmount();
  });

  it("blocks completing a main item with an incomplete sub-item and shows a message", async () => {
    addTask(getDefaultListId(), "Plan trip");
    addTask(getDefaultListId(), "Book flights", 1);

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write(" "); // try to complete the main item
    await delay();

    expect(loadTasks(getDefaultListId()).find((t) => t.id === 1)?.done).toBe(false);
    expect(lastFrame()).toContain("Complete all sub-items before completing this item.");

    unmount();
  });

  it("reverts an already-complete main item to incomplete when a sub-item is unchecked", async () => {
    addTask(getDefaultListId(), "Plan trip");
    addTask(getDefaultListId(), "Book flights", 1);
    toggleTask(2);
    toggleTask(1);

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("j"); // select the sub-item
    await delay();
    stdin.write(" "); // uncheck it
    await delay();

    expect(loadTasks(getDefaultListId()).find((t) => t.id === 1)?.done).toBe(false);

    unmount();
  });

  it("blocks deleting a main item with sub-items and shows a message instead of prompting", async () => {
    addTask(getDefaultListId(), "Plan trip");
    addTask(getDefaultListId(), "Book flights", 1);

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("d");
    await delay();

    expect(lastFrame()).not.toContain("(y/n)");
    expect(lastFrame()).toContain("Delete all sub-items first.");
    expect(loadTasks(getDefaultListId())).toHaveLength(2);

    unmount();
  });

  it("clears a shown message on the next navigation keypress", async () => {
    addTask(getDefaultListId(), "Plan trip");
    addTask(getDefaultListId(), "Book flights", 1);

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write(" ");
    await delay();
    expect(lastFrame()).toContain("Complete all sub-items before completing this item.");

    stdin.write("j");
    await delay();

    expect(lastFrame()).not.toContain("Complete all sub-items before completing this item.");

    unmount();
  });

  it("shows Todos highlighted in the sidebar by default and switches to Settings with Tab", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    expect(lastFrame()).toContain("Todos");
    expect(lastFrame()).toContain("Settings");
    expect(lastFrame()).not.toContain("Window width");

    stdin.write("\t");
    await delay();

    expect(lastFrame()).toContain("Window width");
    expect(lastFrame()).toContain("Window height");

    unmount();
  });

  it("cycles backward through pages with Shift+Tab", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[Z"); // Shift+Tab
    await delay();

    expect(lastFrame()).toContain("Window width");

    unmount();
  });

  it("creates a new list with Ctrl+N and switches to it", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x0E"); // Ctrl+N
    await delay();
    stdin.write("Coding Todos");
    await delay();
    stdin.write("\r");
    await delay();

    expect(loadLists().map((l) => l.name)).toEqual(["Todos", "Coding Todos"]);
    expect(lastFrame()).toContain("Coding Todos");
    expect(lastFrame()).toContain("No tasks yet. Press a to add one.");

    unmount();
  });

  it("cancels new-list creation with Escape", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x0E"); // Ctrl+N
    await delay();
    stdin.write("Abandoned");
    await delay();
    stdin.write("\x1B"); // Escape
    await delay();

    expect(loadLists().map((l) => l.name)).toEqual(["Todos"]);
    expect(lastFrame()).not.toContain("Abandoned");

    unmount();
  });

  it("renames the current list with r and reflects it in the sidebar", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("r");
    await delay();
    await backspace(stdin, 5); // remove "Todos"
    stdin.write("Personal");
    await delay();
    stdin.write("\r");
    await delay();

    expect(loadLists()[0]?.name).toBe("Personal");
    expect(lastFrame()).toContain("Personal");
    expect(lastFrame()).not.toContain("Todos");

    unmount();
  });

  it("stops content keys from responding after Left moves focus to the sidebar", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left arrow -> nav focus
    await delay();
    stdin.write(" "); // would toggle done if content still had focus
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.done).toBe(false);

    unmount();
  });

  it("restores content keys after Right moves focus back from the sidebar", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left -> nav focus
    await delay();
    stdin.write("\x1B[C"); // Right -> content focus
    await delay();
    stdin.write(" ");
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.done).toBe(true);

    unmount();
  });

  it("keeps the content pane visible while the sidebar has focus", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left -> nav focus
    await delay();

    expect(lastFrame()).toContain("Buy milk");

    unmount();
  });

  it("cycles pages with Up/Down while the sidebar has focus, same as Tab", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left -> nav focus
    await delay();
    stdin.write("\x1B[B"); // Down -> Settings
    await delay();

    expect(lastFrame()).toContain("Window width");

    stdin.write("\x1B[A"); // Up -> back to Todos
    await delay();

    expect(lastFrame()).not.toContain("Window width");

    unmount();
  });

  it("does not move the task selection with Up/Down while the sidebar has focus", async () => {
    addTask(getDefaultListId(), "Buy milk");
    addTask(getDefaultListId(), "Walk the dog");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left -> nav focus
    await delay();
    stdin.write("\x1B[B"); // Down (cycles to Settings, should not touch task selection)
    await delay();
    stdin.write("\x1B[A"); // Up (back to Todos)
    await delay();
    stdin.write("\x1B[C"); // Right -> content focus
    await delay();
    stdin.write(" "); // toggle whatever is still selected

    await delay();

    const tasks = loadTasks(getDefaultListId());
    expect(tasks.find((t) => t.text === "Buy milk")?.done).toBe(true);
    expect(tasks.find((t) => t.text === "Walk the dog")?.done).toBe(false);

    unmount();
  });

  it("renames a list from the sidebar without entering its content", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left -> nav focus
    await delay();
    stdin.write("r");
    await delay();
    await backspace(stdin, 5); // remove "Todos"
    stdin.write("Personal");
    await delay();
    stdin.write("\r");
    await delay();

    expect(loadLists()[0]?.name).toBe("Personal");
    expect(lastFrame()).toContain("Personal");
    expect(lastFrame()).not.toContain("Todos");

    unmount();
  });

  it("cancels a sidebar rename with Escape and leaves the name unchanged", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left -> nav focus
    await delay();
    stdin.write("r");
    await delay();
    stdin.write("Discarded");
    await delay();
    stdin.write("\x1B"); // Escape
    await delay();

    expect(loadLists()[0]?.name).toBe("Todos");
    expect(lastFrame()).not.toContain("Discarded");

    unmount();
  });

  it("does nothing when r is pressed with the sidebar focused on Settings", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x1B[D"); // Left -> nav focus
    await delay();
    stdin.write("\x1B[B"); // Down -> Settings row
    await delay();
    stdin.write("r");
    await delay();

    expect(lastFrame()).not.toContain("Rename list:");
    expect(loadLists().map((l) => l.name)).toEqual(["Todos"]);

    unmount();
  });

  it("keeps each list's tasks and selection independent when switching with Tab", async () => {
    addTask(getDefaultListId(), "Default list task");

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("\x0E"); // Ctrl+N
    await delay();
    stdin.write("Second list");
    await delay();
    stdin.write("\r");
    await delay();

    expect(lastFrame()).not.toContain("Default list task");

    stdin.write("\t"); // Second list -> Settings
    await delay();
    stdin.write("\t"); // Settings -> back to first list (Todos)
    await delay();

    expect(lastFrame()).toContain("Default list task");

    unmount();
  });

  it("does not switch pages with Tab while add-mode text entry is active", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("a");
    await delay();
    stdin.write("\t");
    await delay();

    expect(lastFrame()).not.toContain("Window width");

    unmount();
  });

  it("edits the selected task's text and saves with Enter", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("e");
    await delay();
    await backspace(stdin, 4); // remove "milk"
    stdin.write("eggs");
    await delay();
    stdin.write("\r");
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.text).toBe("Buy eggs");

    unmount();
  });

  it("edits the selected task's text and saves via Tab to the Save button", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("e");
    await delay();
    await backspace(stdin, 4);
    stdin.write("eggs");
    await delay();
    stdin.write("\t"); // input -> priority
    await delay();
    stdin.write("\t"); // priority -> save
    await delay();
    stdin.write("\r");
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.text).toBe("Buy eggs");

    unmount();
  });

  it("discards edits when Escape is pressed", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("e");
    await delay();
    stdin.write("zzz");
    await delay();
    stdin.write("\x1B");
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.text).toBe("Buy milk");

    unmount();
  });

  it("discards edits when tabbing to Cancel and pressing Enter", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("e");
    await delay();
    stdin.write("zzz");
    await delay();
    stdin.write("\t"); // input -> priority
    await delay();
    stdin.write("\t"); // priority -> save
    await delay();
    stdin.write("\t"); // save -> cancel
    await delay();
    stdin.write("\r");
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.text).toBe("Buy milk");

    unmount();
  });

  it("toggles the priority flag from the edit modal and saves it", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("e");
    await delay();
    stdin.write("\t"); // input -> priority
    await delay();
    stdin.write(" "); // toggle priority on
    await delay();
    stdin.write("\t"); // priority -> save
    await delay();
    stdin.write("\r");
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.priority).toBe(true);

    unmount();
  });

  it("does not switch pages with Tab while the edit modal is open", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("e");
    await delay();
    stdin.write("\t");
    await delay();

    expect(lastFrame()).not.toContain("Window width");

    unmount();
  });

  it("blocks saving an edit that clears all the task's text", async () => {
    addTask(getDefaultListId(), "Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("e");
    await delay();
    await backspace(stdin, 8); // remove "Buy milk"
    stdin.write("\r");
    await delay();

    expect(loadTasks(getDefaultListId())[0]?.text).toBe("Buy milk");

    unmount();
  });

  it("saves an edited window width from the Settings page and applies it live", async () => {
    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("\t"); // switch to Settings
    await delay();
    stdin.write("\r"); // start editing width
    await delay();
    stdin.write("100");
    await delay();
    stdin.write("\r"); // submit
    await delay();

    expect(loadSettings().width).toBe(100);

    unmount();
  });
});
