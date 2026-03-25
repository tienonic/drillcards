import { createSignal } from 'solid-js';

// Global handler registry for keyboard routing (stores QuizSession or MathSession)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sectionHandlers = new Map<string, any>();
// Version signal to make sectionHandlers reads reactive in SolidJS
const [handlerVersion, setHandlerVersion] = createSignal(0);
export { handlerVersion };
export function bumpHandlerVersion() { setHandlerVersion(v => v + 1); }
