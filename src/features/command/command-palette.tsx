import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { useLocation, useNavigate } from "react-router";
import {
  Download,
  FilePlus2,
  Files,
  LayoutTemplate,
  LogIn,
  LogOut,
  Moon,
  Printer,
  Save,
  Search,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { formatMinor } from "@shared/money";
import { useSignInDialog } from "@/features/auth/sign-in-dialog";
import { blankInvoice, invoiceFromProfile, partyFrom, useEditor } from "@/features/editor/store";
import { useStartFromTemplate } from "@/features/templates/use-start-from-template";
import { signOut, useSession } from "@/lib/auth-client";
import { runEditorCommand } from "@/lib/commands";
import { queryClient, useClients, useInvoices, useProfile, useTemplates } from "@/lib/queries";
import { toggleTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const useCommandPalette = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}));

type Item = { id: string; group: string; label: string; hint?: string; icon: ReactNode; keywords?: string; run: () => void };

const ic = (Icon: typeof Zap) => <Icon className="size-4" />;

function score(item: Item, q: string): number {
  if (!q) return 1;
  const hay = `${item.label} ${item.keywords ?? ""} ${item.group}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => hay.includes(w))) return 0;
  return item.label.toLowerCase().startsWith(words[0]) ? 2 : 1;
}

export function CommandPalette() {
  const { open, set } = useCommandPalette();
  const navigate = useNavigate();
  const location = useLocation();
  const signedIn = !!useSession().data;
  const showSignIn = useSignInDialog((s) => s.show);
  const profile = useProfile().data;
  const templates = useTemplates().data;
  const clients = useClients().data;
  const invoices = useInvoices().data;
  const { start } = useStartFromTemplate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global shortcut: ⌘K / Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set(!useCommandPalette.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setQ("");
      setActive(0);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const onEditor = location.pathname === "/" || location.pathname.startsWith("/invoices/");

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => navigate(path);
    const out: Item[] = [];
    if (onEditor) {
      out.push(
        { id: "save", group: "invoice", label: "Save invoice", hint: "⌘S", icon: ic(Save), run: () => runEditorCommand("save") },
        { id: "pdf", group: "invoice", label: "Download PDF", hint: "⌘⇧E", icon: ic(Download), run: () => runEditorCommand("pdf") },
        { id: "print", group: "invoice", label: "Print", hint: "⌘P", icon: ic(Printer), run: () => runEditorCommand("print") },
        { id: "tpl", group: "invoice", label: "Save as template", icon: ic(LayoutTemplate), run: () => runEditorCommand("template") },
      );
    }
    out.push(
      {
        id: "new",
        group: "go to",
        label: "New invoice",
        icon: ic(FilePlus2),
        keywords: "create blank",
        run: () => {
          useEditor.getState().reset(profile ? invoiceFromProfile(profile) : blankInvoice());
          navigate("/");
        },
      },
      { id: "invoices", group: "go to", label: "Invoices", icon: ic(Files), run: go("/invoices") },
      { id: "templates", group: "go to", label: "Templates", icon: ic(LayoutTemplate), run: go("/templates") },
      { id: "clients", group: "go to", label: "Clients", icon: ic(Users), run: go("/clients") },
      { id: "settings", group: "go to", label: "Settings", icon: ic(Settings), keywords: "profile numbering defaults export", run: go("/settings") },
    );
    for (const t of templates ?? [])
      out.push({
        id: `t:${t.id}`,
        group: "new from template",
        label: t.name,
        keywords: `template ${t.tags.join(" ")}`,
        icon: ic(Zap),
        run: () => start(t.id),
      });
    for (const c of clients ?? [])
      out.push({
        id: `c:${c.id}`,
        group: "invoice a client",
        label: c.name,
        hint: c.email,
        keywords: `client bill ${c.email}`,
        icon: ic(Users),
        run: () => {
          const base = profile ? invoiceFromProfile(profile) : blankInvoice();
          useEditor
            .getState()
            .startFromTemplate({ ...base, to: partyFrom(c) }, null);
          navigate("/");
        },
      });
    for (const i of invoices ?? [])
      out.push({
        id: `i:${i.id}`,
        group: "open invoice",
        label: `${i.number}${i.clientName ? ` · ${i.clientName}` : ""}`,
        hint: formatMinor(i.totalMinor, i.currency),
        keywords: `invoice open ${i.project}`,
        icon: ic(Files),
        run: go(`/invoices/${i.id}`),
      });
    out.push({ id: "theme", group: "preferences", label: "Toggle light / dark theme", icon: ic(Moon), keywords: "dark mode light", run: toggleTheme });
    out.push(
      signedIn
        ? {
            id: "out",
            group: "account",
            label: "Sign out",
            icon: ic(LogOut),
            run: async () => {
              await signOut();
              queryClient.clear();
              if (useEditor.getState().savedId) useEditor.getState().reset();
              navigate("/");
            },
          }
        : { id: "in", group: "account", label: "Sign in", icon: ic(LogIn), keywords: "login github google", run: () => showSignIn() },
    );
    return out;
  }, [onEditor, templates, clients, invoices, profile, signedIn, navigate, start, showSignIn]);

  const results = useMemo(() => {
    const term = q.trim();
    const scored = items.map((it) => ({ it, s: score(it, term) })).filter((x) => x.s > 0);
    // Keep big groups short so the palette stays scannable.
    const perGroup = new Map<string, number>();
    const limited = scored.filter(({ it }) => {
      const n = (perGroup.get(it.group) ?? 0) + 1;
      perGroup.set(it.group, n);
      return term ? n <= 8 : n <= (it.group === "go to" || it.group === "invoice" ? 10 : 3);
    });
    return limited.sort((a, b) => b.s - a.s).map((x) => x.it);
  }, [items, q]);

  // Groups in order of first appearance.
  const grouped = useMemo(() => {
    const groups: { name: string; items: Item[] }[] = [];
    for (const it of results) {
      let g = groups.find((x) => x.name === it.group);
      if (!g) groups.push((g = { name: it.group, items: [] }));
      g.items.push(it);
    }
    return groups;
  }, [results]);
  const flat = grouped.flatMap((g) => g.items);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (it: Item | undefined) => {
    if (!it) return;
    set(false);
    it.run();
  };

  let index = -1;
  return (
    <dialog
      ref={dialog}
      onClose={() => set(false)}
      onClick={(e) => e.target === dialog.current && set(false)}
      className="mx-auto mt-[12vh] w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-xl border border-border-strong bg-surface p-0 text-text shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex max-h-[min(520px,70vh)] flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, flat.length - 1)));
                else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
                else if (e.key === "Enter") (e.preventDefault(), run(flat[active]));
              }}
              placeholder={signedIn ? "Type a command, template, client or invoice…" : "Type a command…"}
              className="h-12 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted/70"
              aria-label="Command"
              role="combobox"
              aria-expanded
              aria-controls="cmd-list"
              aria-activedescendant={flat[active] ? `cmd-${flat[active].id}` : undefined}
            />
            <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted">esc</kbd>
          </div>
          <div ref={listRef} id="cmd-list" role="listbox" className="overflow-y-auto p-2">
            {flat.length === 0 && <div className="px-3 py-8 text-center font-mono text-xs text-muted">no results</div>}
            {grouped.map((g) => (
              <div key={g.name} className="mb-1">
                <div className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted">{g.name}</div>
                {g.items.map((it) => {
                  index++;
                  const i = index;
                  return (
                    <div
                      key={it.id}
                      id={`cmd-${it.id}`}
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(it)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                        i === active ? "bg-accent-soft text-text" : "text-text/90",
                      )}
                    >
                      <span className={cn("text-muted", i === active && "text-accent")}>{it.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      {it.hint && <span className="max-w-40 shrink-0 truncate font-mono text-[11px] text-muted">{it.hint}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex gap-4 border-t border-border px-4 py-2 font-mono text-[10px] text-muted">
            <span>↑↓ navigate</span>
            <span>↵ run</span>
            <span>⌘K toggle</span>
          </div>
        </div>
      )}
    </dialog>
  );
}
