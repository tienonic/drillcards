import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { CardRow, ReviewLogRow } from '../../core/workers/protocol.ts';
import { DiagnosticTab, type WeakCard } from './DiagnosticTab.tsx';
import {
  aggregateTodaySummary, aggregateFutureDue, aggregateCalendar,
  aggregateReviews, aggregateCardCounts, aggregateIntervals, avgInterval,
} from './statsAggregations.ts';
import { drawBarChart, drawStackedBarChart, drawPieChart, drawHeatmap, setupTooltip } from './statsCharts.ts';

export interface SectionStatRow {
  name: string;
  reviewed: number;
  retention: number | null;
  due: number;
}

export interface ProjectGroup {
  name: string;
  slug: string;
  reviewed: number;
  retention: number | null;
  due: number;
  sections: SectionStatRow[];
}

interface StatsTabProps {
  totalReviews: number;
  retention: number | null;
  groups: ProjectGroup[];
  cards: CardRow[];
  reviewLog: ReviewLogRow[];
  weakCards: WeakCard[];
  onDeleteProject?: (slug: string) => void;
}

const MAX_VISIBLE = 6;

export function StatsTab(props: StatsTabProps) {
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
  const [showAllDecks, setShowAllDecks] = createSignal(false);

  function toggle(slug: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  const fmtRet = (r: number | null) => r != null ? Math.round(r * 100) + '%' : '--';
  const visibleGroups = () => showAllDecks() ? props.groups : props.groups.slice(0, MAX_VISIBLE);
  const hasOverflow = () => props.groups.length > MAX_VISIBLE;

  return (
    <div class="db-stats">
      <Show when={props.totalReviews > 0 || props.groups.length > 0} fallback={
        <div class="db-stats-empty">No study data yet. Start reviewing to see your stats.</div>
      }>
        <div class="db-stats-body">
          <div class="db-stats-main">
            {/* Summary */}
            <div class="db-stats-summary">
              <div class="db-stats-metric" title="Total card reviews">
                <span class="db-stats-value">{props.totalReviews}</span>
                <span class="db-stats-label">Total Reviews</span>
              </div>
              <div class="db-stats-metric" title="Recall probability">
                <span class="db-stats-value">{fmtRet(props.retention)}</span>
                <span class="db-stats-label">Retention</span>
              </div>
              <Show when={props.weakCards.length > 0}>
                <div class="db-stats-metric" title="Leeches">
                  <span class="db-stats-value db-stats-value--warn">{props.weakCards.length}</span>
                  <span class="db-stats-label">Difficult</span>
                </div>
              </Show>
            </div>

            {/* Deck Table */}
            <Show when={props.groups.length > 0}>
              <div class={showAllDecks() && hasOverflow() ? 'db-stats-table-scroll' : ''}>
                <table class="db-stats-table">
                  <thead>
                    <tr>
                      <th title="Click to expand">Deck / Section</th>
                      <th title="Total answered">Reviewed</th>
                      <th title="Recall probability">Retention</th>
                      <th title="Due now">Due</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={visibleGroups()}>
                      {(g) => {
                        const isOpen = () => expanded().has(g.slug);
                        const hasSections = () => g.sections.length > 1;
                        return (
                          <>
                            <tr
                              class={`db-stats-group-header ${hasSections() ? 'db-stats-group-toggle' : ''}`}
                              onClick={() => hasSections() && toggle(g.slug)}
                            >
                              <td>
                                <Show when={hasSections()}>
                                  <span class="db-stats-chevron">{isOpen() ? '\u25BE' : '\u25B8'}</span>
                                </Show>
                                {g.name}
                              </td>
                              <td>{g.reviewed}</td>
                              <td>{fmtRet(g.retention)}</td>
                              <td class={g.due > 0 ? 'db-stats-due-active' : ''}>{g.due}</td>
                              <td>
                                <Show when={props.onDeleteProject}>
                                  <button
                                    type="button"
                                    class="db-review-remove"
                                    title={`Delete all stats for ${g.name}`}
                                    onClick={(e) => { e.stopPropagation(); props.onDeleteProject!(g.slug); }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  </button>
                                </Show>
                              </td>
                            </tr>
                            <Show when={isOpen()}>
                              <For each={g.sections}>
                                {(s) => (
                                  <tr class="db-stats-section-row">
                                    <td>{s.name}</td>
                                    <td>{s.reviewed}</td>
                                    <td>{fmtRet(s.retention)}</td>
                                    <td class={s.due > 0 ? 'db-stats-due-active' : ''}>{s.due}</td>
                                    <td></td>
                                  </tr>
                                )}
                              </For>
                            </Show>
                          </>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
              <Show when={hasOverflow()}>
                <button type="button" class="db-stats-show-all" onClick={() => setShowAllDecks(v => !v)}>
                  {showAllDecks() ? 'Show less' : `Show all ${props.groups.length} decks`}
                </button>
              </Show>
            </Show>

            {/* Weak Areas */}
            <Show when={props.weakCards.length > 0}>
              <DiagnosticTab cards={props.weakCards} />
            </Show>

            {/* Chart Panels */}
            <Show when={props.cards.length > 0 || props.reviewLog.length > 0}>
              <div class="sm-grid sm-grid-inline">
                <PanelToday log={props.reviewLog} />
                <PanelCardCounts cards={props.cards} />
                <PanelFutureDue cards={props.cards} />
                <PanelCalendar log={props.reviewLog} />
                <PanelReviews log={props.reviewLog} />
                <PanelIntervals cards={props.cards} />
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

// --- Chart Panels ---

function PanelToday(props: { log: ReviewLogRow[] }) {
  const summary = () => aggregateTodaySummary(props.log);
  return (
    <div class="sm-card" title="Today's activity">
      <div class="sm-card-title">Today</div>
      <Show when={summary().studied > 0} fallback={<div class="sm-empty">No cards studied today.</div>}>
        <div class="sm-today">
          <div class="sm-metric" title="Reviewed today">
            <span class="sm-metric-value">{summary().studied}</span>
            <span class="sm-metric-label">studied</span>
          </div>
          <div class="sm-metric" title="Correct rate">
            <span class="sm-metric-value">{summary().correctPct}%</span>
            <span class="sm-metric-label">correct</span>
          </div>
          <div class="sm-metric" title="Rated Again">
            <span class="sm-metric-value">{summary().againCount}</span>
            <span class="sm-metric-label">again</span>
          </div>
        </div>
      </Show>
    </div>
  );
}

function PanelCardCounts(props: { cards: CardRow[] }) {
  let canvasEl!: HTMLCanvasElement;
  const slices = () => aggregateCardCounts(props.cards);
  const total = () => props.cards.length;

  createEffect(() => {
    const s = slices();
    if (canvasEl) drawPieChart(canvasEl, s.map(sl => ({ label: sl.label, value: sl.count, color: sl.color })));
  });

  return (
    <div class="sm-card" title="Cards by FSRS state">
      <div class="sm-card-title">Counts</div>
      <canvas ref={canvasEl} class="sm-canvas sm-canvas-pie" />
      <div class="sm-summary">{total()} total</div>
    </div>
  );
}

function PanelFutureDue(props: { cards: CardRow[] }) {
  let canvasEl!: HTMLCanvasElement;
  let tipEl!: HTMLDivElement;
  let ttCleanup: (() => void) | undefined;
  const [days, setDays] = createSignal(30);

  createEffect(() => {
    const bars = aggregateFutureDue(props.cards, days());
    if (canvasEl) {
      const regions = drawBarChart(canvasEl, bars.map(b => ({ label: `Day ${b.dayOffset}`, value: b.count })), '#7cc47c');
      ttCleanup?.();
      if (tipEl) ttCleanup = setupTooltip(canvasEl, tipEl, regions);
    }
  });

  const dueTomorrow = () => {
    const bars = aggregateFutureDue(props.cards, 2);
    return bars[1]?.count ?? 0;
  };

  onCleanup(() => ttCleanup?.());

  return (
    <div class="sm-card sm-full" title="Upcoming due cards">
      <div class="sm-card-header">
        <div class="sm-card-title">Future Due</div>
        <div class="sm-toggles">
          {[{ l: '1 month', v: 30 }, { l: '3 months', v: 90 }, { l: '1 year', v: 365 }].map(o => (
            <button type="button" class={`sm-toggle ${days() === o.v ? 'sm-toggle--active' : ''}`}
              onClick={() => setDays(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      <div class="sm-chart-wrap">
        <canvas ref={canvasEl} class="sm-canvas sm-canvas-wide" />
        <div ref={tipEl} class="sm-tooltip" />
      </div>
      <div class="sm-summary">Due tomorrow: {dueTomorrow()} reviews</div>
    </div>
  );
}

function PanelReviews(props: { log: ReviewLogRow[] }) {
  let canvasEl!: HTMLCanvasElement;
  let tipEl!: HTMLDivElement;
  let ttCleanup: (() => void) | undefined;
  const [days, setDays] = createSignal(0);

  createEffect(() => {
    const bars = aggregateReviews(props.log, days());
    if (canvasEl) {
      const regions = drawStackedBarChart(canvasEl, bars.map(b => ({ label: b.date.slice(5), ...b })));
      ttCleanup?.();
      if (tipEl) ttCleanup = setupTooltip(canvasEl, tipEl, regions);
    }
  });

  const stats = () => {
    const bars = aggregateReviews(props.log, days());
    const total = bars.reduce((s, b) => s + b.again + b.hard + b.good + b.easy, 0);
    const daysStudied = bars.filter(b => b.again + b.hard + b.good + b.easy > 0).length;
    const span = bars.length;
    const pct = span > 0 ? Math.round((daysStudied / span) * 100) : 0;
    const avg = daysStudied > 0 ? Math.round(total / daysStudied) : 0;
    return { total, daysStudied, pct, avg, span };
  };

  onCleanup(() => ttCleanup?.());

  return (
    <div class="sm-card sm-full" title="Daily reviews by rating">
      <div class="sm-card-header">
        <div class="sm-card-title">Reviews</div>
        <div class="sm-toggles">
          {[{ l: '1 month', v: 30 }, { l: '3 months', v: 90 }, { l: '1 year', v: 365 }, { l: 'all', v: 0 }].map(o => (
            <button type="button" class={`sm-toggle ${days() === o.v ? 'sm-toggle--active' : ''}`}
              onClick={() => setDays(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      <div class="sm-chart-wrap">
        <canvas ref={canvasEl} class="sm-canvas sm-canvas-wide" />
        <div ref={tipEl} class="sm-tooltip" />
      </div>
      <div class="sm-summary">
        {stats().daysStudied} of {stats().span} days ({stats().pct}%) &middot; {stats().total} total &middot; {stats().avg} avg/day
      </div>
    </div>
  );
}

function PanelCalendar(props: { log: ReviewLogRow[] }) {
  let canvasEl!: HTMLCanvasElement;
  let tipEl!: HTMLDivElement;
  let ttCleanup: (() => void) | undefined;
  const [year, setYear] = createSignal(new Date().getFullYear());

  createEffect(() => {
    const d = aggregateCalendar(props.log, year());
    if (canvasEl) {
      const regions = drawHeatmap(canvasEl, d, year());
      ttCleanup?.();
      if (tipEl) ttCleanup = setupTooltip(canvasEl, tipEl, regions);
    }
  });

  onCleanup(() => ttCleanup?.());

  return (
    <div class="sm-card sm-full">
      <div class="sm-card-header">
        <div class="sm-card-title">Calendar</div>
        <div class="sm-toggles">
          <button type="button" class="sm-toggle" onClick={() => setYear(y => y - 1)}>&larr;</button>
          <span class="sm-year">{year()}</span>
          <button type="button" class="sm-toggle" onClick={() => setYear(y => y + 1)}>&rarr;</button>
        </div>
      </div>
      <div class="sm-chart-wrap">
        <canvas ref={canvasEl} class="sm-canvas sm-canvas-heatmap" />
        <div ref={tipEl} class="sm-tooltip" />
      </div>
    </div>
  );
}

function PanelIntervals(props: { cards: CardRow[] }) {
  let canvasEl!: HTMLCanvasElement;
  let tipEl!: HTMLDivElement;
  let ttCleanup: (() => void) | undefined;
  const [cap, setCap] = createSignal<number | null>(null);

  createEffect(() => {
    const buckets = aggregateIntervals(props.cards, cap());
    if (canvasEl) {
      const regions = drawBarChart(canvasEl, buckets.map(b => ({ label: `${b.rangeLabel}d`, value: b.count })));
      ttCleanup?.();
      if (tipEl) ttCleanup = setupTooltip(canvasEl, tipEl, regions);
    }
  });

  onCleanup(() => ttCleanup?.());

  const avg = () => avgInterval(props.cards);

  return (
    <div class="sm-card sm-full" title="Review spacing">
      <div class="sm-card-header">
        <div class="sm-card-title">Review Intervals</div>
        <div class="sm-toggles">
          {[
            { l: '50%', v: 0.5 as number | null },
            { l: '95%', v: 0.95 as number | null },
            { l: 'all', v: null as number | null },
          ].map(o => (
            <button type="button" class={`sm-toggle ${cap() === o.v ? 'sm-toggle--active' : ''}`}
              onClick={() => setCap(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      <div class="sm-chart-wrap">
        <canvas ref={canvasEl} class="sm-canvas sm-canvas-wide" />
        <div ref={tipEl} class="sm-tooltip" />
      </div>
      <div class="sm-summary">Average interval: {avg()} days</div>
    </div>
  );
}
