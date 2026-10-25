import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { setDataLocation } from "~/server/functions";

export function DataLocationForm({ currentPath, locked }: { currentPath: string; locked: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(currentPath);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await setDataLocation({ data: { path: value } });
      if (result.ok) {
        setMessage({ error: false, text: result.copied ? "saved. your tasks were copied to the new file." : "saved." });
        await router.invalidate();
      } else {
        setMessage({ error: true, text: result.error });
      }
    } catch {
      setMessage({ error: true, text: "Could not reach the server." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="db-path" className="text-muted-foreground">
        database file
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="db-path"
          value={value}
          disabled={locked || pending}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 border border-border bg-background px-3 py-2 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={locked || pending || value.trim() === currentPath}
          className="cursor-pointer border border-border px-3 py-2 hover:border-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "saving…" : "change location"}
        </button>
      </div>
      {message && (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-red-500" : "text-accent"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
