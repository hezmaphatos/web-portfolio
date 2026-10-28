import type { Metadata } from "next";

import { GameOver } from "@/components/game/gameover/GameOver";
import { getHome } from "@/lib/api";

import SiteLayout from "./(site)/layout";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getHome();
  return { title: `Game over — ${site.full_name}`, robots: { index: false } };
}

/**
 * Root 404 for every URL no route matches (spec §4 `/not-found`): "GAME OVER — CONTINUE?".
 *
 * Next renders this file inside the bare root layout, so it wraps itself in the site layout
 * (HUD, toasts, Hackker Mode, badges…) — the same component app/(site) uses, not a copy that
 * could drift. Next prerenders it once as /_not-found and serves that HTML with a real 404 for
 * any unknown URL: complete without JavaScript, nothing rendered per request.
 *
 * (A catch-all app/(site)/[...missing] calling notFound() was tried first: it also answers 404,
 * but under Cache Components its prerender is an empty error shell that only JavaScript fills.)
 */
export default function RootNotFound() {
  return (
    <SiteLayout params={Promise.resolve({})} modal={null}>
      <GameOver />
    </SiteLayout>
  );
}
