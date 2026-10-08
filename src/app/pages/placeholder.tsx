export function PlaceholderPage({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-8">
      <div className="font-mono text-xs text-muted">~/{title}</div>
      <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
        {title}
        <span className="caret-blink text-accent">_</span>
      </h1>
      <p className="mt-3 text-sm text-muted">{note}</p>
      <div className="mt-8 rounded-lg border border-dashed border-border-strong p-6 font-mono text-xs text-muted">
        <span className="text-accent">$</span> coming soon
      </div>
    </div>
  );
}
