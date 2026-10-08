import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";
import { FilePlus2, Files, LayoutTemplate, Lock, Menu, Moon, Settings, Sun, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "new_invoice", icon: FilePlus2, locked: false },
  { to: "/invoices", label: "invoices", icon: Files, locked: true },
  { to: "/templates", label: "templates", icon: LayoutTemplate, locked: true },
  { to: "/clients", label: "clients", icon: Users, locked: true },
  { to: "/settings", label: "settings", icon: Settings, locked: true },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-7 place-items-center rounded-md border border-border bg-surface-2 font-mono text-sm font-bold">
        <span className="text-accent">&gt;</span>
        <span className="sr-only">Invoice Builder</span>
      </div>
      <div className="leading-tight">
        <div className="font-mono text-sm font-semibold tracking-tight">
          invoice<span className="text-accent">_</span>builder
        </div>
        <div className="font-mono text-[10px] text-muted">tinytools.work</div>
      </div>
    </div>
  );
}

function ApiStatus() {
  const [state, setState] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => setState(r.ok ? "online" : "offline"))
      .catch(() => setState("offline"));
  }, []);
  const color = state === "online" ? "bg-accent" : state === "offline" ? "bg-danger" : "bg-warn";
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
      <span className={cn("size-1.5 rounded-full", color)} />
      api: {state}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Logo />
      <nav className="flex flex-col gap-0.5">
        <div className="mb-1 px-2 font-mono text-[10px] uppercase tracking-widest text-muted">// workspace</div>
        {NAV.map(({ to, label, icon: Icon, locked }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2.5 rounded-md px-2 py-1.5 font-mono text-[13px] transition-colors",
                isActive ? "bg-accent-soft text-text" : "text-muted hover:bg-surface-2 hover:text-text",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("size-4", isActive && "text-accent")} />
                <span className="flex-1">{label}</span>
                {locked && <Lock className="size-3 opacity-50" aria-label="Sign in required" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="font-mono text-xs text-text">guest mode</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Create and download freely. Sign in to save invoices and templates.
          </p>
          <Button variant="primary" size="sm" className="mt-3 w-full font-mono text-xs" disabled title="Coming in milestone 4">
            sign_in()
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <ApiStatus />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-bg md:block">
        <Sidebar />
      </aside>

      {/* mobile */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
        <Logo />
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </Button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-bg">
            <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => setOpen(false)} aria-label="Close menu">
              <X />
            </Button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
