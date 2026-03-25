export function niceYTicks(min: number, max: number, targetCount: number): number[] {
  if (max <= min) return [min];
  const range = max - min;
  const rawStep = range / (targetCount - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  let niceStep: number;
  if (residual <= 1.5) niceStep = 1 * mag;
  else if (residual <= 3.5) niceStep = 2 * mag;
  else if (residual <= 7.5) niceStep = 5 * mag;
  else niceStep = 10 * mag;

  const ticks: number[] = [];
  const start = Math.ceil(min / niceStep) * niceStep;
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
    ticks.push(Math.round(v));
  }
  if (!ticks.includes(0)) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

export function computeCumScores(entries: { rating: number; correct: boolean }[]): number[] {
  const cumScores: number[] = [];
  let running = 0;
  for (const e of entries) {
    if (!e.correct || e.rating === 1) running -= 2;
    else if (e.rating === 4) running += 4;
    else if (e.rating === 3) running += 3;
    else running += 1;
    running = Math.max(0, running);
    cumScores.push(running);
  }
  return cumScores;
}

export function drawChartAxes(ctx: CanvasRenderingContext2D, leftPad: number, rightPad: number, topPad: number, plotH: number, w: number, toY: (v: number) => number, minS: number, maxS: number) {
  const zeroY = Math.round(toY(0)) + 0.5;
  ctx.strokeStyle = 'rgba(45, 42, 38, 0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(leftPad, zeroY); ctx.lineTo(w - rightPad, zeroY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(leftPad + 0.5, topPad); ctx.lineTo(leftPad + 0.5, topPad + plotH); ctx.stroke();
  const yTicks = niceYTicks(minS, maxS, 5);
  ctx.fillStyle = 'rgba(45, 42, 38, 0.45)'; ctx.font = '7px sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const val of yTicks) {
    const y = toY(val);
    ctx.strokeStyle = 'rgba(45, 42, 38, 0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(leftPad - 3, y); ctx.lineTo(leftPad, y); ctx.stroke();
    ctx.fillStyle = 'rgba(45, 42, 38, 0.45)'; ctx.fillText(String(val), leftPad - 5, y);
  }
}

export function drawChartData(ctx: CanvasRenderingContext2D, n: number, toX: (i: number) => number, toY: (v: number) => number, cumScores: number[], recent: { correct: boolean }[], topPad: number, plotH: number) {
  const xStep = n <= 10 ? 1 : n <= 25 ? 5 : 10;
  ctx.fillStyle = 'rgba(45, 42, 38, 0.45)'; ctx.font = '7px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i < n; i++) {
    const qNum = i + 1;
    if (qNum === 1 || qNum === n || qNum % xStep === 0) {
      const x = toX(i);
      ctx.strokeStyle = 'rgba(45, 42, 38, 0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, topPad + plotH); ctx.lineTo(x, topPad + plotH + 3); ctx.stroke();
      ctx.fillStyle = 'rgba(45, 42, 38, 0.45)'; ctx.fillText(String(qNum), x, topPad + plotH + 4);
    }
  }
  ctx.strokeStyle = 'rgba(74, 127, 181, 0.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < n; i++) { const x = toX(i); const y = toY(cumScores[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = recent[i].correct ? '#3d7a4f' : '#a84036';
    ctx.beginPath(); ctx.arc(toX(i), toY(cumScores[i]), 3, 0, Math.PI * 2); ctx.fill();
  }
}
