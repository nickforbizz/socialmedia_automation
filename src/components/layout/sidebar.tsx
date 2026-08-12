"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Film,
  CalendarDays,
  BarChart3,
  Users,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Nav items. Routes beyond dashboard/media are Phase 2+ and marked disabled. */
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/media", label: "Media Library", icon: Film, ready: true },
  { href: "/planner", label: "Content Planner", icon: Sparkles, ready: false },
  { href: "/calendar", label: "Scheduler", icon: CalendarDays, ready: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3, ready: true },
  { href: "/competitors", label: "Competitors", icon: Users, ready: false },
  { href: "/settings", label: "Settings", icon: Settings, ready: true },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-semibold">AI Social</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV.map(({ href, label, icon: Icon, ready }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const base =
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors";
          if (!ready) {
            return (
              <span
                key={href}
                aria-disabled
                title="Coming in a later phase"
                className={cn(base, "cursor-not-allowed text-muted-foreground/50")}
              >
                <Icon className="h-4 w-4" />
                {label}
              </span>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                base,
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
