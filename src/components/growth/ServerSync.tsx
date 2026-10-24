"use client";
import { useEffect } from "react";
import { hydrate, isServerUser } from "@/lib/server-sync";

/** Loads the signed-in account from the server on page load and whenever the tab becomes visible again. */
export function ServerSync() {
  useEffect(() => {
    void hydrate();
    const onVis = () => {
      if (document.visibilityState === "visible" && isServerUser()) void hydrate();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return null;
}
