"use client";

import { Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { refreshScrollTriggers } from "@/components/chapters/shared/motion";
import { PeekProvider, type PeekProject } from "@/components/project/PeekProvider";
import { useStill } from "@/components/ui/useStill";
import { Flip, gsap } from "@/lib/gsap";
import { cn } from "@/lib/utils";

import { handOffCardClick } from "./handoff";
import { matchesQuery } from "./search";

export type GridEntry = {
  id: number;
  category: string;
  /** Skill slugs, in reveal order. */
  skills: string[];
  /** Normalised search haystack (search.ts). */
  text: string;
  /** The server-rendered <ProjectCard>. */
  node: ReactNode;
};

export type FilterOption = { value: string; label: string; count: number };

type Props = {
  entries: GridEntry[];
  categories: FilterOption[];
  techs: FilterOption[];
  peek: PeekProject[];
  /** Background the grid sits on (chapter = ink, /projects = paper). */
  tone: "ink" | "paper";
  className?: string;
};

type Filters = { categories: string[]; techs: string[]; query: string };

const NONE: Filters = { categories: [], techs: [], query: "" };
/** Tech chips shown before "+ N more" (the rest unfold; a selected chip always stays visible). */
const TECH_LIMIT = 8;
/** Typing settles for this long before the grid re-flows (one Flip per pause, not per key). */
const SEARCH_DELAY_MS = 200;
/** Fewer projects than this: no filter bar at all (nothing to narrow down). */
const MIN_FOR_FILTERS = 3;

type FlipState = ReturnType<typeof Flip.getState>;

/**
 * Within a group the chips are OR (Web or Mobile; Laravel or Kotlin), across groups AND, and every
 * word of the search must match — the usual faceted-search rules.
 */
function matches(entry: GridEntry, filters: Filters): boolean {
  if (filters.categories.length > 0 && !filters.categories.includes(entry.category)) return false;
  if (filters.techs.length > 0 && !entry.skills.some((slug) => filters.techs.includes(slug))) {
    return false;
  }
  return filters.query === "" || matchesQuery(entry.text, filters.query);
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * Scene B — the project grid with its filter bar (spec §6.2), used on Home and on /projects.
 * The cards stay server-rendered (`entries[].node`); this island only decides which <li> is
 * shown (`data-filtered="out"` → display: none) and animates the change with GSAP Flip:
 *   1. on a chip / search change, record every cell's box (Flip.getState) *before* React renders;
 *   2. React commits the new `data-filtered` attributes (the grid re-flows instantly);
 *   3. a layout effect plays Flip.from(recorded state): each cell starts where it was and
 *      glides to its new place, entering cells fade/scale in, leaving ones fade out (taken out
 *      of the flow with absoluteOnLeave so the others can already move in).
 * Chips are toggle buttons (aria-pressed); the result count is a polite live region; Lite /
 * reduced motion filter instantly. Without JS the bar is hidden (ProjectGrid's <noscript>) and
 * every card shows. Also: Peek provider, and the card → Stage hand-off (rememberCardRect).
 */
export function GridFilter({ entries, categories, techs, peek, tone, className }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const pending = useRef<FlipState | null>(null);
  const running = useRef<gsap.core.Timeline | null>(null);
  const still = useStill();
  const ids = useId();

  const [filters, setFilters] = useState<Filters>(NONE);
  const [query, setQuery] = useState("");
  const [moreTech, setMoreTech] = useState(false);

  const visible = useMemo(
    () => new Set(entries.filter((entry) => matches(entry, filters)).map((entry) => entry.id)),
    [entries, filters],
  );
  const active =
    filters.categories.length > 0 ||
    filters.techs.length > 0 ||
    filters.query !== "" ||
    query !== "";
  const showFilters = entries.length >= MIN_FOR_FILTERS;

  /** Applies a new filter set; records the "First" of FLIP unless motion is off. */
  const apply = useCallback(
    (next: Filters) => {
      running.current?.progress(1); // finish a running flip: its end state is the real "before"
      running.current = null;
      const cells = list.current ? Array.from(list.current.children) : [];
      pending.current = !still && cells.length > 0 ? Flip.getState(cells) : null;
      setFilters(next);
    },
    [still],
  );

  // Search: apply once typing pauses.
  useEffect(() => {
    if (query === filters.query) return;
    const timer = setTimeout(() => apply({ ...filters, query }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, filters, apply]);

  // "Last" + "Invert/Play": the new attributes are in the DOM, nothing painted yet.
  useLayoutEffect(() => {
    const state = pending.current;
    pending.current = null;
    if (!state) {
      refreshScrollTriggers(); // the page height may have changed (triggers below the grid)
      return;
    }
    running.current = Flip.from(state, {
      duration: 0.55,
      ease: "power3.inOut",
      stagger: 0.02,
      absoluteOnLeave: true,
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { opacity: 0, scale: 0.92 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            delay: 0.15,
            ease: "power2.out",
            clearProps: "opacity,transform",
          },
        ),
      onLeave: (elements) => gsap.to(elements, { opacity: 0, scale: 0.92, duration: 0.25 }),
      onComplete: () => {
        running.current = null;
        refreshScrollTriggers();
      },
    });
  }, [filters]);

  useEffect(
    () => () => {
      running.current?.progress(1);
      running.current?.kill();
    },
    [],
  );

  // Card → Project Stage: remember the cover's rect for the shared-element transition.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.addEventListener("click", handOffCardClick);
    return () => el.removeEventListener("click", handOffCardClick);
  }, []);

  const clear = () => {
    setQuery("");
    apply(NONE);
    searchBox.current?.focus(); // the Clear button itself is about to disappear
  };

  const shownTechs = moreTech
    ? techs
    : techs.filter((tech, i) => i < TECH_LIMIT || filters.techs.includes(tech.value));
  const hiddenTechs = techs.length - shownTechs.length;

  const total = entries.length;
  const status =
    visible.size === total
      ? `Showing all ${total} ${total === 1 ? "project" : "projects"}`
      : visible.size === 0
        ? "No projects match these filters"
        : `Showing ${visible.size} of ${total} projects`;

  return (
    <PeekProvider projects={peek}>
      <div ref={root} className={cn("hk-grid-filter", className)} data-tone={tone}>
        {showFilters ? (
          <div className="hk-filters" role="group" aria-label="Filter projects">
            <div role="search" className="hk-filter-search">
              <label htmlFor={`${ids}-q`} className="sr-only">
                Search projects
              </label>
              <Search aria-hidden="true" className="hk-filter-search-icon size-4" />
              <input
                ref={searchBox}
                id={`${ids}-q`}
                type="search"
                className="hk-input hk-filter-input"
                placeholder="Search projects, tech…"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            {categories.length > 1 ? (
              <div className="hk-filter-row" role="group" aria-labelledby={`${ids}-type`}>
                <span id={`${ids}-type`} className="hk-filter-label hk-pixel">
                  Type
                </span>
                {categories.map((option) => (
                  <FilterChip
                    key={option.value}
                    option={option}
                    pressed={filters.categories.includes(option.value)}
                    onToggle={() =>
                      apply({ ...filters, categories: toggle(filters.categories, option.value) })
                    }
                  />
                ))}
              </div>
            ) : null}

            {techs.length > 1 ? (
              <div className="hk-filter-row" role="group" aria-labelledby={`${ids}-tech`}>
                <span id={`${ids}-tech`} className="hk-filter-label hk-pixel">
                  Tech
                </span>
                <span id={`${ids}-techs`} className="contents">
                  {shownTechs.map((option) => (
                    <FilterChip
                      key={option.value}
                      option={option}
                      pressed={filters.techs.includes(option.value)}
                      onToggle={() =>
                        apply({ ...filters, techs: toggle(filters.techs, option.value) })
                      }
                    />
                  ))}
                </span>
                {techs.length > TECH_LIMIT ? (
                  <button
                    type="button"
                    className="hk-filter-more hk-pixel"
                    aria-expanded={moreTech}
                    aria-controls={`${ids}-techs`}
                    onClick={() => setMoreTech((open) => !open)}
                  >
                    {moreTech ? "Fewer" : `+${hiddenTechs} more`}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="hk-filter-status">
              <p role="status" className="hk-pixel text-xs">
                {status}
              </p>
              {active ? (
                <button type="button" className="hk-filter-clear hk-pixel" onClick={clear}>
                  <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <ul
          ref={list}
          className="hk-grid relative grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-grid-cell
              data-filtered={visible.has(entry.id) ? undefined : "out"}
            >
              {entry.node}
            </li>
          ))}
        </ul>

        {visible.size === 0 ? (
          <div className="hk-grid-empty hk-panel-flat">
            <p className="hk-pixel text-sm">
              <span aria-hidden="true">✕ </span>No level matches
            </p>
            <p className="mt-2 text-[0.9375rem]">
              Try fewer filters or another word{query ? ` than “${query}”` : ""}.
            </p>
            <button type="button" className="hk-btn hk-btn-ink mt-4 text-sm" onClick={clear}>
              Clear filters
            </button>
          </div>
        ) : null}
      </div>
    </PeekProvider>
  );
}

function FilterChip({
  option,
  pressed,
  onToggle,
}: {
  option: FilterOption;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="hk-chip hk-filter-chip"
      aria-pressed={pressed}
      onClick={onToggle}
    >
      <span aria-hidden="true" className="hk-filter-box" />
      {option.label}
      <span className="hk-filter-count hk-mono">
        <span className="sr-only">(</span>
        {option.count}
        <span className="sr-only">)</span>
      </span>
    </button>
  );
}
