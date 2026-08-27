import { useEffect, useState, type ReactElement } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { pruneSnapshots } from "../snapshots.js";
import { saveSettings, SNAPSHOT_RETENTION_OPTIONS, type Settings, type SnapshotRetention } from "../settings.js";

type Mode = "view" | "edit";

type FieldDescriptor =
  | { key: "width" | "height"; label: string; type: "number" }
  | { key: "progressAnimation" | "dailySnapshotsEnabled"; label: string; type: "boolean" }
  | {
      key: "dailySnapshotRetention";
      label: string;
      type: "select";
      options: readonly SnapshotRetention[];
      formatOption: (value: SnapshotRetention) => string;
    };

const VIEW_HINT = "↑/k ↓/j select · enter edit · space toggle · ←/→ nav focus · Tab lists · Ctrl+N new list · q quit";
const EDIT_HINT = "enter save · esc cancel";

const RETENTION_LABELS: Record<SnapshotRetention, string> = {
  "1-week": "1 week",
  "1-month": "1 month",
  "3-months": "3 months",
  "6-months": "6 months",
  "12-months": "12 months",
  forever: "Forever",
};

const FIELDS: FieldDescriptor[] = [
  { key: "width", label: "Window width", type: "number" },
  { key: "height", label: "Window height", type: "number" },
  { key: "progressAnimation", label: "Progress bar animation", type: "boolean" },
  { key: "dailySnapshotsEnabled", label: "Daily snapshots", type: "boolean" },
  {
    key: "dailySnapshotRetention",
    label: "Snapshot retention",
    type: "select",
    options: SNAPSHOT_RETENTION_OPTIONS,
    formatOption: (value) => RETENTION_LABELS[value],
  },
];

export function SettingsPage({
  visible,
  active,
  settings,
  onSettingsChange,
  setMessage,
  onNavLockChange,
  onHintChange,
}: {
  visible: boolean;
  active: boolean;
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  setMessage: (message: string | undefined) => void;
  onNavLockChange: (locked: boolean) => void;
  onHintChange: (hint: string) => void;
}): ReactElement {
  const { exit } = useApp();
  const [selectedField, setSelectedField] = useState(0);
  const [mode, setMode] = useState<Mode>("view");
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    onNavLockChange(mode === "edit");
    if (active) {
      onHintChange(mode === "view" ? VIEW_HINT : EDIT_HINT);
    }
  }, [mode, active, onNavLockChange, onHintChange]);

  useInput(
    (input, key) => {
      if (mode === "edit") {
        if (key.escape) {
          setMode("view");
        }
        return;
      }

      // mode === "view"
      setMessage(undefined);

      if (input === "q") {
        exit();
        return;
      }

      if (key.upArrow || input === "k") {
        setSelectedField((index) => Math.max(index - 1, 0));
        return;
      }

      if (key.downArrow || input === "j") {
        setSelectedField((index) => Math.min(index + 1, FIELDS.length - 1));
        return;
      }

      const field = FIELDS[selectedField]!;

      if (field.type === "boolean" && (input === " " || key.return)) {
        const next = saveSettings({ [field.key]: !settings[field.key] } as Partial<Settings>);
        onSettingsChange(next);
        return;
      }

      if (field.type === "select" && (input === " " || key.return)) {
        const currentValue = settings[field.key];
        const currentOptionIndex = field.options.indexOf(currentValue);
        const nextValue = field.options[(currentOptionIndex + 1) % field.options.length]!;
        const next = saveSettings({ [field.key]: nextValue } as Partial<Settings>);
        onSettingsChange(next);
        pruneSnapshots(nextValue);
        return;
      }

      if (key.return) {
        setEditValue("");
        setMode("edit");
      }
    },
    { isActive: active },
  );

  function submitEdit(text: string): void {
    const field = FIELDS[selectedField]!.key;
    const parsed = Number.parseInt(text, 10);

    if (Number.isNaN(parsed)) {
      setMessage("Please enter a whole number.");
      setMode("view");
      return;
    }

    const next = saveSettings({ [field]: parsed });
    onSettingsChange(next);
    setMessage(
      next[field] === parsed ? "Saved." : `Saved (clamped to ${next[field]}).`,
    );
    setMode("view");
  }

  if (!visible) return <></>;

  return (
    <Box flexDirection="column">
      <Text bold>Settings</Text>
      <Text> </Text>
      {FIELDS.map((field, index) => {
        const isSelected = visible && mode === "view" && index === selectedField;
        const isEditing = visible && mode === "edit" && index === selectedField;

        if (field.type === "boolean") {
          const value = settings[field.key];
          return (
            <Box key={field.key}>
              <Text inverse={isSelected}>
                [{value ? "x" : " "}] {field.label}
              </Text>
            </Box>
          );
        }

        if (field.type === "select") {
          const value = settings[field.key];
          return (
            <Box key={field.key}>
              <Text inverse={isSelected}>
                {field.label}: {field.formatOption(value)}
              </Text>
            </Box>
          );
        }

        return (
          <Box key={field.key}>
            <Text inverse={isSelected}>{field.label}: </Text>
            {isEditing ? (
              <TextInput
                value={editValue}
                onChange={setEditValue}
                onSubmit={submitEdit}
                placeholder={String(settings[field.key])}
              />
            ) : (
              <Text>{settings[field.key]}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
