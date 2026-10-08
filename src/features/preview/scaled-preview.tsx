import { useLayoutEffect, useRef, useState } from "react";
import type { InvoiceData } from "@shared/invoice";
import { InvoiceDocument, PAGE_WIDTH } from "./invoice-document";

/** Renders the invoice at true A4 width and scales it down to fit its container. */
export function ScaledPreview({ invoice }: { invoice: InvoiceData }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      const s = Math.min(1, o.clientWidth / PAGE_WIDTH);
      setScale(s);
      setHeight(i.offsetHeight * s);
    };
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    update();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="w-full overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_32px_-8px_rgba(0,0,0,.25)]" style={{ height }}>
      <div
        ref={inner}
        className="origin-top-left"
        style={{ transform: `scale(${scale})`, width: PAGE_WIDTH }}
      >
        <InvoiceDocument invoice={invoice} />
      </div>
    </div>
  );
}
