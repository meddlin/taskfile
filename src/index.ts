#!/usr/bin/env node

import { Command } from "commander";
import { addItem } from "./commands/add";
import { removeItem } from "./commands/remove";
import { listItems } from "./commands/list";

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

program.parse();
