// React picks its development or production build the first time it is imported, based on
// NODE_ENV. The development build records ~10 `performance.measure` entries per render, and Node
// buffers those forever. The TUI re-renders ~10 times a second for its animations, so a
// long-running session leaked ~3 KB per render until the process hit the V8 heap limit (~28 hours
// at 4 GB). This module must be imported before anything that imports react or ink.
process.env.NODE_ENV = "production";
