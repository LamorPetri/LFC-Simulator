import { useCallback, useMemo } from 'react';
import { useSim, startProduction, stopProduction } from './sim/store';
import { distM } from './sim/engine';
import { AreaRec, createSession, finishSession, createAlert, createAction } from './api';

interface Params {
  areas: AreaRec[];
  instructionByType: Record<string, string>;
  onAfterStop: () => void;
}

/** START/STOP-logiikka prosessi- ja 3D-näkymän yhteiseen käyttöön. */
export function useProduction({ areas, instructionByType, onAfterStop }: Params) {
  const sim = useSim();

  const nearestArea = useMemo(() => {
    let best: AreaRec | null = null;
    let bd = Infinity;
    for (const a of areas) {
      if (a.lat === null || a.lon === null) continue;
      const d = distM(a.lat, a.lon, sim.vessel.lat, sim.vessel.lon);
      const lim = (a.radiusKm ?? 4) * 1000;
      if (d < lim && d < bd) { bd = d; best = a; }
    }
    return best;
  }, [areas, sim.vessel.lat, sim.vessel.lon]);

  const handleStart = useCallback(() => {
    const { evalResult, recommendation } = startProduction();
    void (async () => {
      try {
        const sid = await createSession({
          areaId: nearestArea?.id ?? null,
          lat: useSim.getState().vessel.lat,
          lon: useSim.getState().vessel.lon,
          capacity: useSim.getState().capacity,
          tempC: Math.round(useSim.getState().tags.TT104),
        });
        useSim.getState().setSessionId(sid);
        if (evalResult.status === 'farm' || evalResult.status === 'shallow') {
          const type = evalResult.status === 'farm' ? 'Fish farm proximity' : 'Shallow water';
          const msg = evalResult.status === 'farm'
            ? `Production started inside a fish-farm zone (${evalResult.reasons.join('; ')}). Predictive maintenance after stop: ${recommendation.join(' + ')}.`
            : `Production started on shallows (${evalResult.reasons.join('; ')}). Predictive maintenance after stop: ${recommendation.join(' + ')}.`;
          await createAlert({ type, severity: 'Warning', message: msg, areaId: nearestArea?.id ?? null, sessionId: sid });
          useSim.getState().pushBanner({ id: `live-${Date.now()}`, type, severity: 'Warning', message: msg });
        }
      } catch (e) {
        console.error('session create failed', e);
      }
    })();
  }, [nearestArea]);

  const handleStop = useCallback(() => {
    const result = stopProduction();
    const needsMaintenance = !result.recommendation.includes('Normal stop');
    void (async () => {
      try {
        const sid = useSim.getState().sessionId;
        if (sid) {
          await finishSession(sid, {
            volume: result.volume,
            dp: result.dp,
            conductivity: result.conductivity,
            needsMaintenance,
            startedAt: useSim.getState().startedAt ?? Date.now(),
            ph: sim.phCount > 0 ? sim.phSum / sim.phCount : 7.5,
            naoh: sim.naohLiters,
            antiscalant: sim.antiscalantLiters,
          });
          if (needsMaintenance) {
            await createAction({
              name: `${result.recommendation.join(' + ')} after session`,
              actionType: result.recommendation[0],
              instructionId: instructionByType[result.recommendation[0]] ?? null,
              sessionId: sid,
              notes: `Auto-generated at stop. Point: ${useSim.getState().vessel.lat.toFixed(4)}, ${useSim.getState().vessel.lon.toFixed(4)}`,
            });
          }
        }
      } catch (e) {
        console.error('session finish failed', e);
      } finally {
        onAfterStop();
      }
    })();
  }, [instructionByType, onAfterStop]);

  return { handleStart, handleStop, nearestArea, producing: sim.producing };
}
