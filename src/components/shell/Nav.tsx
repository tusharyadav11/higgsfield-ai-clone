"use client";
import { logout } from "@/lib/server-sync";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, Compass, Gift, Home, Library, LogIn, LogOut, MoreHorizontal, Plug, Plus, Settings, Tag, Zap } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useStore } from "@/lib/store";
import { useMounted, useNarrow } from "@/components/growth/hooks";
import { HelpMenu } from "@/components/guide";

const main = [
  { id: "home", href: "/", label: "Home", icon: Home },
  { id: "explore", href: "/explore", label: "Explore", icon: Compass },
  { id: "create", href: "/create", label: "Create", icon: Plus },
  { id: "library", href: "/library", label: "Library", icon: Library },
] as const;
const extras = [
  { id: "pricing", href: "/pricing", label: "Pricing", icon: Tag },
  { id: "referrals", href: "/referrals", label: "Referrals", icon: Gift },
  { id: "enterprise", href: "/enterprise", label: "Enterprise", icon: Building2 },
  { id: "connect", href: "/connect", label: "Connect", icon: Plug },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
] as const;

const linkCls = (active: boolean) =>
  cn(
    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition",
    "sm:min-h-12 sm:rounded-xl sm:text-[10px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm",
    active ? "text-accent" : "text-muted hover:text-fg",
  );

/**
 * One <nav>, one set of links (unique data-testids), laid out by CSS:
 * phone = bottom bar of 5 (Home, Explore, Create, Library, More; extras open as a sheet),
 * sm = icon rail, lg = labelled sidebar.
 */
export function Nav() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const mounted = useMounted();
  const narrow = useNarrow();
  const user = useStore((s) => s.user);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const extraActive = extras.some((e) => isActive(e.href));
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed z-40 border-line bg-bg/95 backdrop-blur",
        "inset-x-0 bottom-0 border-t pb-safe",
        "sm:inset-y-0 sm:right-auto sm:w-[72px] sm:overflow-y-auto sm:border-r sm:border-t-0 sm:pb-0 sm:pt-safe",
        "lg:w-56",
      )}
    >
      <Link href="/" className="hidden min-h-14 items-center gap-2 px-5 text-lg font-bold tracking-tight lg:flex">
        <Zap className="size-5 text-accent" aria-hidden /> Kinetic
      </Link>
      <ul className="flex items-stretch justify-around sm:flex-col sm:justify-start sm:gap-1 sm:px-2 sm:pt-2 lg:px-3">
        {main.map(({ id, href, label, icon: Icon }) => {
          const active = isActive(href);
          const isCreate = id === "create";
          return (
            <li key={id} className="flex-1 sm:flex-none">
              <Link
                href={href}
                data-testid={`nav-${id}`}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                onClick={() => setMore(false)}
                className={cn(linkCls(active), !isCreate && active && "sm:bg-surface-2")}
              >
                {isCreate ? (
                  <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg max-sm:-mt-5 max-sm:size-14 max-sm:ring-4 max-sm:ring-bg sm:size-10 lg:size-8">
                    <Icon className="size-6 lg:size-5" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : (
                  <Icon className="size-5" aria-hidden />
                )}
                <span className={cn(isCreate && "max-sm:sr-only", "sm:max-lg:sr-only")}>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1 sm:hidden">
          <button
            type="button"
            aria-label="More"
            aria-expanded={more}
            data-testid="nav-more"
            onClick={() => setMore((v) => !v)}
            className={cn(linkCls(more || extraActive), "w-full")}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <span>More</span>
          </button>
        </li>
      </ul>
      <ul
        className={cn(
          "flex-col gap-1 sm:flex sm:px-2 sm:pb-2 lg:px-3",
          // phone: a sheet above the bar, only when opened
          "max-sm:absolute max-sm:inset-x-2 max-sm:bottom-[calc(100%+8px)] max-sm:rounded-2xl max-sm:border max-sm:border-line max-sm:bg-surface max-sm:p-2 max-sm:shadow-2xl",
          more ? "max-sm:flex" : "max-sm:hidden",
        )}
      >
        <li className="hidden h-px bg-line sm:block" aria-hidden />
        {extras.map(({ id, href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={id}>
              <Link
                href={href}
                data-testid={`nav-${id}`}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                onClick={() => setMore(false)}
                className={cn(
                  linkCls(active),
                  "max-sm:min-h-12 max-sm:flex-row max-sm:justify-start max-sm:gap-3 max-sm:rounded-xl max-sm:px-3 max-sm:text-sm",
                  active && "sm:bg-surface-2",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="sm:max-lg:sr-only">{label}</span>
              </Link>
            </li>
          );
        })}
        {mounted && narrow && (
          <>
            <li className="sm:hidden"><div className="flex min-h-12 items-center px-3"><HelpMenu /></div></li>
            <li className="sm:hidden">
              {user ? (
                <button type="button" data-testid="logout-btn-mobile" onClick={() => { void logout(); setMore(false); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted hover:text-fg">
                  <LogOut className="size-5" aria-hidden /> Log out ({user.name})
                </button>
              ) : (
                <Link href="/login" data-testid="signin-mobile" onClick={() => setMore(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:text-fg">
                  <LogIn className="size-5" aria-hidden /> Sign in
                </Link>
              )}
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
