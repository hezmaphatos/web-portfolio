import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Markdown } from "@/components/ui/Markdown";
import { cn, formatPeriod, label, pad2 } from "@/lib/utils";
import type { Experience, ExperienceType, Metric, Section } from "@/lib/types";

type Props = { experiences: Experience[]; section: Section };

type Group = "work" | "organization" | "education";

/** Filter tabs (spec §4.1): Work covers every kind of paid or contract work. */
const GROUP_OF: Record<ExperienceType, Group> = {
  work: "work",
  internship: "work",
  freelance: "work",
  organization: "organization",
  education: "education",
};

const GROUPS: { key: Group; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "organization", label: "Organization" },
  { key: "education", label: "Education" },
];

/** Quest-card header strip and timeline node per group (text colours keep AA on each surface). */
const GROUP_STYLE: Record<Group, { strip: string; node: string }> = {
  work: { strip: "bg-hot text-ink", node: "bg-hot" },
  organization: { strip: "bg-volt text-paper", node: "bg-volt" },
  education: { strip: "bg-lime text-ink", node: "bg-lime" },
};

/**
 * CSS-only filter: the tabs are radio buttons, and while one is checked every entry of another
 * group is hidden (`:has()`), so filtering works without JavaScript. Phase 4 keeps the radios and
 * animates the reorder with Flip. Literal class strings, so Tailwind can see them.
 */
const FILTER_CLASSES =
  "[&:has(#quest-filter-work:checked)_[data-group]:not([data-group=work])]:hidden " +
  "[&:has(#quest-filter-organization:checked)_[data-group]:not([data-group=organization])]:hidden " +
  "[&:has(#quest-filter-education:checked)_[data-group]:not([data-group=education])]:hidden";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** "2026", "2024–25", "2023–now" (the left column; the exact months sit under it). */
function yearRange(experience: Experience): string {
  const start = experience.start_date.slice(0, 4);
  if (experience.end_date === null) return `${start}–now`;
  const end = experience.end_date.slice(0, 4);
  if (end === start) return start;
  return `${start}–${end.slice(0, 2) === start.slice(0, 2) ? end.slice(2) : end}`;
}

/**
 * Chapter 3 — QUEST LOG (spec §4.1). Static version (= Lite mode): every entry is open, the rail is
 * full and the metrics show their final values. Hooks for phase 4:
 * - [data-quest-log] the timeline; [data-progress-rail] the fill that scrubs with scroll (scaleY);
 * - [data-period] the left column that becomes the sticky "active period";
 * - [data-type]/[data-group] on each entry for the Flip filter, [data-accordion] for expand/collapse
 *   ([data-accordion-body] is the part that folds away);
 * - [data-counter] counts up to its value.
 */
export function JourneyChapter({ experiences, section }: Props) {
  const counts = GROUPS.map((group) => ({
    ...group,
    count: experiences.filter((e) => GROUP_OF[e.type] === group.key).length,
  })).filter((group) => group.count > 0);
  const showFilter = counts.length > 1;

  return (
    <section
      id="journey"
      aria-labelledby="journey-title"
      className="hk-chapter"
      data-chapter="journey"
    >
      <div className={cn("hk-wrap", showFilter && FILTER_CLASSES)}>
        <ChapterHeading level={3} plain="Journey" section={section} id="journey-title" />
        <Markdown className="-mt-4 mb-12 text-lg md:-mt-6">{section.body}</Markdown>

        {showFilter ? (
          <fieldset className="mb-12 md:mb-16">
            <legend className="hk-pixel mb-3 text-xs">Show quests</legend>
            <div className="border-ink flex w-full flex-wrap border-2 shadow-[var(--shadow-sm)] sm:inline-flex sm:w-auto">
              {[{ key: "all", label: "All", count: experiences.length }, ...counts].map((tab) => (
                <label
                  key={tab.key}
                  className="border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-volt -mr-0.5 -mb-0.5 flex min-h-11 grow cursor-pointer items-center justify-center gap-2 border-r-2 border-b-2 px-4 font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid sm:grow-0"
                >
                  <input
                    type="radio"
                    name="quest-filter"
                    id={`quest-filter-${tab.key}`}
                    value={tab.key}
                    defaultChecked={tab.key === "all"}
                    className="sr-only"
                  />
                  {tab.label}
                  <span className="hk-mono text-xs opacity-80">{tab.count}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="relative">
          {/* The rail: a recessed track with a hot fill (full here; phase 4 scrubs its scaleY). */}
          <div
            aria-hidden="true"
            className="border-ink bg-paper-2 absolute top-2 bottom-0 left-[calc(1rem-5px)] w-2.5 border-2 md:left-[calc(12.5rem-5px)]"
          >
            <div data-progress-rail className="bg-hot h-full w-full origin-top" />
          </div>

          <ol data-quest-log className="relative space-y-12 md:space-y-16">
            {experiences.map((experience, index) => (
              <QuestEntry key={experience.id} experience={experience} index={index} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function QuestEntry({ experience, index }: { experience: Experience; index: number }) {
  const group = GROUP_OF[experience.type];
  const style = GROUP_STYLE[group];
  const titleId = `quest-${experience.id}-title`;
  const current = experience.end_date === null || experience.is_current;

  return (
    <li
      data-type={experience.type}
      data-group={group}
      data-accordion
      className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[11rem_3rem_minmax(0,1fr)] md:gap-x-0"
    >
      <div
        data-period
        className="col-start-2 mb-3 flex items-baseline gap-3 md:col-start-1 md:row-start-1 md:mb-0 md:block md:pr-6 md:text-right"
      >
        <p className="hk-display hk-condensed text-3xl tracking-[-0.005em] whitespace-nowrap uppercase md:text-[2.6rem]">
          {yearRange(experience)}
        </p>
        <p className="hk-pixel text-ink-2 text-[0.7rem] md:mt-2">
          <PeriodText period={formatPeriod(experience.start_date, experience.end_date)} />
        </p>
      </div>

      <div
        aria-hidden="true"
        className="col-start-1 row-start-1 flex justify-center pt-1.5 md:col-start-2 md:pt-3"
      >
        <span className={cn("border-ink block size-5 rotate-45 border-2", style.node)} />
      </div>

      <article
        aria-labelledby={titleId}
        className="hk-panel col-start-2 md:col-start-3 md:row-start-1"
      >
        <header
          className={cn(
            "hk-pixel border-ink flex flex-wrap items-center gap-x-3 gap-y-1 rounded-tr-[12px] border-b-2 px-4 py-2 text-xs md:px-6",
            style.strip,
          )}
        >
          <span>Quest {pad2(index + 1)}</span>
          <span aria-hidden="true">·</span>
          <span>{label(experience.type)}</span>
          <span className="ml-auto">
            {current ? (
              <>
                <span aria-hidden="true">● </span>Active
              </>
            ) : (
              <>
                <span aria-hidden="true">✓ </span>Cleared
              </>
            )}
          </span>
        </header>

        <div className="px-4 py-5 md:px-6 md:py-6">
          <h3 id={titleId} className="text-2xl leading-tight font-bold md:text-[1.75rem]">
            {experience.title}
          </h3>
          <p className="mt-1 text-lg font-semibold">
            {experience.organization}
            {experience.location ? (
              <span className="text-ink-2 font-normal"> · {experience.location}</span>
            ) : null}
          </p>
          {experience.subtitle ? (
            <p className="hk-mono bg-paper-2 mt-3 inline-block px-2 py-0.5 text-sm">
              {experience.subtitle}
            </p>
          ) : null}

          <div data-accordion-body>
            <Markdown className="mt-4">{experience.description}</Markdown>
            {experience.bullets.length > 0 ? (
              <ul className="mt-4 max-w-[65ch] space-y-2">
                {experience.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span aria-hidden="true" className="text-hot mt-[0.05em] font-bold">
                      ▸
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {experience.metrics.length > 0 ? <Metrics metrics={experience.metrics} /> : null}
      </article>
    </li>
  );
}

/** "Dec 2024 – Dec 2025" that only breaks between the two months, never inside one. */
function PeriodText({ period }: { period: string }) {
  const [from, to] = period.split(" – ");
  if (!to) return <span className="whitespace-nowrap">{from}</span>;
  return (
    <>
      <span className="whitespace-nowrap">{from} –</span>{" "}
      <span className="whitespace-nowrap">{to}</span>
    </>
  );
}

/** Quest rewards: the entry's numbers, big. */
function Metrics({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="border-ink bg-lime grid grid-cols-2 gap-x-6 gap-y-5 border-t-2 px-4 py-5 sm:grid-cols-3 md:px-6">
      {metrics.map((metric) => (
        <div key={metric.label} className="flex flex-col-reverse justify-end">
          <dt className="mt-1.5 text-sm leading-snug font-semibold">{metric.label}</dt>
          <dd className="hk-display hk-condensed text-5xl tracking-[-0.005em] whitespace-nowrap md:text-6xl">
            {metric.prefix}
            <span data-counter={metric.value}>{numberFormat.format(metric.value)}</span>
            {metric.suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}
