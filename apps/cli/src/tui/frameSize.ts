export interface FrameSize {
  width: number;
  height: number;
}

// Ink switches to a clear-and-redraw mode once the output is as tall as the
// terminal, so leave the last row free to keep rendering flicker-free.
const RESERVED_ROWS = 1;

// The width/height settings are maximums: the frame shrinks to fit a smaller
// terminal instead of overflowing it, and follows the terminal as it resizes.
export function fitFrameToWindow(configured: FrameSize, window: { columns: number; rows: number }): FrameSize {
  return {
    width: Math.max(Math.min(configured.width, window.columns), 1),
    height: Math.max(Math.min(configured.height, window.rows - RESERVED_ROWS), 1),
  };
}
