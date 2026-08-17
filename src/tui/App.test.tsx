import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { render } from "ink-testing-library";
import { App } from "./App.js";
import { addTask, loadTasks } from "../store.js";

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
});
