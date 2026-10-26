"use client";

import { ArrowUpRight, FolderGit2 } from "lucide-react";

import { LockedLink } from "../LockedLink";
import { LockCaption } from "./LockCaption";

type Props = {
  projectId: number;
  bossEnabled: boolean;
  liveUrl: string | null;
  repoUrl: string | null;
};

/**
 * The Open site / Repo row of the Stage (spec §6.3 item 1) with its "Defeat the boss to unlock"
 * caption. A client component on purpose: <LockedLink> takes the icon *component*, and a
 * function (or forwardRef object) can't be passed from a Server Component to a Client
 * Component — so the icons are picked here, on the client side of the boundary.
 */
export function StageLinks({ projectId, bossEnabled, liveUrl, repoUrl }: Props) {
  if (!liveUrl && !repoUrl) {
    return <p className="hk-pixel text-ink-2 text-xs">No public site or repo for this one.</p>;
  }

  return (
    <>
      {liveUrl ? (
        <LockedLink
          href={liveUrl}
          icon={ArrowUpRight}
          className="hk-btn-hot"
          projectId={projectId}
          bossEnabled={bossEnabled}
        >
          Open site
        </LockedLink>
      ) : null}
      {repoUrl ? (
        <LockedLink
          href={repoUrl}
          icon={FolderGit2}
          projectId={projectId}
          bossEnabled={bossEnabled}
        >
          Repo
        </LockedLink>
      ) : null}
      <LockCaption projectId={projectId} bossEnabled={bossEnabled} />
    </>
  );
}
