import { createFileRoute } from "@tanstack/react-router";
import { BackgroundPicker } from "~/components/background-picker";
import { PageNav } from "~/components/PageNav";
import { ThemeToggle } from "~/components/theme-toggle";
import { formatBytes } from "~/lib/format";
import { getDataLocation } from "~/server/functions";

export const Route = createFileRoute("/settings")({
  loader: () => getDataLocation(),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="font-bold">
        <span className="text-accent">#</span> {title}
      </h2>
      {children}
    </section>
  );
}

function SettingsPage() {
  const location = Route.useLoaderData();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-bold">
          <span className="text-accent">$</span> taskfile settings
          <span aria-hidden className="animate-blink ml-1 inline-block h-[1em] w-[0.6em] translate-y-[0.15em] bg-accent" />
        </h1>
        <PageNav />
      </header>

      <Section title="color scheme">
        <ThemeToggle />
        <p className="text-muted-foreground">system follows your device's light or dark setting.</p>
      </Section>

      <Section title="background">
        <BackgroundPicker />
      </Section>

      <Section title="data">
        <p className="text-muted-foreground">tasks are stored in this SQLite database:</p>
        <code className="block bg-highlight px-3 py-2 break-all">{location.path}</code>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">location</dt>
          <dd>{location.source === "environment" ? "set by TASKFILE_DB" : "default (shared with the taskfile CLI)"}</dd>
          <dt className="text-muted-foreground">size</dt>
          <dd>{location.exists && location.sizeBytes !== null ? formatBytes(location.sizeBytes) : "not created yet"}</dd>
        </dl>
        <p className="text-muted-foreground">
          your color scheme and background are saved in this browser only, not in the database.
        </p>
      </Section>
    </main>
  );
}
