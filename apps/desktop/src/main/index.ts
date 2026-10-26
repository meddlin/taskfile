import { app, BrowserWindow, ipcMain, Menu, session, shell } from "electron";
import { randomBytes } from "node:crypto";
import * as path from "node:path";
import { TOKEN_HEADER } from "./guard";
import { registerUpdateIpc } from "./ipc";
import { menuTemplate } from "./menu";
import { decideNavigation } from "./navigation";
import { runSmokeTest } from "./smokeTest";
import { createElectronUpdates } from "./updater";
import { startWebServer, type RunningServer } from "./webServer";

const smokeTest = process.argv.includes("--smoke-test");

// Packaged: electron-builder copies apps/web's client build to Resources/client. In development
// it's the copy scripts/build.mjs puts next to the bundle.
const clientDir = app.isPackaged
  ? path.join(process.resourcesPath, "client")
  : path.join(import.meta.dirname, "client");

let mainWindow: BrowserWindow | undefined;

function createWindow(server: RunningServer): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 400,
    // Avoids a white flash before the page paints; the web app picks light or dark itself.
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(import.meta.dirname, "preload.cjs"),
    },
  });
  window.once("ready-to-show", () => window.show());

  const handle = (url: string): "allow" | "blocked" => {
    const decision = decideNavigation(url, server.origin);
    if (decision === "external") void shell.openExternal(url);
    return decision === "allow" ? "allow" : "blocked";
  };
  window.webContents.setWindowOpenHandler(({ url }) => {
    handle(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (details) => {
    if (handle(details.url) === "blocked") details.preventDefault();
  });
  window.webContents.on("will-redirect", (details) => {
    if (handle(details.url) === "blocked") details.preventDefault();
  });

  window.on("closed", () => {
    mainWindow = undefined;
  });
  void window.loadURL(`${server.origin}/`);
  mainWindow = window;
}

async function main(): Promise<void> {
  if (!smokeTest && !app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  await app.whenReady();

  const token = randomBytes(32).toString("hex");
  const server = await startWebServer({ clientDir, token });

  const updates = createElectronUpdates({ userData: app.getPath("userData"), prepareToQuit: () => server.close() });

  if (smokeTest) {
    try {
      await runSmokeTest(server, token, await updates.manager.getUpdateState());
      console.log("SMOKE PASS");
      app.exit(0);
    } catch (error) {
      console.error(`SMOKE FAIL: ${error instanceof Error ? error.message : String(error)}`);
      app.exit(1);
    }
    return;
  }

  // The window's own requests carry the token; see guard.ts.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${server.origin}/*`] }, (details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, [TOKEN_HEADER]: token } });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(menuTemplate({ isMac: process.platform === "darwin", devTools: !app.isPackaged })),
  );

  registerUpdateIpc({
    ipcMain,
    updates: updates.manager,
    isTrustedUrl: (url) => decideNavigation(url, server.origin) === "allow",
  });
  updates.installMenuItem();
  updates.manager.start();

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on("activate", () => {
    if (!mainWindow) createWindow(server);
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    void server.close();
  });

  createWindow(server);
}

main().catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});
