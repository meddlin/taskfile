import { createFileRoute } from "@tanstack/react-router";
import { DataLocationForm } from "~/components/data-location-form";
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

const SOURCE_LABEL = {
  environment: "set by TASKFILE_DB (change it there)",
  settings: "chosen on this page",
  default: "default",
} as const;

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
          <dd>{SOURCE_LABEL[location.source]}</dd>
          <dt className="text-muted-foreground">size</dt>
          <dd>{location.exists && location.sizeBytes !== null ? formatBytes(location.sizeBytes) : "not created yet"}</dd>
        </dl>
        <DataLocationForm key={location.path} currentPath={location.path} locked={location.source === "environment"} />
        <p className="text-muted-foreground">
          an existing database is copied to a new file; one already there is used as it is. under Docker, only files inside the
          mounted data folder (/data) land on your machine; the folder itself is set by TASKFILE_DATA_DIR when you start compose.
        </p>
        <p className="text-muted-foreground">
          your color scheme and background are saved in this browser only, not in the database.
        </p>
      </Section>
    </main>
  );
}
