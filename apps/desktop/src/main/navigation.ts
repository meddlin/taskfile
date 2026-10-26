// What the window may do when a page tries to navigate or open a new window. The app's own origin
// stays in the window; web links go to the user's browser; everything else (file:, custom schemes,
// javascript:) is refused.
export type NavigationDecision = "allow" | "external" | "deny";

export function decideNavigation(target: string, appOrigin: string): NavigationDecision {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return "deny";
  }
  if (url.origin === appOrigin) return "allow";
  if (url.protocol === "https:" || url.protocol === "http:") return "external";
  return "deny";
}
