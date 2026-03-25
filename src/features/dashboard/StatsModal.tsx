import { createSignal, createEffect, Show, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { initWorker, workerApi } from '../../core/hooks/useWorker.ts';
import type { CardRow, ReviewLogRow } from '../../core/workers/protocol.ts';
import {
  aggregateTodaySummary, aggregateFutureDue, aggregateCalendar,
  aggregateReviews, aggregateCardCounts, aggregateIntervals, avgInterval,
} from './statsAggregations.ts';
import { drawBarChart, drawStackedBarChart, drawPieChart, drawHeatmap } from './statsCharts.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function StatsModal(props: Props) {
  const [cards, setCards] = createSignal<CardRow[]>([]);
  const [log, setLog] = createSignal<ReviewLogRow[]>([]);
  const [loading, setLoading] = createSignal(false);

  // Toggle signals
  const [futureDays, setFutureDays] = createSignal(30);
  const [reviewDays, setReviewDays] = createSignal(30);
  const [intervalCap, setIntervalCap] = createSignal<number | null>(null);
  const [calYear, setCalYear] = createSignal(new Date().getFullYear());

  async function loadData() {
    if (!props.projectId) return;
    setLoading(true);
    try {
      await initWorker();
      const data = await workerApi.exportProjectData(props.projectId);
      setCards(data.cards);
      setLog(data.review_log);
    } catch { /* empty */ }
    setLoading(false);
  }

  createEffect(() => {
    if (props.open && props.projectId) loadData();
  });

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) props.onClose();
  };
  onMount(() => document.addEventListener('keydown', handleEscape));
  onCleanup(() => document.removeEventListener('keydown', handleEscape));

  return (
    <Show when={props.open}>
      <Portal>
        <div class="sm-backdrop" onClick={props.onClose}>
          <div class="sm-panel" onClick={(e) => e.stopPropagation()}>
            <div class="sm-header">
              <span class="sm-title">Statistics</span>
              <button type="button" class="sm-close" onClick={props.onClose}>&times;</button>
            </div>
            <div class="sm-body">
              <Show when={loading()}>
                <div class="sm-loading">Loading...</div>
              </Show>
              <Show when={!loading() && cards().length === 0 && log().length === 0}>
                <div class="sm-loading">No cards in this project.</div>
              </Show>
              <Show when={!loading() && (cards().length > 0 || log().length > 0)}>
                <div class="sm-grid">
                  <PanelToday log={log()} />
                  <PanelCardCounts cards={cards()} />
                  <PanelFutureDue cards={cards()} days={futureDays()} setDays={setFutureDays} />
                  <PanelReviews log={log()} days={reviewDays()} setDays={setReviewDays} />
                  <PanelCalendar log={log()} year={calYear()} setYear={setCalYear} />
                  <PanelIntervals cards={cards()} cap={intervalCap()} setCap={setIntervalCap} />
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

// --- Panel Components ---

function PanelToday(props: { log: ReviewLogRow[] }) {
  const summary = () => aggregateTodaySummary(props.log);
  return (
    <div class="sm-card">
      <div class="sm-card-title">Today</div>
      <Show when={summary().studied > 0} fallback={<div class="sm-empty">No cards studied today.</div>}>
        <div class="sm-today">
          <div class="sm-metric">
            <span class="sm-metric-value">{summary().studied}</span>
            <span class="sm-metric-label">studied</span>
          </div>
          <div class="sm-metric">
            <span class="sm-metric-value">{summary().correctPct}%</span>
            <span class="sm-metric-label">correct</span>
          </div>
          <div class="sm-metric">
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
    <div class="sm-card">
      <div class="sm-card-title">Card Counts</div>
      <canvas ref={canvasEl} class="sm-canvas sm-canvas-pie" />
      <div class="sm-summary">{total()} total cards</div>
    </div>
  );
}

function ToggleRow(props: {
  options: { label: string; value: number | null }[];
  active: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div class="sm-toggles">
      {props.options.map(opt => (
        <button
          type="button"
          class={`sm-toggle ${props.active === opt.value ? 'sm-toggle--active' : ''}`}
          onClick={() => props.onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PanelFutureDue(props: { cards: CardRow[]; days: number; setDays: (n: number) => void }) {
  let canvasEl!: HTMLCanvasElement;

  createEffect(() => {
    const bars = aggregateFutureDue(props.cards, props.days);
    if (canvasEl) {
      drawBarChart(
        canvasEl,
        bars.map(b => ({ label: String(b.dayOffset), value: b.count })),
        '#7cc47c',
      );
    }
  });

  const dueTomorrow = () => {
    const bars = aggregateFutureDue(props.cards, 2);
    return bars[1]?.count ?? 0;
  };

  return (
    <div class="sm-card sm-full">
      <div class="sm-card-header">
        <div class="sm-card-title">Future Due</div>
        <div class="sm-toggles">
          {[{ l: '1 month', v: 30 }, { l: '3 months', v: 90 }, { l: '1 year', v: 365 }].map(o => (
            <button type="button" class={`sm-toggle ${props.days === o.v ? 'sm-toggle--active' : ''}`}
              onClick={() => props.setDays(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasEl} class="sm-canvas sm-canvas-wide" />
      <div class="sm-summary">Due tomorrow: {dueTomorrow()} reviews</div>
    </div>
  );
}

function PanelReviews(props: { log: ReviewLogRow[]; days: number; setDays: (n: number) => void }) {
  let canvasEl!: HTMLCanvasElement;

  createEffect(() => {
    const bars = aggregateReviews(props.log, props.days);
    if (canvasEl) {
      drawStackedBarChart(
        canvasEl,
        bars.map(b => ({ label: b.date.slice(5), ...b })),
      );
    }
  });

  const stats = () => {
    const bars = aggregateReviews(props.log, props.days);
    const total = bars.reduce((s, b) => s + b.again + b.hard + b.good + b.easy, 0);
    const daysStudied = bars.filter(b => b.again + b.hard + b.good + b.easy > 0).length;
    const pct = props.days > 0 ? Math.round((daysStudied / props.days) * 100) : 0;
    const avg = daysStudied > 0 ? Math.round(total / daysStudied) : 0;
    return { total, daysStudied, pct, avg };
  };

  return (
    <div class="sm-card sm-full">
      <div class="sm-card-header">
        <div class="sm-card-title">Reviews</div>
        <div class="sm-toggles">
          {[{ l: '1 month', v: 30 }, { l: '3 months', v: 90 }, { l: '1 year', v: 365 }].map(o => (
            <button type="button" class={`sm-toggle ${props.days === o.v ? 'sm-toggle--active' : ''}`}
              onClick={() => props.setDays(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasEl} class="sm-canvas sm-canvas-wide" />
      <div class="sm-summary">
        {stats().daysStudied} of {props.days} days ({stats().pct}%) &middot; {stats().total} total &middot; {stats().avg} avg/day
      </div>
    </div>
  );
}

function PanelCalendar(props: { log: ReviewLogRow[]; year: number; setYear: (n: number) => void }) {
  let canvasEl!: HTMLCanvasElement;

  createEffect(() => {
    const days = aggregateCalendar(props.log, props.year);
    if (canvasEl) drawHeatmap(canvasEl, days, props.year);
  });

  return (
    <div class="sm-card sm-full">
      <div class="sm-card-header">
        <div class="sm-card-title">Calendar</div>
        <div class="sm-toggles">
          <button type="button" class="sm-toggle" onClick={() => props.setYear(props.year - 1)}>&larr;</button>
          <span class="sm-year">{props.year}</span>
          <button type="button" class="sm-toggle" onClick={() => props.setYear(props.year + 1)}>&rarr;</button>
        </div>
      </div>
      <canvas ref={canvasEl} class="sm-canvas sm-canvas-heatmap" />
    </div>
  );
}

function PanelIntervals(props: { cards: CardRow[]; cap: number | null; setCap: (n: number | null) => void }) {
  let canvasEl!: HTMLCanvasElement;

  createEffect(() => {
    const buckets = aggregateIntervals(props.cards, props.cap);
    if (canvasEl) {
      drawBarChart(
        canvasEl,
        buckets.map(b => ({ label: b.rangeLabel, value: b.count })),
      );
    }
  });

  const avg = () => avgInterval(props.cards);

  return (
    <div class="sm-card sm-full">
      <div class="sm-card-header">
        <div class="sm-card-title">Review Intervals</div>
        <div class="sm-toggles">
          {[
            { l: '50%', v: 0.5 as number | null },
            { l: '95%', v: 0.95 as number | null },
            { l: 'all', v: null as number | null },
          ].map(o => (
            <button type="button" class={`sm-toggle ${props.cap === o.v ? 'sm-toggle--active' : ''}`}
              onClick={() => props.setCap(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasEl} class="sm-canvas sm-canvas-wide" />
      <div class="sm-summary">Average interval: {avg()} days</div>
    </div>
  );
}
