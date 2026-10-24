"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

/** Captures ?ref=CODE from the URL on any page into the store (read after mount, no Suspense needed). */
export function RefCapture() {
  const setPendingRef = useStore((s) => s.setPendingRef);
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setPendingRef(ref);
    } catch {}
  }, [setPendingRef]);
  return null;
}
