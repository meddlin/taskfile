import { useEffect, useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import { theme } from "./theme.js";

const WAVE_INTERVAL_MS = 120;
const WAVE_WIDTH = 3;
const WAVE_COLOR = "cyanBright"; // bright counterpart of theme.accent ("cyan")
const FILLED_CHAR = "▓";
const EMPTY_CHAR = "░";

export function ProgressBar({
  done,
  total,
  width,
  animated,
}: {
  done: number;
  total: number;
  width: number;
  animated: boolean;
}): ReactElement {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animated) return;
    const interval = setInterval(() => setTick((t) => t + 1), WAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [animated]);

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const label = `Progress ${percent} % `;
  const barWidth = Math.max(width - label.length, 0);
  const filledWidth = Math.min(barWidth, Math.round((percent / 100) * barWidth));
  const emptyWidth = barWidth - filledWidth;

  const segments: { text: string; color?: string; dim?: boolean }[] = [];

  if (animated && filledWidth > 0) {
    const waveCenter = tick % filledWidth;
    const waveStart = Math.max(0, waveCenter - Math.floor(WAVE_WIDTH / 2));
    const waveEnd = Math.min(filledWidth, waveStart + WAVE_WIDTH);

    if (waveStart > 0) segments.push({ text: FILLED_CHAR.repeat(waveStart), color: theme.accent });
    segments.push({ text: FILLED_CHAR.repeat(waveEnd - waveStart), color: WAVE_COLOR });
    if (filledWidth > waveEnd) segments.push({ text: FILLED_CHAR.repeat(filledWidth - waveEnd), color: theme.accent });
  } else if (filledWidth > 0) {
    segments.push({ text: FILLED_CHAR.repeat(filledWidth), color: theme.accent });
  }

  if (emptyWidth > 0) {
    segments.push({ text: EMPTY_CHAR.repeat(emptyWidth), dim: true });
  }

  return (
    <Box>
      <Text bold color={theme.accent}>
        {label}
      </Text>
      {segments.map((segment, index) => (
        <Text key={index} color={segment.color} dimColor={segment.dim}>
          {segment.text}
        </Text>
      ))}
    </Box>
  );
}
