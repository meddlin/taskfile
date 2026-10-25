import { Link } from "@tanstack/react-router";

const linkClass =
  "border-b border-transparent py-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground";
const activeClass = { className: "border-accent text-accent" };

// Switches between the views: the per-list task page, the cross-list status board and settings.
export function PageNav() {
  return (
    <nav aria-label="Views" className="flex items-center gap-4">
      <Link to="/" className={linkClass} activeProps={activeClass} activeOptions={{ exact: true }}>
        tasks
      </Link>
      <Link to="/board" className={linkClass} activeProps={activeClass}>
        board
      </Link>
      <Link to="/settings" className={linkClass} activeProps={activeClass}>
        settings
      </Link>
    </nav>
  );
}
