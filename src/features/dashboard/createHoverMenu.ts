import { createSignal } from 'solid-js';

export function createHoverMenu() {
  const [openItems, setOpenItems] = createSignal<Set<string>>(new Set());
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function enter(key: string) {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    setOpenItems(prev => { const s = new Set(prev); s.add(key); return s; });
  }

  function leave(key: string) {
    setOpenItems(prev => { const s = new Set(prev); s.delete(key); return s; });
    scheduleClose();
  }

  function scheduleClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (openItems().size === 0) {
        setOpenItems(new Set<string>());
      }
      closeTimer = null;
    }, 50);
  }

  function closeAll() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    setOpenItems(new Set<string>());
  }

  function isOpen(key: string): boolean {
    return openItems().has(key);
  }

  return { openItems, enter, leave, closeAll, isOpen };
}
