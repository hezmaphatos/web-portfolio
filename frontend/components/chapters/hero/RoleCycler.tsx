"use client";

import { useRef } from "react";

import { useMotionGate } from "@/components/chapters/shared/motion";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";
import { useHudStore } from "@/lib/store";

type Props = { roles: string[] };

/**
 * Hero roles (spec §4.1): a typewriter that cycles one role at a time in a single slot.
 * The full list stays in the DOM for screen readers and is what you see without JS, in Lite
 * mode and wherever it wraps onto 3+ lines. With motion on, the list fades to opacity 0 — still
 * in the accessibility tree and still holding its space, so nothing shifts — and an aria-hidden
 * slot types over it.
 */
export function RoleCycler({ roles }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { ready, lite } = useMotionGate();
  const boot = useHudStore((state) => state.boot);
  // Starts when the Hero is revealed (or right away if there is no splash), not under it.
  const typing = ready && !lite && boot === "done" && roles.length > 1;

  useGSAP(
    () => {
      const slot = root.current?.querySelector<HTMLElement>("[data-role-slot]");
      if (!typing || !slot) return;
      const mm = gsap.matchMedia();
      // desktop/mobile are listed so the check below runs again when the layout switches.
      mm.add({ desktop: MEDIA.desktop, mobile: MEDIA.mobile, reduce: MEDIA.reduce }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        const list = root.current?.querySelector<HTMLElement>("[data-hero-roles]");
        const firstRole = list?.querySelector("li");
        if (!list || !firstRole) return;
        // The hidden list keeps its space (no layout shift), so a list that wraps onto 3+ lines
        // (phones) would leave a big gap under a one-line slot: keep the plain list there.
        if (list.offsetHeight > firstRole.offsetHeight * 2.5) return;
        gsap.to(list, { opacity: 0, duration: 0.3 });
        gsap.fromTo(slot.parentElement, { opacity: 0 }, { opacity: 1, duration: 0.3 });

        // One proxy drives the whole loop: `shown` = how many letters of roles[index] are out.
        const proxy = { index: 0, shown: roles[0].length };
        const render = () => {
          slot.textContent = roles[proxy.index].slice(0, Math.round(proxy.shown));
        };
        render();

        const loop = gsap.timeline({ repeat: -1 });
        roles.forEach((role, i) => {
          const next = (i + 1) % roles.length;
          loop
            .to(
              proxy,
              { shown: 0, duration: role.length * 0.03, ease: "none", onUpdate: render },
              "+=1.9",
            )
            .set(proxy, { index: next }) // swap the word while the slot is empty
            .to(proxy, {
              shown: roles[next].length,
              duration: roles[next].length * 0.055,
              ease: "none",
              onUpdate: render,
            });
        });

        // Only type while the Hero is on screen: an endless loop nobody sees is wasted frames.
        const observer = new IntersectionObserver(([entry]) =>
          entry.isIntersecting ? loop.play() : loop.pause(),
        );
        observer.observe(slot);
        return () => {
          observer.disconnect();
          slot.textContent = roles[0];
        };
      });
    },
    { scope: root, dependencies: [typing], revertOnUpdate: true },
  );

  if (roles.length === 0) return null;

  return (
    <div ref={root} className="relative">
      <ul
        data-hero-roles
        aria-label="Roles"
        className="flex flex-wrap gap-x-4 gap-y-1 text-2xl font-bold md:text-3xl"
      >
        {roles.map((role, i) => (
          <li key={role} className="flex items-center gap-4">
            {i > 0 ? (
              <span aria-hidden="true" className="text-hot">
                /
              </span>
            ) : null}
            {role}
          </li>
        ))}
      </ul>
      {typing ? (
        <p
          aria-hidden="true"
          className="absolute inset-x-0 top-0 flex items-center text-2xl font-bold whitespace-nowrap opacity-0 md:text-3xl"
        >
          <span className="text-hot mr-3">▸</span>
          <span data-role-slot>{roles[0]}</span>
          <span className="hk-caret" />
        </p>
      ) : null}
    </div>
  );
}
