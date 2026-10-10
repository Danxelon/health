/**
 * Nav hide-on-scroll.
 *
 * The nav sinks when the user scrolls down to read, and returns on any upward
 * scroll. Two lines of ScrollTrigger with a locked tween — no custom scroll
 * math, and fully disabled under `prefers-reduced-motion`.
 */

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useScrollNav<T extends HTMLElement>(ref: RefObject<T | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect the platform's "reduce motion" for the whole animation, not just
    // the transform — otherwise the user gets a moving interface anyway.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const y = gsap.quickTo(el, "y", { duration: 0.32, ease: "power2.out" });
    let lastY = 0;
    let hidden = false;

    const onScroll = () => {
      const current = window.scrollY;
      if (current < 40) {
        if (hidden) {
          hidden = false;
          y(0);
        }
        lastY = current;
        return;
      }

      const isDown = current > lastY + 4;
      const isUp = current < lastY - 4;
      lastY = current;

      if (isDown && !hidden) {
        hidden = true;
        y(-88);
      } else if (isUp && hidden) {
        hidden = false;
        y(0);
      }
    };

    ScrollTrigger.create({ start: 0, end: "max", onUpdate: onScroll });
    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      gsap.set(el, { clearProps: "transform" });
    };
  }, [ref]);
}