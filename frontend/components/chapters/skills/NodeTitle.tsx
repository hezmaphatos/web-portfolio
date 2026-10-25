"use client";

import { useMounted } from "@/components/chapters/shared/motion";

import { useTreeFocus } from "./treeFocus";

type Props = { skillId: number; name: string };

/** id of the one sr-only sentence (in <SkillTree>) that explains what the node buttons do. */
export const NODE_HELP_ID = "skill-node-help";

/**
 * The title of a skill node. Server HTML / no JS: plain text. Once mounted it becomes a toggle
 * button stretched over the whole card (CSS `.hk-node-btn::after`), so a click or tap anywhere on
 * the node pins it (aria-pressed) and lights up the projects that use the skill; the "Used in"
 * links sit above the stretch and keep working.
 */
export function NodeTitle({ skillId, name }: Props) {
  const mounted = useMounted();
  const pinned = useTreeFocus((state) => state.pinned === skillId);
  const togglePin = useTreeFocus((state) => state.togglePin);

  if (!mounted) return <>{name}</>;

  return (
    <button
      type="button"
      className="hk-node-btn"
      aria-pressed={pinned}
      aria-describedby={NODE_HELP_ID}
      onClick={() => togglePin(skillId)}
    >
      {name}
    </button>
  );
}
