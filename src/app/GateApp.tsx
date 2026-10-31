"use client";

import { useEffect, useRef } from "react";
import { mount } from "@/client/app";

/** Hosts the mockup's renderer; everything inside #root is drawn by src/client. */
export function GateApp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? mount(ref.current) : undefined), []);
  return (
    <>
      <div id="root" ref={ref} />
      <div id="toast" role="status" aria-live="polite" />
    </>
  );
}
