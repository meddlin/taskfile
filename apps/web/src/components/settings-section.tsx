export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="font-bold">
        <span className="text-accent">#</span> {title}
      </h2>
      {children}
    </section>
  );
}
