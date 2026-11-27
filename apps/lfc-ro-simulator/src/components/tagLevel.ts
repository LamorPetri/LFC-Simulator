import { TagRec } from '../api';

export type Level = 'ok' | 'warn' | 'alarm';

export function tagLevel(value: number, t: TagRec | undefined): Level {
  if (!t) return 'ok';
  if (t.alarmAbove !== null && value > t.alarmAbove) return 'alarm';
  if (t.alarmBelow !== null && value < t.alarmBelow) return 'alarm';
  if (t.normalMin !== null && value < t.normalMin) return 'warn';
  if (t.normalMax !== null && value > t.normalMax) return 'warn';
  return 'ok';
}

/** Väri vain tilalle: normaali on neutraali, varoitus ja hälytys erottuvat. */
export const levelColor = (l: Level) => (l === 'ok' ? 'var(--txt)' : `var(--${l})`);
