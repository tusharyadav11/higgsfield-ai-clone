"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, FolderKanban, KeyRound, ShieldCheck, Users } from "lucide-react";

export const WORKSPACE_TABS = [
  { href: "/enterprise/workspace/team", label: "Team", icon: Users, id: "team" },
  { href: "/enterprise/workspace/usage", label: "Usage", icon: BarChart3, id: "usage" },
  { href: "/enterprise/workspace/projects", label: "Projects", icon: FolderKanban, id: "projects" },
  { href: "/enterprise/workspace/security", label: "Security", icon: ShieldCheck, id: "security" },
  { href: "/enterprise/workspace/billing", label: "Billing", icon: CreditCard, id: "billing" },
  { href: "/enterprise/workspace/developers", label: "Developers", icon: KeyRound, id: "developers" },
] as const;

export function WorkspaceTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Workspace sections" className="sticky top-14 z-20 -mx-3 border-b border-line bg-bg/80 px-3 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
      <ul className="scrollbar-none flex gap-1 overflow-x-auto py-2">
        {WORKSPACE_TABS.map(({ href, label, icon: Icon, id }) => {
          const on = path === href;
          return (
            <li key={id} className="shrink-0">
              <Link
                href={href}
                data-testid={`ws-tab-${id}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${on ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
