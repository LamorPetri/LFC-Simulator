/**
 * Mittausten tasot ja nimet PLC Tag Map -datasetin rajojen mukaan (data, ei koodia).
 */
import { TagRec } from '../api';

export type Level = 'ok' | 'warn' | 'alarm';
export const levelColor = (l: Level) => (l === 'ok' ? '#38A169' : l === 'warn' ? '#ECC94B' : '#E53E3E');

/** Taso datasetin rajojen mukaan: punainen rajojen ulkopuolella (alarm), keltainen normal-alueen ulkopuolella. */
export function tagLevel(value: number, normalMin: number | null, normalMax: number | null, alarmBelow: number | null, alarmAbove: number | null): Level {
  if (alarmAbove !== null && value > alarmAbove) return 'alarm';
  if (alarmBelow !== null && value < alarmBelow) return 'alarm';
  if (normalMin !== null && value < normalMin) return 'warn';
  if (normalMax !== null && value > normalMax) return 'warn';
  return 'ok';
}

/** Näyttönimi: datasetin kuvaus tai nimi ilman tagi-etuliitettä ("CT-301 X" → "X"). */
export function tagLabel(t: TagRec): string {
  const d = t.description?.trim();
  if (d) return d;
  return t.name.replace(/^[A-Z]{2,4}-\d{3}\s*/, '').trim() || t.tag;
}
