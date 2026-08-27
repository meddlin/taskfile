import { render } from "ink";
import { App } from "./App.js";
import { loadSettings } from "../settings.js";
import { runStartupSnapshotMaintenance } from "../snapshots.js";

export async function runTui(): Promise<void> {
  runStartupSnapshotMaintenance(loadSettings());
  const { waitUntilExit } = render(<App />);
  await waitUntilExit();
}
