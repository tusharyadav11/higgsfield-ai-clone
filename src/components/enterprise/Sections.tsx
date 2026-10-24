"use client";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, CalendarClock, Check, Clapperboard, Coins, GraduationCap, Layers, Megaphone, MessageSquareQuote, Palette, Percent, Plug, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { ENTERPRISE_FEATURES } from "@/lib/plans";
import { formatCents, formatNum, type Estimate } from "@/lib/enterprise/pricing";
import { Reveal } from "./Reveal";
import { scrollToSection } from "./AnchorNav";
import { card } from "./Calculator";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.14em] text-accent-text";
const h2 = "mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl";

export function Hero({ est, onDemo }: { est: Estimate; onDemo: () => void }) {
  return (
    <section id="overview" aria-labelledby="hero-h" className="relative scroll-mt-28 pb-14 pt-12 sm:pb-20 sm:pt-20 lg:pt-24">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(40rem_22rem_at_20%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_70%),radial-gradient(34rem_20rem_at_90%_10%,color-mix(in_oklab,var(--accent)_8%,transparent),transparent_70%)] [mask-image:linear-gradient(to_bottom,#000_60%,transparent)]" />
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--glow)]" /> Kinetic for teams
          </p>
          <h1 id="hero-h" className="mt-5 text-[2.25rem] font-semibold leading-[1.05] tracking-tight min-[400px]:text-5xl sm:text-6xl">
            One credit pool for your <span className="bg-gradient-to-r from-fg to-accent-text bg-clip-text text-transparent">whole creative team</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Shared credits, volume pricing and a team workspace for image and video generation. Size your team, see an indicative price, then ask us for a quote.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" data-testid="ent-cta-quote" onClick={() => scrollToSection("quote", true)}>
              <MessageSquareQuote className="size-5" aria-hidden /> Request a quote
            </Button>
            <Button size="lg" variant="secondary" data-testid="demo-open" onClick={onDemo}>
              <CalendarClock className="size-5" aria-hidden /> Book a demo
            </Button>
            <Link href="/enterprise/workspace/team" data-testid="ent-cta-workspace" className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-medium text-muted transition-colors hover:text-fg">
              Open workspace demo <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-5 max-w-xl text-xs text-muted">
            Prices are indicative and billing is not live. SSO, SLA and invoice billing are available on request and need configuration; none of them is active in this demo.
          </p>
        </div>

        {/* live preview of the calculator state: every number is computed, none is invented */}
        <div className="min-w-0 fade-up [--d:2]">
          <div className={`${card} relative overflow-hidden p-5 sm:p-6`} data-testid="ent-hero-card">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_30%,transparent),transparent)]" />
            <p className="relative text-sm text-muted">Your configuration, live</p>
            <p className="relative mt-1 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
              {est.custom ? "from " : ""}{formatCents(est.monthlyTotalCents)}<span className="text-base font-normal text-muted"> / month</span>
            </p>
            <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Seats", formatNum(est.seats)],
                ["Shared credits", `${formatNum(est.totalPool)} / mo`],
                ["Volume discount", est.custom ? "Custom" : `${est.pct}%`],
                ["Billing", est.billing === "annual" ? "Annual" : "Monthly"],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-xl bg-surface-2 p-3">
                  <p className="text-xs text-muted">{k}</p>
                  <p className="truncate font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(6, (est.seats / 500) * 100))}%` }} />
              </div>
              <p className="mt-2 flex justify-between text-xs text-muted"><span>1 seat</span><span>500+ custom</span></p>
            </div>
            <Button variant="secondary" className="relative mt-5 w-full" onClick={() => scrollToSection("calculator")}>
              Adjust in the calculator <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const BENEFITS = [
  { icon: Coins, title: "One shared credit pool", body: "Each seat adds credits to a single monthly pool, so a busy week for one person is covered by someone else's quiet one." },
  { icon: Percent, title: "Volume pricing", body: "Indicative discounts from 10 seats, with a custom tier at 500+. Add-on packs are priced at the Pro credit rate." },
  { icon: Layers, title: "Team workspace", body: "A demo workspace with members, projects and a shared library shows how a team could organise its work." },
  { icon: BarChart3, title: "Usage you can see", body: "A usage view in the demo workspace shows where credits go, so budgets are a conversation, not a surprise." },
  { icon: ShieldCheck, title: "Admin and security options", body: "SSO, audit and an uptime SLA are available on request and need configuration. None of them is active in this demo." },
  { icon: Plug, title: "API and MCP", body: "API keys and an MCP server for agents exist in the product, with a Developers tab in the demo workspace." },
] as const;

const USE_CASES = [
  { icon: Megaphone, title: "Agencies", body: "Run client work from one pool and one library instead of a plan per person." },
  { icon: Building2, title: "In-house brand teams", body: "Keep campaign prompts and assets where the whole team can start from what already works." },
  { icon: Clapperboard, title: "Studios", body: "Give concept and previs teams a shared credit budget that leads can keep an eye on." },
  { icon: GraduationCap, title: "Education", body: "One pool for a class or lab, so students experiment without individual subscriptions." },
] as const;

export function Benefits() {
  return (
    <section id="benefits" aria-labelledby="ben-h" className="scroll-mt-28 py-14 sm:py-20">
      <Reveal>
        <p className={eyebrow}>Why teams</p>
        <h2 id="ben-h" className={h2}>Built for people who make things together</h2>
        <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">What Kinetic for teams gives you today, and what is available on request.</p>
      </Reveal>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((b, i) => (
          <Reveal as="li" key={b.title} delay={(i % 3) * 70}>
            <div data-spot className={`${card} spot spot-fill lift h-full overflow-hidden p-5 sm:p-6`}>
              <span className="relative z-10 inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-accent-text"><b.icon className="size-5" aria-hidden /></span>
              <h3 className="relative z-10 mt-4 text-lg font-semibold">{b.title}</h3>
              <p className="relative z-10 mt-1.5 text-sm leading-relaxed text-muted">{b.body}</p>
            </div>
          </Reveal>
        ))}
      </ul>
      <Reveal className="mt-14">
        <h3 className="flex items-center gap-2 text-xl font-semibold"><Users className="size-5 text-accent-text" aria-hidden /> Who it is for</h3>
      </Reveal>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="ent-usecases">
        {USE_CASES.map((u, i) => (
          <Reveal as="li" key={u.title} delay={i * 60}>
            <div data-spot className={`${card} spot spot-fill lift h-full overflow-hidden p-5`}>
              <u.icon className="relative z-10 size-5 text-accent-text" aria-hidden />
              <h4 className="relative z-10 mt-3 font-semibold">{u.title}</h4>
              <p className="relative z-10 mt-1 text-sm leading-relaxed text-muted">{u.body}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

/** Honest availability labels for the Enterprise column (nothing here is active in the demo). */
const NOTE: Record<string, string> = {
  "SSO (SAML / OIDC)": "On request, needs configuration",
  "99.9% uptime SLA": "On request, not active in this demo",
  "Invoice billing": "On request, billing is not live",
};

export function Comparison() {
  return (
    <section id="compare" aria-labelledby="cmp-h" className="scroll-mt-28 py-14 sm:py-20">
      <Reveal>
        <p className={eyebrow}>Team vs Enterprise</p>
        <h2 id="cmp-h" className={h2}>What you get</h2>
        <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">Items marked “On request” are not switched on by default. They need configuration and a conversation first.</p>
      </Reveal>
      {/* wide: a real table */}
      <Reveal className={`${card} mt-8 hidden overflow-hidden md:block`}>
        <table className="w-full text-left text-sm" data-testid="ent-compare">
          <caption className="sr-only">Feature comparison between Team (Studio) and Enterprise</caption>
          <thead className="bg-surface-2/60 text-muted">
            <tr>
              <th scope="col" className="px-6 py-4 font-medium">Feature</th>
              <th scope="col" className="px-6 py-4 font-medium">Team (Studio)</th>
              <th scope="col" className="px-6 py-4 font-medium">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {ENTERPRISE_FEATURES.map((f) => (
              <tr key={f.name} className="border-t border-line transition-colors hover:bg-surface-2/40">
                <th scope="row" className="px-6 py-4 text-base font-medium">{f.name}</th>
                <td className="px-6 py-4"><Tick on={f.team} /></td>
                <td className="px-6 py-4"><Tick on={f.enterprise} note={!f.team ? NOTE[f.name] : undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      {/* narrow: stacked cards */}
      <ul className="mt-8 grid gap-3 md:hidden" data-testid="ent-compare-stacked">
        {ENTERPRISE_FEATURES.map((f) => (
          <li key={f.name} className={`${card} p-4`}>
            <p className="font-medium">{f.name}</p>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2">
              <div className="rounded-xl bg-surface-2 p-3"><dt className="text-xs text-muted">Team (Studio)</dt><dd className="mt-1"><Tick on={f.team} /></dd></div>
              <div className="rounded-xl bg-surface-2 p-3"><dt className="text-xs text-muted">Enterprise</dt><dd className="mt-1"><Tick on={f.enterprise} note={!f.team ? NOTE[f.name] : undefined} /></dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tick({ on, note }: { on: boolean; note?: string }) {
  if (!on)
    return <span className="inline-flex items-center gap-2 text-muted"><span aria-hidden>&mdash;</span><span className="sr-only">Not included</span><span aria-hidden className="text-sm">Not included</span></span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Check className="size-4 shrink-0 text-accent-text" aria-hidden />
      <span className="text-sm">{note ? "Available" : "Included"}</span>
      {note && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{note}</span>}
    </span>
  );
}

export function FinalCta({ onDemo }: { onDemo: () => void }) {
  return (
    <section aria-labelledby="final-h" className="py-14 sm:py-20" data-testid="ent-final">
      <Reveal className={`${card} relative overflow-hidden px-5 py-12 text-center sm:px-10 sm:py-16`}>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(36rem_16rem_at_50%_0%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_72%)]" />
        <Palette className="relative mx-auto size-7 text-accent-text" aria-hidden />
        <h2 id="final-h" className="relative mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Ready to put your team on one pool?</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-base text-muted sm:text-lg">Send us your configuration and a person will reply with a written quote. Or look around the demo workspace first.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" data-testid="ent-final-quote" onClick={() => scrollToSection("quote", true)}>Request a quote</Button>
          <Button size="lg" variant="secondary" data-testid="demo-open-final" onClick={onDemo}>Book a demo</Button>
          <Link href="/enterprise/workspace/team" data-testid="ent-final-workspace" className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-medium text-muted hover:text-fg">
            Open workspace demo <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
