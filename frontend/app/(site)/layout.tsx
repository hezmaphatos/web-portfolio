import type { Metadata } from "next";

import { GameChrome } from "@/components/game/GameChrome";
import { StageHintHost } from "@/components/game/StageHintHost";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { StoreHydrator } from "@/components/providers/StoreHydrator";
import { getHome } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getHome();
  const title = site.seo_title ?? `${site.full_name} — ${site.headline ?? "Portfolio"}`;
  const description = site.seo_description ?? site.short_bio ?? undefined;
  const og = site.og_image;

  return {
    title: { default: title, template: `%s — ${site.full_name}` },
    description,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: site.full_name,
      ...(og
        ? {
            images: [{ url: og.url, width: og.width ?? undefined, height: og.height ?? undefined }],
          }
        : {}),
    },
    twitter: { card: og ? "summary_large_image" : "summary", title, description },
  };
}

/**
 * Public site chrome. `modal` is the parallel-route slot for the Project Stage modal
 * (intercepting route, phase 6); it renders nothing until then.
 */
export default async function SiteLayout({ children, modal }: LayoutProps<"/">) {
  const home = await getHome();

  return (
    <SmoothScroll>
      <StoreHydrator
        skillIds={home.skills.map((skill) => skill.id)}
        projectIds={home.projects.map((project) => project.id)}
      />
      <a href="#main" className="hk-skip hk-btn hk-btn-ink">
        Skip to content
      </a>
      <GameChrome
        site={home.site}
        sections={home.sections}
        bossTotal={home.projects.filter((project) => project.boss.enabled).length}
      />
      <main id="main">{children}</main>
      {modal}
      <StageHintHost />
      <div className="hk-grain" aria-hidden="true" />
    </SmoothScroll>
  );
}
