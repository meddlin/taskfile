import { render } from "ink";
import { App } from "./App.js";
import { loadSettings } from "../settings.js";
import { runStartupSnapshotMaintenance } from "../snapshots.js";

export async function runTui(): Promise<void> {
  runStartupSnapshotMaintenance(loadSettings());
  // Use the terminal's alternate screen (like vim/htop) so earlier shell output
  // isn't visible around the app, and is restored when the TUI exits.
  const { waitUntilExit } = render(<App />, { alternateScreen: true });
  await waitUntilExit();
}
