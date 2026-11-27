import { useSim } from '../sim/store';

/** Viimeiset 10 min (1 Hz) Process-välilehden trendinauhaa varten. Kerätään aina, vaikka välilehti ei ole auki. */
export const TREND_KEYS = ['FT101', 'PDT103', 'CT301', 'LT401'] as const;
export type TrendKey = (typeof TREND_KEYS)[number];
const N = 600;

export const trend: Record<TrendKey, number[]> = { FT101: [], PDT103: [], CT301: [], LT401: [] };

useSim.subscribe((s, prev) => {
  if (s.lastTickAt === prev.lastTickAt) return;
  for (const k of TREND_KEYS) {
    trend[k].push(s.tags[k]);
    if (trend[k].length > N) trend[k].shift();
  }
});
