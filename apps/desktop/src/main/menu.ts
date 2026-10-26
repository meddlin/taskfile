import type { MenuItemConstructorOptions } from "electron";

export function menuTemplate(options: { isMac: boolean; devTools: boolean }): MenuItemConstructorOptions[] {
  const view: MenuItemConstructorOptions[] = [
    { role: "reload" },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];
  if (options.devTools) view.splice(1, 0, { role: "toggleDevTools" });

  return [
    ...(options.isMac ? [{ role: "appMenu" } as const] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { label: "View", submenu: view },
    { role: "windowMenu" },
  ];
}
