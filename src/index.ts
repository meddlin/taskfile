#!/usr/bin/env node

process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && /SQLite/i.test(warning.message)) {
    return;
  }
  console.warn(warning);
});

import { Command } from "commander";
import { addItem } from "./commands/add.js";
import { removeItem } from "./commands/remove.js";
import { listItems } from "./commands/list.js";
import { runTui } from "./tui/index.js";

const program = new Command();

program.name("taskfile").description("A simple todo list CLI").version("0.1.0");

program
  .command("add <text...>")
  .description("Add a new task")
  .action((text: string[]) => {
    addItem(text.join(" "));
  });

program
  .command("remove <id>")
  .description("Remove a task by id")
  .action((id: string) => {
    removeItem(Number(id));
  });

program
  .command("list")
  .description("List all tasks")
  .action(() => {
    listItems();
  });

program
  .command("tui", { isDefault: true, hidden: true })
  .description("Launch the interactive TUI")
  .action(async () => {
    if (!process.stdin.isTTY) {
      program.help();
      return;
    }
    await runTui();
  });

await program.parseAsync();
