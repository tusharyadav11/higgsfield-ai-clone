"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Library, Plus, Tag, Zap } from "lucide-react";
import { cn } from "@/components/ui/cn";

const items = [
  { id: "home", href: "/", label: "Home", icon: Home },
  { id: "explore", href: "/explore", label: "Explore", icon: Compass },
  { id: "create", href: "/create", label: "Create", icon: Plus },
  { id: "library", href: "/library", label: "Library", icon: Library },
  { id: "pricing", href: "/pricing", label: "Pricing", icon: Tag },
] as const;

/**
 * One <nav>, one set of links (unique data-testids), laid out by CSS:
 * phone = bottom tab bar, sm = icon rail, lg = labelled sidebar.
 */
export function Nav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed z-40 border-line bg-bg/95 backdrop-blur",
        "inset-x-0 bottom-0 border-t pb-safe",
        "sm:inset-y-0 sm:right-auto sm:w-[72px] sm:border-r sm:border-t-0 sm:pb-0 sm:pt-safe",
        "lg:w-56",
      )}
    >
      <Link
        href="/"
        className="hidden min-h-14 items-center gap-2 px-5 text-lg font-bold tracking-tight lg:flex"
      >
        <Zap className="size-5 text-accent" aria-hidden /> Kinetic
      </Link>
      <ul className="flex items-stretch justify-around sm:flex-col sm:justify-start sm:gap-1 sm:px-2 sm:py-2 lg:px-3">
        {items.map(({ id, href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          const isCreate = id === "create";
          return (
            <li key={id} className="flex-1 sm:flex-none">
              <Link
                href={href}
                data-testid={`nav-${id}`}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition",
                  "sm:min-h-12 sm:rounded-xl sm:text-[10px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm",
                  active ? "text-accent" : "text-muted hover:text-fg",
                  !isCreate && active && "sm:bg-surface-2",
                )}
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
      </ul>
    </nav>
  );
}
