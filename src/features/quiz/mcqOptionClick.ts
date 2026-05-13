import { easyMode } from '../../core/store/app.ts';
import type { McqView } from './types.ts';

type McqOptionClickView = Pick<McqView, 'state' | 'answer' | 'rate' | 'pickNextCard' | 'advanceFromHistory' | 'isCorrect'>;

export function handleMcqOptionClick(session: McqOptionClickView, option: string, isEasyMode = easyMode()) {
  const st = session.state();
  if (st === 'answering') {
    session.answer(option).catch(() => {});
    return;
  }
  if (st === 'reviewing-history') {
    session.advanceFromHistory();
    return;
  }
  if (st === 'rated') {
    session.pickNextCard().catch(() => {});
    return;
  }
  if (st === 'revealed' && isEasyMode) {
    session.rate(session.isCorrect() ? 3 : 1).catch(() => {});
  }
}
