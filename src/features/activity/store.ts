import { createSignal, createEffect, onCleanup, batch, untrack } from 'solid-js';
import { activeProject, activeTab, syncActivity } from '../../core/store/app.ts';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { sectionHandlers, handlerVersion } from '../../core/store/sections.ts';
import { computeCumScores, drawChartAxes, drawChartData } from './chartUtils.ts';


const [activityScore, setActivityScore] = createSignal(0);
const [reviewStats, setReviewStats] = createSignal({ reviews: 0, retention: '0%' });
const [sidebarScore, setSidebarScore] = createSignal({ correct: 0, attempted: 0, due: 0, total: 0 });

export { activityScore, reviewStats, sidebarScore };

let canvasRef: HTMLCanvasElement | undefined;
let chartEntries: { rating: number; correct: boolean }[] = [];

export function setCanvasRef(el: HTMLCanvasElement) {
  canvasRef = el;
}

let currentRetention = '—';

async function fetchRetention() {
  const project = activeProject();
  if (!project) return;
  try {
    const result = await workerApi.getRetention(project.slug);
    if (activeProject()?.slug !== project.slug) return;
    currentRetention = result.retention != null ? Math.round(result.retention * 100) + '%' : '—';
  } catch {
    // keep previous value on failure
  }
}

function updateScoreSignals() {
  let score = 0;
  for (const e of chartEntries) {
    if (!e.correct || e.rating === 1) score -= 2;
    else if (e.rating === 4) score += 4;
    else if (e.rating === 3) score += 3;
    else score += 1;
    score = Math.max(0, score);
  }
  const total = chartEntries.length;
  batch(() => {
    setActivityScore(Math.round(score));
    setReviewStats({ reviews: total, retention: currentRetention });
  });
}

export async function loadActivity() {
  const project = activeProject();
  if (!project) return;
  const slug = project.slug;
  try {
    let entries = await workerApi.getActivity(slug, 200);
    if (activeProject()?.slug !== slug) return; // Project changed while fetching
    if (!syncActivity()) {
      const tab = activeTab();
      if (tab) entries = entries.filter((e) => e.section_id === tab);
    }
    chartEntries = entries.map((e) => ({ rating: e.rating, correct: !!e.correct })).reverse();
    updateScoreSignals();
    drawChart();
    fetchRetention().then(() => { if (activeProject()?.slug === slug) updateScoreSignals(); });
  } catch {
    // Background refresh — keep stale data on failure
  }
}

async function loadSidebarScore() {
  const project = activeProject();
  const tab = activeTab();
  if (!project || !tab) return;
  const slug = project.slug;
  const section = project.sections.find(s => s.id === tab);
  if (!section || section.type === 'math-gen') return;

  try {
    const handler = sectionHandlers.get(tab);
    const isFlash = handler?.flashMode?.() ?? false;
    const cardType = isFlash ? 'flashcard' as const : section.type === 'passage-quiz' ? 'passage' as const : 'mcq' as const;
    const [scores, dueResult] = await Promise.all([
      workerApi.getScores(slug),
      workerApi.countDue(slug, [tab], cardType),
    ]);
    const s = scores.find((sc) => sc.section_id === tab);
    if (activeTab() !== tab || activeProject()?.slug !== slug) return; // Stale result — tab or project changed
    setSidebarScore({
      correct: s?.correct ?? 0,
      attempted: s?.attempted ?? 0,
      due: dueResult.due + dueResult.newCount,
      total: dueResult.total,
    });
  } catch {
    // Background refresh — keep stale data on failure
  }
}

// Chart utility functions imported from ./chartUtils.ts

function drawChart() {
  if (!canvasRef) return;
  const ctx = canvasRef.getContext('2d');
  if (!ctx) return;
  const w = canvasRef.width; const h = canvasRef.height;
  ctx.clearRect(0, 0, w, h);
  const recent = chartEntries.slice(-50);
  if (recent.length === 0) return;
  const cumScores = computeCumScores(recent);
  const minS = 0; const maxS = Math.max(20, ...cumScores); const rangeS = maxS - minS || 1;
  const leftPad = 22; const rightPad = 6; const topPad = 6;
  const plotW = w - leftPad - rightPad; const plotH = h - topPad - 14;
  const toY = (val: number) => topPad + ((maxS - val) / rangeS) * plotH;
  const toX = (i: number) => leftPad + (i / (recent.length - 1 || 1)) * plotW;
  drawChartAxes(ctx, leftPad, rightPad, topPad, plotH, w, toY, minS, maxS);
  drawChartData(ctx, recent.length, toX, toY, cumScores, recent, topPad, plotH);
}

export function pushChartEntry(rating: number, correct: boolean) {
  chartEntries.push({ rating, correct });
  updateScoreSignals();
  drawChart();
  fetchRetention().then(() => updateScoreSignals());
}

export function initActivityEffects() {
  createEffect(() => {
    activeTab();
    syncActivity();
    loadActivity();
    loadSidebarScore();
  });

  createEffect(() => {
    handlerVersion();
    const tab = untrack(() => activeTab());
    if (!tab) return;
    const session = sectionHandlers.get(tab);
    if (session?.dueCount) session.dueCount();
    if (session?.score) session.score();
    untrack(() => { loadActivity(); loadSidebarScore(); });
  });

  const interval = setInterval(() => { loadActivity(); loadSidebarScore(); }, 5000);
  onCleanup(() => clearInterval(interval));
}
