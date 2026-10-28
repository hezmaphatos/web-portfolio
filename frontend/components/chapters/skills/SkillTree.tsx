"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { onFirstPointer, useMotionGate } from "@/components/chapters/shared/motion";
import { useStageHint } from "@/components/game/useStageHint";
import { Draggable, gsap, MEDIA, useGSAP } from "@/lib/gsap";

import { NODE_HELP_ID } from "./NodeTitle";
import { litSkill, useTreeFocus } from "./treeFocus";

type Props = {
  /** sections.hint of the Skill Tree ("Pick up to 4 skills for your loadout: …"). */
  hint: string | null;
  className?: string;
  children: ReactNode;
};

/** Toggles a boolean data attribute without touching the DOM when nothing changes. */
function flag(el: HTMLElement, name: string, on: boolean) {
  if (on === el.hasAttribute(name)) return;
  if (on) el.setAttribute(name, "");
  else el.removeAttribute(name);
}

/**
 * Client island of the skill graph (spec §4.1 skills), wrapping the server-rendered branches:
 * - lights a node ([data-skill-card]) on hover, keyboard focus or click/tap (pinned): the node
 *   gets `data-active`, and every project card on the page whose [data-project-id] is in the
 *   node's [data-project-ids] gets `data-highlight` (outlined in Level Select);
 * - nodes are a toy: drag one (mouse) and it springs back to its place (Draggable + elastic);
 * - registers the Skill Tree stage hint.
 * The equip mechanics live in <Armory> (inventory, loadout, Training Dummy).
 */
export function SkillTree({ hint, className, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { ready, lite } = useMotionGate();

  useStageHint("skills", hint, root);

  // ── Highlight ────────────────────────────────────────────────────────
  useEffect(() => {
    const tree = root.current;
    if (!tree) return;
    const nodes = Array.from(tree.querySelectorAll<HTMLElement>("[data-skill-card]"));
    const { setPreview, unpin } = useTreeFocus.getState();

    const apply = (skillId: number | null) => {
      let projects: string[] = [];
      let name = "";
      for (const node of nodes) {
        const on = skillId !== null && node.dataset.skillId === String(skillId);
        flag(node, "data-active", on);
        if (on) {
          projects = (node.dataset.projectIds ?? "").split(" ").filter(Boolean);
          name = node.dataset.skillName ?? "";
        }
      }
      // Project cards anywhere on the page (Level Select cartridges and grid cards).
      for (const card of document.querySelectorAll<HTMLElement>("[data-project-id]")) {
        const on = projects.includes(card.dataset.projectId ?? "");
        if (on) card.dataset.highlight = name;
        else if (card.dataset.highlight !== undefined) delete card.dataset.highlight;
      }
    };

    const nodeOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-skill-card]") : null;
    const idOf = (node: HTMLElement | null) => (node ? Number(node.dataset.skillId) : null);

    // Hover = mouse only (a tap is a click, which pins). Focus = keyboard browsing.
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setPreview(idOf(nodeOf(event.target)));
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setPreview(null);
    };
    const onFocusIn = (event: FocusEvent) => setPreview(idOf(nodeOf(event.target)));
    const onFocusOut = (event: FocusEvent) => {
      if (!nodeOf(event.relatedTarget)) setPreview(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && useTreeFocus.getState().pinned !== null) unpin();
    };

    tree.addEventListener("pointerover", onOver);
    tree.addEventListener("pointerleave", onLeave);
    tree.addEventListener("focusin", onFocusIn);
    tree.addEventListener("focusout", onFocusOut);
    tree.addEventListener("keydown", onKey);
    apply(litSkill(useTreeFocus.getState()));
    const unsubscribe = useTreeFocus.subscribe((state) => apply(litSkill(state)));

    return () => {
      tree.removeEventListener("pointerover", onOver);
      tree.removeEventListener("pointerleave", onLeave);
      tree.removeEventListener("focusin", onFocusIn);
      tree.removeEventListener("focusout", onFocusOut);
      tree.removeEventListener("keydown", onKey);
      unsubscribe();
      setPreview(null);
      apply(null);
    };
  }, []);

  // ── Toy: drag a node, it springs back ────────────────────────────────
  useGSAP(
    () => {
      const tree = root.current;
      if (!ready || lite || !tree) return;
      const mm = gsap.matchMedia();
      mm.add(MEDIA, (context, contextSafe) => {
        const { finePointer, reduce } = context.conditions ?? {};
        if (!finePointer || reduce) return; // touch scrolls the page; reduced motion: no toy
        // Created on the first hover, not at hydration (one style recalc per Draggable).
        const setup = () => {
          const nodes = Array.from(tree.querySelectorAll<HTMLElement>("[data-skill-card]"));
          const drags = nodes.map((node) => {
            const tilt = gsap.quickTo(node, "rotation", { duration: 0.25, ease: "power2.out" });
            let springBack: gsap.core.Tween | null = null;
            const [drag] = Draggable.create(node, {
              type: "x,y",
              // Only the "Used in" links stay plain clicks; the stretched title button drags (a
              // press without movement is still a click: it pins the node).
              clickableTest: (el: HTMLElement | SVGElement) => el.closest("a") !== null,
              zIndexBoost: true,
              cursor: "grab",
              activeCursor: "grabbing",
              onPress: () => {
                springBack?.kill();
              },
              onDragStart: () => {
                gsap.to(node, { scale: 1.04, duration: 0.15, ease: "power2.out" });
              },
              onDrag: () => {
                tilt(gsap.utils.clamp(-9, 9, drag.deltaX * 0.9));
              },
              onRelease: () => {
                // Spring (elastic overshoot) back to the slot in the tree.
                springBack = gsap.to(node, {
                  x: 0,
                  y: 0,
                  rotation: 0,
                  scale: 1,
                  duration: 1.1,
                  ease: "elastic.out(1, 0.38)",
                  onUpdate: () => drag.update(),
                });
              },
            });
            return drag;
          });
          return () => {
            for (const drag of drags) drag.kill();
            gsap.set(nodes, { clearProps: "transform,zIndex,cursor,touchAction,userSelect" });
          };
        };
        return onFirstPointer(tree, contextSafe ? (contextSafe(setup) as typeof setup) : setup);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [ready, lite], revertOnUpdate: true },
  );

  return (
    <div ref={root} data-skill-tree className={className}>
      <p id={NODE_HELP_ID} className="sr-only">
        Highlights the projects that use this skill.
      </p>
      {children}
    </div>
  );
}
