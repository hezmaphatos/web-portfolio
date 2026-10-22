import { MapPin, Phone, RotateCcw } from "lucide-react";
import { cacheLife } from "next/cache";

import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Markdown } from "@/components/ui/Markdown";
import { SocialLinks } from "@/components/ui/SocialLinks";
import type { Section, Site } from "@/lib/types";

type Props = { site: Site; section: Section };

/** Shown only when the admin left both subtitle and body empty, so the stage never opens bare. */
const FALLBACK_PITCH = "Got a project, a role or a question? Send a message and say hi.";

/**
 * Chapter 7 — FINAL STAGE (spec §4.1) and the site footer. Static version (= Lite mode): the
 * email is the call to action; the contact form (name, email, message, honeypot) with its
 * STAGE CLEAR success and the copy-email toast arrive in phase 5 at [data-contact-form]. Hooks:
 * [data-copy-email] (phase 5 adds the copy button next to it), [data-play-again] (phase 7 rewind).
 */
export function ContactChapter({ site, section }: Props) {
  const [mailbox, domain] = site.email ? splitEmail(site.email) : [null, null];

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="hk-chapter pb-10 [--accent:var(--hot)] [--chapter-bg:var(--ink)] [--chapter-fg:var(--paper)] md:pb-12"
      data-chapter="contact"
    >
      <div className="hk-wrap">
        <ChapterHeading level={7} plain="Contact" section={section} id="contact-title" />
        {section.body ? (
          <Markdown className="-mt-4 text-lg md:-mt-6 md:text-xl">{section.body}</Markdown>
        ) : section.subtitle ? null : (
          <p className="-mt-4 max-w-2xl text-lg md:-mt-6 md:text-xl">{FALLBACK_PITCH}</p>
        )}

        {site.email ? (
          <div className="mt-14 md:mt-20">
            <p className="hk-pixel text-lime mb-4 text-xs md:text-sm">
              <span aria-hidden="true">▸ </span>Insert coin · Email me
            </p>
            <a
              href={`mailto:${site.email}`}
              data-copy-email={site.email}
              // Not condensed: an address has to be read (and typed) letter by letter.
              className="hk-display decoration-hot hover:text-lime block w-fit max-w-full text-[clamp(1.7rem,8.4vw,5.25rem)] leading-[1.05] tracking-[-0.01em] [overflow-wrap:anywhere] underline decoration-[0.07em] underline-offset-[0.16em] [font-variation-settings:'opsz'_96,'wdth'_88]"
            >
              {mailbox}
              <wbr />
              {domain}
            </a>
          </div>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-6">
          <SocialLinks
            socials={site.socials}
            className="[&_a]:shadow-[3px_3px_0_var(--hot)] [&_a:hover]:shadow-[4px_4px_0_var(--hot)]"
          />
          <ul className="hk-mono flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {site.location ? (
              <li className="flex items-center gap-2">
                <MapPin aria-hidden="true" className="text-hot size-4" />
                <span className="sr-only">Location: </span>
                {site.location}
              </li>
            ) : null}
            {site.phone ? (
              <li className="flex items-center gap-2">
                <Phone aria-hidden="true" className="text-hot size-4" />
                <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="hk-link">
                  <span className="sr-only">Phone: </span>
                  {site.phone}
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        {/* Phase 5: the contact form (name, email, message, honeypot) + STAGE CLEAR mount here. */}
        <div data-contact-form />

        <footer className="border-paper/25 mt-24 flex flex-col gap-6 border-t-2 pt-8 md:mt-32 md:flex-row md:items-center md:justify-between">
          <a
            href="#main"
            data-play-again
            className="hk-btn w-fit shadow-[3px_3px_0_var(--hot)] hover:shadow-[4px_4px_0_var(--hot)]"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Play again
          </a>
          <div className="hk-mono space-y-1 text-xs leading-relaxed opacity-85 md:text-right">
            <p>Built with Laravel, Next.js, Tailwind CSS, GSAP and Lenis.</p>
            <p>
              © <CopyrightYear /> {site.full_name}
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}

/** "name@example.com" → ["name", "@example.com"], so a narrow screen breaks before the @. */
function splitEmail(email: string): [string, string] {
  const at = email.lastIndexOf("@");
  return at > 0 ? [email.slice(0, at), email.slice(at)] : [email, ""];
}

/**
 * The year, read once per day into the static shell. Cache Components rejects `new Date()` in a
 * prerender unless it is inside a cache scope (node_modules/next/dist/docs/…/functions/io.md).
 */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}
