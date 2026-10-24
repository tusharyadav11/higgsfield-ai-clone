"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CALC, computeQuote, parseCalcSearch, serializeCalc, type CalcState } from "@/lib/enterprise/pricing";
import { useServerInfo } from "@/lib/server-info";
import { AnchorNav } from "./AnchorNav";
import { Benefits, Comparison, FinalCta, Hero } from "./Sections";
import { Calculator, card } from "./Calculator";
import { QuoteSummary } from "./QuoteSummary";
import { RequestForm } from "./RequestForm";
import { DemoDialog } from "./DemoDialog";
import { Faq } from "./Faq";
import { Reveal } from "./Reveal";

export function EnterpriseView() {
  const [calc, setCalcState] = useState<CalcState>(DEFAULT_CALC);
  const [demo, setDemo] = useState(false);
  const dirty = useRef(false);
  const serverDb = useServerInfo((s) => s.db);

  // read the shared configuration after mount (never during prerender)
  useEffect(() => {
    const fromUrl = parseCalcSearch(window.location.search);
    if (window.location.search) queueMicrotask(() => setCalcState(fromUrl));
    const id = window.location.hash.slice(1);
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 60);
  }, []);
  // keep the URL in sync once the person changes something
  useEffect(() => {
    if (!dirty.current) return;
    try {
      history.replaceState(null, "", `${window.location.pathname}?${serializeCalc(calc)}${window.location.hash}`);
    } catch {}
  }, [calc]);

  const setCalc = useCallback((f: (s: CalcState) => CalcState) => {
    dirty.current = true;
    setCalcState(f);
  }, []);
  const est = useMemo(() => computeQuote(calc), [calc]);
  const openDemo = useCallback(() => setDemo(true), []);

  return (
    <div className="-mt-4" data-testid="enterprise-page">
      <AnchorNav />
      <div className="mx-auto w-full max-w-6xl">
        <Hero est={est} onDemo={openDemo} />
        <Benefits />
        <Calculator calc={calc} setCalc={setCalc} est={est} />
        <Comparison />
        <QuoteSummary est={est} calc={calc} onDemo={openDemo} />
        <section id="quote" aria-labelledby="quote-h" className="scroll-mt-28 py-14 sm:py-20">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">Request a quote</p>
            <h2 id="quote-h" className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Tell us about your team</h2>
            <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">
              Your calculator configuration is sent along.{" "}
              {serverDb === false
                ? "Demo mode: no database is configured, so a request is not stored anywhere."
                : "If a database is connected the request is saved; this demo does not send email, so nobody is notified automatically."}
            </p>
          </Reveal>
          <Reveal className={`${card} relative mt-8 p-5 sm:p-8`}>
            <RequestForm kind="quote" est={est} calc={calc} />
          </Reveal>
        </section>
        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-28 py-14 sm:py-20">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">FAQ</p>
            <h2 id="faq-h" className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Straight answers</h2>
          </Reveal>
          <Reveal className="mt-8 max-w-3xl">
            <Faq />
          </Reveal>
        </section>
        <FinalCta onDemo={openDemo} />
      </div>
      <DemoDialog open={demo} onClose={() => setDemo(false)} est={est} calc={calc} />
    </div>
  );
}
