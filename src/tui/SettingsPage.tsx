import { useEffect, useState, type ReactElement } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { saveSettings, type Settings } from "../settings.js";

type Field = "width" | "height";
type Mode = "view" | "edit";

const FIELDS: { key: Field; label: string }[] = [
  { key: "width", label: "Window width" },
  { key: "height", label: "Window height" },
];

export function SettingsPage({
  active,
  settings,
  onSettingsChange,
  setMessage,
  onNavLockChange,
}: {
  active: boolean;
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  setMessage: (message: string | undefined) => void;
  onNavLockChange: (locked: boolean) => void;
}): ReactElement {
  const { exit } = useApp();
  const [selectedField, setSelectedField] = useState(0);
  const [mode, setMode] = useState<Mode>("view");
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    onNavLockChange(mode === "edit");
  }, [mode, onNavLockChange]);

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

  if (!active) return <></>;

  return (
    <Box flexDirection="column">
      <Text bold>Settings</Text>
      <Text> </Text>
      {FIELDS.map(({ key, label }, index) => {
        const isSelected = active && mode === "view" && index === selectedField;
        const isEditing = active && mode === "edit" && index === selectedField;

        return (
          <Box key={key}>
            <Text inverse={isSelected}>{label}: </Text>
            {isEditing ? (
              <TextInput
                value={editValue}
                onChange={setEditValue}
                onSubmit={submitEdit}
                placeholder={String(settings[key])}
              />
            ) : (
              <Text>{settings[key]}</Text>
            )}
          </Box>
        );
      })}
      <Text> </Text>
      {mode === "view" && <Text dimColor>↑/k ↓/j select · enter edit · Tab TODOs · q quit</Text>}
      {mode === "edit" && <Text dimColor>enter save · esc cancel</Text>}
    </Box>
  );
}
