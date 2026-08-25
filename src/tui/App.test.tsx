import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { render } from "ink-testing-library";
import { App } from "./App.js";
import { addTask, loadTasks, toggleTask } from "../store.js";
import { loadSettings } from "../settings.js";

function delay(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    addTask("Buy milk");
    addTask("Walk the dog");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("j");
    await delay();
    stdin.write(" ");
    await delay();

    const tasks = loadTasks();
    expect(tasks.find((t) => t.text === "Walk the dog")?.done).toBe(true);
    expect(tasks.find((t) => t.text === "Buy milk")?.done).toBe(false);

    unmount();
  });

  it("removes the selected task after confirming with y", async () => {
    addTask("Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("d");
    await delay();
    stdin.write("y");
    await delay();

    expect(loadTasks()).toHaveLength(0);

    unmount();
  });

  it("does not remove the selected task when the delete is cancelled", async () => {
    addTask("Buy milk");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("d");
    await delay();
    stdin.write("n");
    await delay();

    expect(loadTasks()).toHaveLength(1);

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

    const tasks = loadTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe("Write plan doc");

    unmount();
  });

  it("adds a sub-item under the selected main item with s", async () => {
    addTask("Plan trip");

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("s");
    await delay();
    stdin.write("Book flights");
    await delay();
    stdin.write("\r");
    await delay();

    const tasks = loadTasks();
    const subItem = tasks.find((t) => t.text === "Book flights");
    expect(subItem?.parentId).toBe(1);

    unmount();
  });

  it("adds a sibling sub-item when s is pressed with a sub-item selected", async () => {
    addTask("Plan trip");
    addTask("Book flights", 1);

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

    const tasks = loadTasks();
    const sibling = tasks.find((t) => t.text === "Book hotel");
    expect(sibling?.parentId).toBe(1);

    unmount();
  });

  it("blocks completing a main item with an incomplete sub-item and shows a message", async () => {
    addTask("Plan trip");
    addTask("Book flights", 1);

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write(" "); // try to complete the main item
    await delay();

    expect(loadTasks().find((t) => t.id === 1)?.done).toBe(false);
    expect(lastFrame()).toContain("Complete all sub-items before completing this item.");

    unmount();
  });

  it("reverts an already-complete main item to incomplete when a sub-item is unchecked", async () => {
    addTask("Plan trip");
    addTask("Book flights", 1);
    toggleTask(2);
    toggleTask(1);

    const { stdin, unmount } = render(<App />);
    await delay();

    stdin.write("j"); // select the sub-item
    await delay();
    stdin.write(" "); // uncheck it
    await delay();

    expect(loadTasks().find((t) => t.id === 1)?.done).toBe(false);

    unmount();
  });

  it("blocks deleting a main item with sub-items and shows a message instead of prompting", async () => {
    addTask("Plan trip");
    addTask("Book flights", 1);

    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    stdin.write("d");
    await delay();

    expect(lastFrame()).not.toContain("(y/n)");
    expect(lastFrame()).toContain("Delete all sub-items first.");
    expect(loadTasks()).toHaveLength(2);

    unmount();
  });

  it("clears a shown message on the next navigation keypress", async () => {
    addTask("Plan trip");
    addTask("Book flights", 1);

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

  it("shows TODOs highlighted in the sidebar by default and switches to Settings with Tab", async () => {
    const { stdin, lastFrame, unmount } = render(<App />);
    await delay();

    expect(lastFrame()).toContain("TODOs");
    expect(lastFrame()).toContain("Settings");
    expect(lastFrame()).not.toContain("Window width");

    stdin.write("\t");
    await delay();

    expect(lastFrame()).toContain("Window width");
    expect(lastFrame()).toContain("Window height");

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
