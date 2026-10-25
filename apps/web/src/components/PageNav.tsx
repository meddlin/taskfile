import { Link } from "@tanstack/react-router";

const linkClass =
  "border-b border-transparent py-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground";
const activeClass = { className: "border-accent text-accent" };

// Switches between the two views: the per-list task page and the cross-list status board.
export function PageNav() {
  return (
    <nav aria-label="Views" className="flex items-center gap-4">
      <Link to="/" className={linkClass} activeProps={activeClass} activeOptions={{ exact: true }}>
        tasks
      </Link>
      <Link to="/board" className={linkClass} activeProps={activeClass}>
        board
      </Link>
    </nav>
  );
}
