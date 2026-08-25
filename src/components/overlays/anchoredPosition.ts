export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ViewportLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AnchoredPosition {
  left: number;
  top: number;
  horizontal: 'right' | 'left' | 'clamped';
  vertical: 'top' | 'bottom' | 'clamped';
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

/** Place a side panel within the current visual viewport, flipping before clamping. */
export function calculateAnchoredPosition(
  anchor: RectLike,
  panel: Pick<RectLike, 'width' | 'height'>,
  viewport: ViewportLike,
  gap = 6,
  margin = 8,
): AnchoredPosition {
  const viewportRight = viewport.left + viewport.width;
  const viewportBottom = viewport.top + viewport.height;
  const minLeft = viewport.left + margin;
  const maxLeft = viewportRight - margin - panel.width;
  const right = anchor.right + gap;
  const left = anchor.left - gap - panel.width;

  let resolvedLeft: number;
  let horizontal: AnchoredPosition['horizontal'];
  if (right <= maxLeft) {
    resolvedLeft = right;
    horizontal = 'right';
  } else if (left >= minLeft) {
    resolvedLeft = left;
    horizontal = 'left';
  } else {
    resolvedLeft = clamp(anchor.left, minLeft, maxLeft);
    horizontal = 'clamped';
  }

  const minTop = viewport.top + margin;
  const maxTop = viewportBottom - margin - panel.height;
  const topAligned = anchor.top;
  const bottomAligned = anchor.bottom - panel.height;
  let resolvedTop: number;
  let vertical: AnchoredPosition['vertical'];
  if (topAligned >= minTop && topAligned <= maxTop) {
    resolvedTop = topAligned;
    vertical = 'top';
  } else if (bottomAligned >= minTop && bottomAligned <= maxTop) {
    resolvedTop = bottomAligned;
    vertical = 'bottom';
  } else {
    resolvedTop = clamp(topAligned, minTop, maxTop);
    vertical = 'clamped';
  }

  return { left: Math.round(resolvedLeft), top: Math.round(resolvedTop), horizontal, vertical };
}
