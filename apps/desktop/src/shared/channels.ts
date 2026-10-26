/** IPC channel names, shared by the preload script and the main process. */
export const channelFor = (method: string): string => `taskfile:${method}`;

/** Pushed from the main process to the window whenever the update state changes. */
export const UPDATE_STATE_CHANNEL = "taskfile:update-state";
