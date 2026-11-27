import { useMemo } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, Flex, HStack, Heading, SimpleGrid, Slider,
  SliderFilledTrack, SliderThumb, SliderTrack, Stat, StatLabel, StatNumber, Text, Tooltip,
} from '@chakra-ui/react';
import { useSim, startProduction, stopProduction } from '../sim/store';
import { tagLabel } from '../sim/tagLimits';
import { TagRec, AreaRec, createSession, finishSession, createAlert, createAction } from '../api';

interface Props {
  tags: TagRec[];
  areas: AreaRec[];
  instructionByType: Record<string, string>;
  onAfterStop: () => void;
}

type Level = 'ok' | 'warn' | 'alarm';

function tagLevel(value: number, t: TagRec): Level {
  if (t.alarmAbove !== null && value > t.alarmAbove) return 'alarm';
  if (t.alarmBelow !== null && value < t.alarmBelow) return 'alarm';
  if (t.normalMin !== null && value < t.normalMin) return 'warn';
  if (t.normalMax !== null && value > t.normalMax) return 'warn';
  return 'ok';
}

const levelColor = (l: Level) => (l === 'ok' ? '#38A169' : l === 'warn' ? '#DD6B20' : '#E53E3E');

function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(digits);
}

/** Mittarisiru: tag + arvo viitavärillä, HMI-tyyliin. */
function Gauge({ x, y, tag, value, unit, color }: { x: number | string; y: number | string; tag: string; value: string; unit: string; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-58" y="-21" width="116" height="42" rx="8" fill="rgba(12,18,32,0.82)" stroke={color} strokeWidth="1.4" />
      <rect x="-58" y="-21" width="116" height="10" rx="5" fill="rgba(255,255,255,0.06)" />
      <text x="0" y="-6" textAnchor="middle" fontSize="9" fill="#a0aec8" letterSpacing="0.5">{tag}</text>
      <text x="0" y="14" textAnchor="middle" fontSize="16" fontWeight="700" fill={color} fontFamily="'Segoe UI', sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
        <tspan fontSize="9" fill="#8e9ab8"> {unit}</tspan>
      </text>
    </g>
  );
}

export default function ProcessView({ tags, areas, instructionByType, onAfterStop }: Props) {
  const sim = useSim();
  const tagByTag = useMemo(() => {
    const m: Record<string, TagRec> = {};
    tags.forEach((t) => { m[t.tag] = t; });
    return m;
  }, [tags]);

  const v = sim.vesselEval;
  const nearestArea = useMemo(() => {
    let best: AreaRec | null = null;
    let bd = Infinity;
    for (const a of areas) {
      if (a.lat === null || a.lon === null) continue;
      const d = Math.hypot((a.lat - sim.vessel.lat) * 111320, (a.lon - sim.vessel.lon) * 55000);
      const lim = (a.radiusKm ?? 4) * 1000;
      if (d < lim && d < bd) { bd = d; best = a; }
    }
    return best;
  }, [areas, sim.vessel.lat, sim.vessel.lon]);

  const valueOf = (tag: string): number => {
    const map: Record<string, number> = {
      'FT-101': sim.tags.FT101, 'PT-102': sim.tags.PT102, 'PDT-103': sim.tags.PDT103,
      'FT-201': sim.tags.FT201, 'CT-301': sim.tags.CT301, 'LT-401': sim.tags.LT401, 'TT-104': sim.tags.TT104, 'AT-501': sim.tags.AT501, 'FT-501': sim.tags.FT501, 'FT-502': sim.tags.FT502,
    };
    return map[tag] ?? 0;
  };
  const gaugeColor = (tag: string): string => {
    const t = tagByTag[tag];
    if (!t) return '#718096';
    return levelColor(tagLevel(valueOf(tag), t));
  };

  const statusColor = v.status === 'good' ? '#38A169' : v.status === 'caution' ? '#DD6B20' : '#E53E3E';
  const statusLabel = v.status === 'good' ? 'SUITABLE' : v.status === 'caution' ? 'CAUTION' : v.status === 'farm' ? 'FISH FARM ZONE' : 'SHALLOW WATER';
  const producing = sim.producing;
  // PDT-102: AquaBollin paine-ero kasvaa likaantumisen kanssa (0.2-0.7 bar)
  const abollDp = sim.abollDp;

  const handleStart = () => {
    const { evalResult, recommendation } = startProduction();
    void (async () => {
      try {
        const sid = await createSession({
          areaId: nearestArea?.id ?? null,
          lat: sim.vessel.lat,
          lon: sim.vessel.lon,
          capacity: sim.capacity,
          tempC: Math.round(sim.tags.TT104),
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
  };

  const handleStop = () => {
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
              notes: `Auto-generated at stop. Point: ${sim.vessel.lat.toFixed(4)}, ${sim.vessel.lon.toFixed(4)}`,
            });
          }
        }
      } catch (e) {
        console.error('session finish failed', e);
      } finally {
        onAfterStop();
      }
    })();
  };

  const pipe = producing ? '#4aa3e0' : '#5a7fa8';
  const train2Active = sim.capacity > 63;
  const t2pipe = train2Active ? pipe : '#3a4f6b';
  const t2dim = train2Active ? 1 : 0.35;
  const permPipe = producing ? '#7fd8f2' : '#4a7fa0';

  return (
    <Flex direction="column" gap={3} height="100%" overflowY="auto">
      {sim.banners.map((b) => (
        <Alert status={b.severity === 'Critical' ? 'error' : 'warning'} key={b.id} borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <Text fontWeight="bold">{b.type}</Text>
            <Text fontSize="sm">{b.message}</Text>
          </Box>
          <Button size="xs" variant="outline" onClick={() => useSim.getState().dismissBanner(b.id)}>Dismiss</Button>
        </Alert>
      ))}

      <Flex gap={4} direction={{ base: 'column', xl: 'row' }} flex="1" minH="0">
        {/* Prosessikaavio */}
        <Box flex="1.6" minW="0" borderRadius="lg" overflow="hidden" borderWidth="1px" borderColor="#39435f" className="lfc-pid">
          <svg viewBox="0 0 960 460" style={{ width: '100%', height: '100%' }} role="img" aria-label="RO process diagram">
  <defs>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(110,126,168,0.10)" strokeWidth="1" />
    </pattern>
    <linearGradient id="boxG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#2c3550" />
      <stop offset="1" stopColor="#1b2236" />
    </linearGradient>
    <linearGradient id="pipeG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={producing ? '#63b8ec' : '#6a8fb8'} />
      <stop offset="1" stopColor={pipe} />
    </linearGradient>
    <linearGradient id="liqG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8fdcf5" />
      <stop offset="1" stopColor="#2f7fb5" />
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3.2" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>

  <rect width="960" height="460" fill="#0d1220" />
  <rect width="960" height="460" fill="url(#grid)" />

  {/* otsikko + indikaattorit */}
  <rect x="12" y="10" width="330" height="30" rx="6" fill="rgba(20,28,46,0.9)" stroke="#39435f" />
  <text x="24" y="30" fill="#cdd6ea" fontSize="13" fontWeight="700" letterSpacing="2">RO WATER TREATMENT · HMI</text>
  <circle cx="320" cy="25" r="5" fill={producing ? '#38A169' : '#5a6478'} />
  {producing && <circle cx="320" cy="25" r="9" fill="none" stroke="#38A169" strokeWidth="1" opacity="0.5" className="lfc-pulse" />}

  <rect x="12" y="48" width="140" height="34" rx="7" fill="rgba(20,28,46,0.9)" stroke="#39435f" />
  <text x="20" y="60" fontSize="7" fill="#8e9ab8" letterSpacing="1">FOULING</text>
  <text x="144" y="61" textAnchor="end" fontSize="10" fontWeight="700" fill="#cdd6ea" style={{ fontVariantNumeric: 'tabular-nums' }}>{sim.fouling.toFixed(0)} %</text>
  <rect x="20" y="66" width="116" height="8" rx="4" fill="#141b2d" />
  <rect x="20" y="66" width={Math.max(3, (sim.fouling / 100) * 116)} height="8" rx="4" fill={sim.fouling > 70 ? '#E53E3E' : sim.fouling > 40 ? '#DD6B20' : '#38A169'} />

  <rect x="424" y="8" width="112" height="45" rx="8" fill="rgba(20,28,46,0.9)" stroke="#39435f" />
  <text x="480" y="22" textAnchor="middle" fontSize="7" fill="#8e9ab8" letterSpacing="1.5">PRODUCED</text>
  <text x="480" y="44" textAnchor="middle" fontSize="16" fontWeight="700" fill="#7fd8f2" style={{ fontVariantNumeric: 'tabular-nums' }}>{sim.volume.toFixed(0)} m³</text>

  {/* ================== ESAKASITTELYPUTKISTO (y=221) ================== */}
  <g filter={producing ? 'url(#glow)' : undefined}>
    <line x1="110" y1="221" x2="124" y2="221" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="218" y1="221" x2="230" y2="221" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="294" y1="221" x2="312" y2="221" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="312" y1="184" x2="312" y2="232" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="312" y1="184" x2="321" y2="184" stroke="url(#pipeG)" strokeWidth="5" />
    <line x1="312" y1="232" x2="321" y2="232" stroke="url(#pipeG)" strokeWidth="5" />
    <line x1="379" y1="184" x2="388" y2="184" stroke={pipe} strokeWidth="4.5" />
    <line x1="379" y1="232" x2="388" y2="232" stroke={pipe} strokeWidth="4.5" />
    {/* C2 -> HPP 1 (oma syottoelinja) */}
    <line x1="446" y1="184" x2="466" y2="184" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="466" y1="184" x2="466" y2="190" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="466" y1="190" x2="500" y2="190" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    {producing && <line x1="448" y1="184" x2="464" y2="184" stroke="#bfe6ff" strokeWidth="1.8" strokeDasharray="10 18" className="lfc-flow" />}
    {producing && <line x1="466" y1="192" x2="498" y2="192" stroke="#bfe6ff" strokeWidth="1.8" strokeDasharray="10 18" className="lfc-flow" />}
    <text x="456" y="176" fontSize="7" fill="#63b8ec">FEED 1</text>
    <line x1="496" y1="181" x2="496" y2="199" stroke="#8fa3b8" strokeWidth="2" />
    <line x1="500" y1="181" x2="500" y2="199" stroke="#8fa3b8" strokeWidth="2" />
    {/* C4 -> HPP 2 (oma syottoelinja) */}
    <line x1="446" y1="232" x2="466" y2="232" stroke={t2pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="466" y1="232" x2="466" y2="252" stroke={t2pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="466" y1="252" x2="500" y2="252" stroke={t2pipe} strokeWidth="6" strokeLinecap="square" />
    {producing && train2Active && <line x1="448" y1="232" x2="464" y2="232" stroke="#bfe6ff" strokeWidth="1.8" strokeDasharray="10 18" className="lfc-flow" />}
    {producing && train2Active && <line x1="466" y1="254" x2="498" y2="254" stroke="#bfe6ff" strokeWidth="1.8" strokeDasharray="10 18" className="lfc-flow" />}
    <text x="456" y="245" fontSize="7" fill="#63b8ec">FEED 2</text>
    <line x1="496" y1="243" x2="496" y2="261" stroke="#8fa3b8" strokeWidth="2" />
    <line x1="500" y1="243" x2="500" y2="261" stroke="#8fa3b8" strokeWidth="2" />


    {/* jakauma kahteen linjaan */}



  </g>
  <circle cx="312" cy="221" r="4" fill="#63b8ec" opacity={producing ? 0.9 : 0.4} />



  {/* ================== LINJA 1: HPP 1 suoraan + iSAVE 1 rinnan (PX) ================== */}
  <g>
    {/* LP-syotto iSave 1:een (ennen HPP 1) */}
    <circle cx="478" cy="184" r="4" fill="#4aa3e0" opacity={producing ? 0.9 : 0.4} />
    <line x1="478" y1="182" x2="478" y2="143" stroke="#4aa3e0" strokeWidth="3" />
    <line x1="478" y1="143" x2="545" y2="143" stroke="#4aa3e0" strokeWidth="3" />
    {/* HPP 1 (APP) */}
    <rect x="500" y="170" width="61" height="6" rx="2" fill="#141b2d" stroke="#3f5a7d" />
    <rect x="500" y="170" width="34" height="40" rx="8" fill="url(#boxG)" stroke="#3f5a7d" strokeWidth="1.3" />
    {[0, 1, 2].map((k) => <line key={k} x1="505" y1={177 + k * 9} x2="529" y2={177 + k * 9} stroke="#2c3d55" strokeWidth="1.6" />)}
    <rect x="532" y="178" width="35" height="24" rx="7" fill="url(#boxG)" stroke={producing ? '#4aa3e0' : '#3f5a7d'} strokeWidth="1.4" />
    <line x1="535" y1="190" x2="560" y2="190" stroke="#41567a" strokeWidth="1.2" />
    <circle cx="560" cy="190" r="8" fill="#0d1220" stroke="#7fd8f2" strokeWidth="1.2" />
    <g className={producing ? 'lfc-spin' : ''} style={{ transformOrigin: '560px 190px' }}>
      {[0, 51.4, 102.9, 154.3, 205.7, 257.1, 308.6].map((a) => (
        <circle key={a} cx="560" cy="186.4" r="1.4" fill="#7fd8f2" transform={`rotate(${a} 560 190)`} />
      ))}
    </g>
    <text x="517" y="228" textAnchor="middle" fontSize="8" fill="#a0aec8" letterSpacing="0.3">HPP 1</text>
    {/* iSAVE 1 ylhaalla (LP-puoli) */}
    <text x="570" y="124" textAnchor="middle" fontSize="8" fill="#a0aec8" letterSpacing="0.3">iSAVE 1</text>
    <rect x="545" y="128" width="51" height="30" rx="12" fill="url(#boxG)" stroke={producing ? '#7fd8f2' : '#3f5a7d'} strokeWidth="1.4" />
    <rect x="548" y="131" width="5" height="24" rx="2" fill="#0d1220" stroke="#3f5a7d" strokeWidth="0.8" />
    <rect x="588" y="131" width="5" height="24" rx="2" fill="#0d1220" stroke="#3f5a7d" strokeWidth="0.8" />
    <rect x="556" y="133" width="27" height="5" rx="2.5" fill="#39c2d7" opacity="0.7" />
    <g className={producing ? 'lfc-spin' : ''} style={{ transformOrigin: '570px 143px' }}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1="570" y1="135" x2="570" y2="139" stroke="#7fd8f2" strokeWidth="1.4" transform={`rotate(${a} 570 143)`} />
      ))}
    </g>
    <circle cx="570" cy="143" r="3.2" fill="#0d1220" stroke="#7fd8f2" strokeWidth="0.9" />
    {/* HPP 1 SUORAAN paineheaderiin (x=640) */}
    <line x1="567" y1="190" x2="640" y2="190" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="640" y1="190" x2="640" y2="164" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    {/* iSave 1 HP-ulos yhteiseen headeriin */}
    <line x1="596" y1="136" x2="640" y2="136" stroke={pipe} strokeWidth="5" strokeLinecap="square" />
    <line x1="640" y1="136" x2="640" y2="164" stroke={pipe} strokeWidth="5" strokeLinecap="square" />
    {/* T-risteys: molemmat työntavat stackille */}
    <circle cx="640" cy="164" r="4" fill="#63b8ec" opacity={producing ? 0.9 : 0.4} />
    <line x1="640" y1="164" x2="668" y2="164" stroke={pipe} strokeWidth="6" strokeLinecap="square" />
    <polygon points="668,164 660,160 660,168" fill={pipe} />
    {/* brine stack 1 -> iSave 1 */}
    <line x1="743" y1="210" x2="743" y2="222" stroke="#4a5470" strokeWidth="3.5" strokeDasharray="7 5" opacity="0.85" />
    <line x1="743" y1="222" x2="585" y2="222" stroke="#4a5470" strokeWidth="3.5" strokeDasharray="7 5" opacity="0.85" />
    <line x1="585" y1="222" x2="585" y2="158" stroke="#4a5470" strokeWidth="3.5" strokeDasharray="7 5" opacity="0.85" />
    {/* brine out iSave 1 */}
    <line x1="596" y1="150" x2="648" y2="150" stroke="#4a5470" strokeWidth="3.5" opacity="0.85" />
    {producing && (
      <g stroke="#c9f0fc" strokeWidth="1.2" strokeDasharray="8 16" className="lfc-flow">
        <line x1="569" y1="190" x2="638" y2="190" />
        <line x1="598" y1="136" x2="638" y2="136" />
        {/* LP-feed iSaveen */}
        <line x1="480" y1="143" x2="543" y2="143" stroke="#7fc8e8" />
      </g>
    )}
  </g>

  {/* ================== LINJA 2: HPP 2 suoraan + iSAVE 2 rinnan (PX) ================== */}
  <g>
    {/* LP-syotto iSave 2:een (ennen HPP 2) */}
    <circle cx="478" cy="252" r="4" fill="#4aa3e0" opacity={producing ? 0.9 : 0.4} />
    <line x1="478" y1="254" x2="478" y2="297" stroke="#4aa3e0" strokeWidth="3" />
    <line x1="478" y1="297" x2="545" y2="297" stroke="#4aa3e0" strokeWidth="3" />
    {/* HPP 2 (APP) */}
    <rect x="500" y="246" width="61" height="6" rx="2" fill="#141b2d" stroke="#3f5a7d" />
    <rect x="500" y="232" width="34" height="40" rx="8" fill="url(#boxG)" stroke="#3f5a7d" strokeWidth="1.3" />
    {[0, 1, 2].map((k) => <line key={k} x1="505" y1={239 + k * 9} x2="529" y2={239 + k * 9} stroke="#2c3d55" strokeWidth="1.6" />)}
    <rect x="532" y="240" width="35" height="24" rx="7" fill="url(#boxG)" opacity={t2dim} stroke={producing && train2Active ? '#4aa3e0' : '#3f5a7d'} strokeWidth="1.4" />
    <line x1="535" y1="252" x2="560" y2="252" stroke="#41567a" strokeWidth="1.2" />
    <circle cx="560" cy="252" r="8" fill="#0d1220" stroke="#7fd8f2" strokeWidth="1.2" />
    <g className={producing && train2Active ? 'lfc-spin' : ''} style={{ transformOrigin: '560px 252px', opacity: t2dim }}>
      {[0, 51.4, 102.9, 154.3, 205.7, 257.1, 308.6].map((a) => (
        <circle key={a} cx="560" cy="248.4" r="1.4" fill="#7fd8f2" transform={`rotate(${a} 560 252)`} />
      ))}
    </g>
    <text x="517" y="230" textAnchor="middle" fontSize="8" fill="#a0aec8" letterSpacing="0.3">{train2Active ? 'HPP 2' : 'HPP 2 · STANDBY'}</text>
    {/* iSAVE 2 alhaalla (LP-puoli) */}
    <rect x="545" y="282" width="51" height="30" rx="12" fill="url(#boxG)" opacity={t2dim} stroke={producing && train2Active ? '#7fd8f2' : '#3f5a7d'} strokeWidth="1.4" />
    <rect x="548" y="285" width="5" height="24" rx="2" fill="#0d1220" stroke="#3f5a7d" strokeWidth="0.8" />
    <rect x="588" y="285" width="5" height="24" rx="2" fill="#0d1220" stroke="#3f5a7d" strokeWidth="0.8" />
    <rect x="556" y="287" width="27" height="5" rx="2.5" fill="#39c2d7" opacity="0.7" />
    <g className={producing && train2Active ? 'lfc-spin' : ''} style={{ transformOrigin: '570px 297px', opacity: t2dim }}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1="570" y1="289" x2="570" y2="293" stroke="#7fd8f2" strokeWidth="1.4" transform={`rotate(${a} 570 297)`} />
      ))}
    </g>
    <circle cx="570" cy="297" r="3.2" fill="#0d1220" stroke="#7fd8f2" strokeWidth="0.9" />
    <text x="570" y="326" textAnchor="middle" fontSize="7" fill="#8e9ab8">{train2Active ? 'iSAVE 2' : 'iSAVE 2 · STANDBY'}</text>
    {/* HPP 2 SUORAAN paineheaderiin (x=640) */}
    <line x1="567" y1="252" x2="640" y2="252" stroke={t2pipe} strokeWidth="6" strokeLinecap="square" />
    <line x1="640" y1="252" x2="640" y2="282" stroke={t2pipe} strokeWidth="6" strokeLinecap="square" />
    {/* iSave 2 HP-ulos yhteiseen headeriin */}
    <line x1="596" y1="304" x2="640" y2="304" stroke={t2pipe} strokeWidth="5" strokeLinecap="square" />
    <line x1="640" y1="304" x2="640" y2="282" stroke={t2pipe} strokeWidth="5" strokeLinecap="square" />
    {/* T-risteys: molemmat työntavat stackille */}
    <circle cx="640" cy="282" r="4" fill={train2Active ? "#63b8ec" : "#5a6478"} opacity={producing && train2Active ? 0.9 : 0.4} />
    <line x1="640" y1="282" x2="668" y2="282" stroke={t2pipe} strokeWidth="6" strokeLinecap="square" />
    <polygon points="668,282 660,278 660,286" fill={t2pipe} />
    {/* brine stack 2 -> iSave 2 */}
    <line x1="743" y1="328" x2="743" y2="348" stroke="#4a5470" strokeWidth="3.5" strokeDasharray="7 5" opacity="0.85" />
    <line x1="743" y1="348" x2="585" y2="348" stroke="#4a5470" strokeWidth="3.5" strokeDasharray="7 5" opacity="0.85" />
    <line x1="585" y1="348" x2="585" y2="312" stroke="#4a5470" strokeWidth="3.5" strokeDasharray="7 5" opacity="0.85" />
    {/* brine out iSave 2 */}
    <line x1="596" y1="292" x2="648" y2="292" stroke="#4a5470" strokeWidth="3.5" opacity="0.85" />
    {producing && train2Active && (
      <g stroke="#c9f0fc" strokeWidth="1.2" strokeDasharray="8 16" className="lfc-flow">
        <line x1="569" y1="252" x2="638" y2="252" />
        <line x1="598" y1="304" x2="638" y2="304" />
        {/* LP-feed iSaveen */}
        <line x1="480" y1="297" x2="543" y2="297" stroke="#7fc8e8" />
      </g>
    )}
  </g>
  {/* yhteinen brine-pudotaja ja ulosvienti */}
  <line x1="648" y1="150" x2="648" y2="452" stroke="#4a5470" strokeWidth="3.5" strokeDasharray="7 5" opacity="0.85" />
  <line x1="648" y1="452" x2="824" y2="452" stroke="#4a5470" strokeWidth="4" strokeDasharray="8 6" opacity="0.85" />
  <polygon points="838,452 824,446 824,458" fill="#4a5470" />
  <text x="740" y="446" textAnchor="middle" fontSize="10" fill="#a0aec8" letterSpacing="0.5">brine out</text>

  {/* CIP-paluu suoraan stackkien alta (iSave ohitetaan) */}
  {/* stack 1 brine-pudotuksesta T-risteys y=214 */}
  <circle cx="743" cy="214" r="3" fill="#7bd389" opacity="0.7" />
  <line x1="743" y1="214" x2="726" y2="214" stroke="#4a7d63" strokeWidth="3" strokeDasharray="6 5" opacity="0.85" />
  {/* stack 2 brine-pudotuksesta T-risteys y=336 */}
  <circle cx="743" cy="336" r="3" fill="#7bd389" opacity="0.7" />
  <line x1="743" y1="336" x2="726" y2="336" stroke="#4a7d63" strokeWidth="3" strokeDasharray="6 5" opacity="0.85" />
  {/* yhteinen paluupysty (x=726) alas tankille */}
  <line x1="726" y1="214" x2="726" y2="336" stroke="#4a7d63" strokeWidth="3" strokeDasharray="6 5" opacity="0.85" />
  <line x1="726" y1="336" x2="726" y2="446" stroke="#4a7d63" strokeWidth="3" strokeDasharray="6 5" opacity="0.85" />
  <line x1="726" y1="440" x2="498" y2="440" stroke="#4a7d63" strokeWidth="3" strokeDasharray="6 5" opacity="0.85" />
  <line x1="498" y1="440" x2="494" y2="440" stroke="#4a7d63" strokeWidth="3" strokeDasharray="6 5" opacity="0.85" />
  <polygon points="494,440 502,436 502,444" fill="#4a7d63" />
  <text x="670" y="436" textAnchor="middle" fontSize="8" fill="#7da98c" letterSpacing="0.3">CIP return</text>





  {/* ================== LAITTEET ================== */}
  <rect x="16" y="150" width="94" height="140" rx="14" fill="url(#boxG)" stroke="#3f5a7d" strokeWidth="1.5" />
  <path d="M20,205 q10,-7 21,0 t21,0 t21,0 t21,0" stroke="#4aa3e0" strokeWidth="2" fill="none" opacity="0.7" className="lfc-wave" />
  <path d="M20,215 q10,-7 21,0 t21,0 t21,0 t21,0" stroke="#4aa3e0" strokeWidth="2" fill="none" opacity="0.4" className="lfc-wave2" />
  <text x="63" y="185" textAnchor="middle" fill="#e2e8f0" fontSize="12" fontWeight="700" letterSpacing="0.5">SEAWATER</text>
  <text x="63" y="250" textAnchor="middle" fontSize="10" fill="#a0aec8">depth {v.depth === null ? '—' : v.depth.toFixed(0)} m</text>
  <text x="63" y="266" textAnchor="middle" fontSize="10" fontWeight="700" fill={statusColor}>{statusLabel}</text>
  <text x="63" y="282" textAnchor="middle" fontSize="9" fill="#8e9ab8">{v.farm ? `farm ${(v.farm.distM / 1000).toFixed(2)} km` : ''}</text>

  <rect x="124" y="176" width="94" height="88" rx="10" fill="url(#boxG)" stroke="#3f5a7d" strokeWidth="1.5" />
  <circle cx="171" cy="220" r="27" fill="#141b2d" stroke={producing ? '#4aa3e0' : '#41567a'} strokeWidth="2" />
  <circle cx="171" cy="220" r="19" fill="none" stroke="#41567a" strokeWidth="1.2" />
  <circle cx="171" cy="220" r="10" fill="none" stroke="#41567a" strokeWidth="1.2" />
  <g className={producing ? 'lfc-spin-slow' : ''} style={{ transformOrigin: '171px 220px' }}>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <line key={a} x1="171" y1="193" x2="171" y2="201" stroke="#5b7396" strokeWidth="1.6" transform={`rotate(${a} 171 220)`} />
    ))}
  </g>
  <rect x="198" y="180" width="12" height="7" rx="2" fill="#41567a" />
  <line x1="204" y1="187" x2="188" y2="200" stroke="#4aa3e0" strokeWidth="1.6" strokeDasharray="3 3" opacity="0.8" />
  <line x1="171" y1="264" x2="171" y2="286" stroke="#4a5470" strokeWidth="4" strokeDasharray="5 4" />
  
  <text x="171" y="300" textAnchor="middle" fontSize="9" fill="#a0aec8">drum filter</text>

  <rect x="230" y="176" width="64" height="90" rx="16" fill="url(#boxG)" stroke={producing ? '#4aa3e0' : '#3f5a7d'} strokeWidth="1.5" />
  <rect x="234" y="182" width="56" height="78" rx="12" fill="none" stroke="#2c3d55" strokeWidth="1.4" />
  {[0, 1, 2].map((k) => <line key={k} x1="236" y1={198 + k * 22} x2="288" y2={198 + k * 22} stroke="#41567a" strokeWidth="1.8" />)}
  <rect x="248" y="192" width="28" height="60" rx="10" fill="rgba(79,209,224,0.08)" stroke="#5b7396" strokeWidth="1" strokeDasharray="4 3" />
  <circle cx="262" cy="186" r="4.5" fill="none" stroke="#4aa3e0" strokeWidth="1.4" className={producing ? 'lfc-spin-slow' : ''} style={{ transformOrigin: '262px 186px' }} />
  <line x1="262" y1="266" x2="262" y2="286" stroke="#4a5470" strokeWidth="4" strokeDasharray="5 4" />
  <text x="262" y="182" textAnchor="middle" fontSize="8" fill="#8e9ab8" letterSpacing="0.5">AQUABOLL</text>
  <text x="262" y="300" textAnchor="middle" fontSize="9" fill="#a0aec8">auto filter</text>

  <rect x="298" y="168" width="22" height="34" rx="6" fill="url(#boxG)" stroke={producing ? '#c9a227' : '#3f5a7d'} strokeWidth="1.4" />
  <rect x="302" y="186" width="14" height="12" fill="#c9a227" opacity="0.4" />
  <line x1="309" y1="202" x2="309" y2="217" stroke="#c9a227" strokeWidth="3" strokeDasharray="3 2" />
  <text x="309" y="163" textAnchor="middle" fontSize="7" fill="#c9a227">FT-502</text>

  {[164, 212].map((yy, i) => (
    <g key={i}>
      {[321, 388].map((xx, j) => (
        <g key={j}>
          <rect x={xx} y={yy} width="58" height="40" rx="19" fill="url(#boxG)" stroke={producing && sim.fouling > 40 ? '#DD6B20' : '#3f5a7d'} strokeWidth="1.5" />
          {[1, 2].map((k) => <line key={k} x1={xx + 16 * k + 4} y1={yy + 6} x2={xx + 16 * k + 4} y2={yy + 34} stroke="#5b7396" strokeWidth="1.8" />)}
          <text x={xx + 29} y={yy + 52} textAnchor="middle" fontSize="9" fill="#a0aec8" fontWeight="600">C{i * 2 + j + 1}</text>
        </g>
      ))}
    </g>
  ))}

  {/* ================== RO-STACKIT ================== */}
  {[118, 236].map((ry, li) => (
    <g key={li}>
      <rect x="668" y={ry} width="150" height="92" rx="6" fill="rgba(16,22,38,0.75)" stroke="#3f5a7d" strokeWidth="1.6" />
      <line x1="668" y1={ry + 30} x2="818" y2={ry + 30} stroke="#2c3d55" strokeWidth="1" />
      <line x1="668" y1={ry + 62} x2="818" y2={ry + 62} stroke="#2c3d55" strokeWidth="1" />
      {[0, 1, 2].map((row) => (
        <g key={row}>
          {[0, 1].map((col) => (
            <g key={col}>
              <rect x={676 + col * 68} y={ry + 7 + row * 30} width="62" height="17" rx="8.5" fill="url(#boxG)" stroke={producing ? '#7fd8f2' : '#41567a'} strokeWidth="1.4" />
              {[1, 2, 3].map((seg) => <line key={seg} x1={676 + col * 68 + seg * 14} y1={ry + 10 + row * 30} x2={676 + col * 68 + seg * 14} y2={ry + 21 + row * 30} stroke="#2c3d55" strokeWidth="1.2" />)}
              <circle cx={676 + col * 68 + 4} cy={ry + 15.5 + row * 30} r="2.4" fill="#4aa3e0" opacity="0.9" />
              <circle cx={676 + col * 68 + 58} cy={ry + 15.5 + row * 30} r="2.4" fill="#7fd8f2" opacity="0.9" />
            </g>
          ))}
        </g>
      ))}
      <text x="743" y={ry + 106} textAnchor="middle" fontSize="10" fontWeight="700" fill="#e2e8f0" letterSpacing="0.5">RO STACK {li + 1}</text>
      {/* brine-pudotus manaifoldille */}

      {/* permeaatti ulos */}
      <line x1="818" y1={ry + 46} x2="866" y2={ry + 46} stroke={ry > 200 && !train2Active ? '#3a5a70' : permPipe} strokeWidth="4" strokeLinecap="square" />
    </g>
  ))}
  <line x1="866" y1="164" x2="866" y2="282" stroke={permPipe} strokeWidth="4" strokeLinecap="square" />
  <line x1="866" y1="220" x2="884" y2="220" stroke={permPipe} strokeWidth="4" strokeLinecap="square" />
  <polygon points="890,220 880,215 880,225" fill={permPipe} />

  {/* ================== FW TANK ================== */}
  <rect x="890" y="170" width="38" height="100" rx="8" fill="rgba(20,28,46,0.9)" stroke="#3f5a7d" strokeWidth="1.5" />
  <clipPath id="tankClip"><rect x="893" y="173" width="32" height="94" rx="6" /></clipPath>
  <g clipPath="url(#tankClip)">
    <rect x="893" y={267 - (sim.tags.LT401 / 100) * 94} width="32" height={(sim.tags.LT401 / 100) * 94 + 3} fill="url(#liqG)" opacity="0.92" />
    <path className="lfc-wave" d={`M893,${267 - (sim.tags.LT401 / 100) * 94} q8,-4 16,0 t16,0`} stroke="#c9f0fc" strokeWidth="1.6" fill="none" />
  </g>
  <text x="909" y="284" textAnchor="middle" fontSize="9" fill="#a0aec8" letterSpacing="0.5">FW TANK</text>
  {[25, 50, 75].map((p) => <line key={p} x1="890" y1={267 - (p / 100) * 94} x2="894" y2={267 - (p / 100) * 94} stroke="#5b7396" strokeWidth="1.2" />)}

  {/* ================== NaOH 1 (stack 1 permeaatti) ================== */}
  <rect x="828" y="78" width="30" height="40" rx="7" fill="rgba(20,28,46,0.9)" stroke={producing ? '#7bd389' : '#3f5a7d'} strokeWidth="1.4" />
  <rect x="831" y="92" width="24" height="23" fill="#7bd389" opacity="0.3" />
  <text x="843" y="74" textAnchor="middle" fontSize="8" fill="#a0aec8">NaOH 1</text>
  <circle cx="843" cy="128" r="8" fill="url(#boxG)" stroke={producing ? '#7bd389' : '#3f5a7d'} strokeWidth="1.4" />
  <g className={producing ? 'lfc-spin' : ''} style={{ transformOrigin: '843px 128px' }}>
    {[0, 120, 240].map((a2) => <line key={a2} x1="843" y1="122" x2="843" y2="125" stroke="#7bd389" strokeWidth="1.4" transform={`rotate(${a2} 843 128)`} />)}
  </g>
  <line x1="843" y1="118" x2="843" y2="154" stroke="#7bd389" strokeWidth="2.5" strokeDasharray="3 2" />
  <rect x="826" y="154" width="20" height="20" rx="4" fill="url(#boxG)" stroke={producing ? '#7fd8f2' : '#3f5a7d'} strokeWidth="1.4" />
  {[0, 1, 2].map((k) => <line key={k} x1={830 + k * 6} y1={157} x2={827 + k * 6} y2={171} stroke="#5b7396" strokeWidth="1.6" />)}
  <text x="836" y="150" textAnchor="middle" fontSize="7.5" fill="#a0aec8">mixer</text>

  {/* ================== NaOH 2 + sekoitin (stack 2 permeaatti) ================== */}
  {/* staattinen sekoitin RO STACK 2 permeaatissa */}
  <rect x="826" y="272" width="20" height="20" rx="4" fill="url(#boxG)" opacity={train2Active ? 1 : 0.3} stroke={producing && train2Active ? '#7fd8f2' : '#3f5a7d'} strokeWidth="1.4" />
  {[0, 1, 2].map((k) => <line key={k} x1={830 + k * 6} y1={275} x2={827 + k * 6} y2={289} stroke="#5b7396" strokeWidth="1.6" />)}
  <text x="836" y="268" textAnchor="middle" fontSize="7.5" fill="#a0aec8">mixer</text>
  <rect x="836" y="320" width="30" height="36" rx="7" fill="rgba(20,28,46,0.9)" stroke={producing ? '#7bd389' : '#3f5a7d'} strokeWidth="1.4" />
  <rect x="839" y="332" width="24" height="20" fill="#7bd389" opacity="0.3" />
  <text x="851" y="316" textAnchor="middle" fontSize="8" fill="#a0aec8">NaOH 2</text>
  <circle cx="855" cy="306" r="7" fill="url(#boxG)" stroke={producing ? '#7bd389' : '#3f5a7d'} strokeWidth="1.4" />
  <g className={producing ? 'lfc-spin' : ''} style={{ transformOrigin: '855px 306px' }}>
    {[0, 120, 240].map((a3) => <line key={a3} x1="855" y1="293" x2="855" y2="295.5" stroke="#7bd389" strokeWidth="1.3" transform={`rotate(${a3} 855 306)`} />)}
  </g>
  <line x1="855" y1="313" x2="855" y2="320" stroke="#7bd389" strokeWidth="2" strokeDasharray="3 2" />
  <line x1="855" y1="299" x2="855" y2="292" stroke="#7bd389" strokeWidth="2.5" strokeDasharray="3 2" />
  

    {/* ================== YHTEINEN CIP + FRESH WATER FLUSH ================== */}
  <text x="530" y="368" textAnchor="middle" fontSize="9" fill="#8e9ab8" letterSpacing="2">CIP + FRESH WATER FLUSH</text>
  <rect x="422" y="376" width="72" height="61" rx="9" fill="rgba(20,28,46,0.9)" stroke="#3f5a7d" strokeWidth="1.5" />
  <clipPath id="cipClip"><rect x="425" y="379" width="66" height="55" rx="6" /></clipPath>
  <g clipPath="url(#cipClip)">
    <rect x="425" y="398" width="66" height="36" fill="#7bd389" opacity="0.35" />
    <path className={sim.cipRunning ? 'lfc-wave' : ''} d="M425,398 q16,-5 33,0 t33,0" stroke="#b9ecc3" strokeWidth="2" fill="none" />
  </g>
  <line x1="458" y1="370" x2="458" y2="376" stroke="#7fd8f2" strokeWidth="5" />
  <text x="470" y="374" fontSize="7" fill="#7fd8f2">FW in</text>
  <text x="458" y="445" textAnchor="middle" fontSize="9" fill="#a0aec8" letterSpacing="0.5">CIP TANK</text>
  <line x1="494" y1="406" x2="522" y2="406" stroke="#7bd389" strokeWidth="5" strokeLinecap="square" />
  <circle cx="540" cy="406" r="19" fill="url(#boxG)" stroke={sim.cipRunning ? '#7bd389' : '#3f5a7d'} strokeWidth="2" />
  <g className={sim.cipRunning ? 'lfc-spin' : ''} style={{ transformOrigin: '540px 406px' }}>
    {[0, 120, 240].map((a) => (
      <rect key={a} x="538" y="393" width="4" height="13" rx="2" fill="#7bd389" opacity="0.85" transform={`rotate(${a} 540 406)`} />
    ))}
  </g>
  <circle cx="540" cy="406" r="3.5" fill="#0d1220" stroke={sim.cipRunning ? '#7bd389' : '#5b7396'} />
  <text x="540" y="432" textAnchor="middle" fontSize="9" fill="#a0aec8" letterSpacing="0.5">CIP PUMP</text>
  <line x1="559" y1="406" x2="563" y2="406" stroke="#7bd389" strokeWidth="5" strokeLinecap="square" />
  <rect x="563" y="389" width="47" height="34" rx="15" fill="url(#boxG)" stroke={sim.cipRunning ? '#7bd389' : '#3f5a7d'} strokeWidth="1.6" />
  {[1, 2].map((k) => <line key={k} x1={577 + k * 11} y1="394" x2={577 + k * 11} y2="418" stroke="#5b7396" strokeWidth="1.8" />)}
  <text x="586" y="432" textAnchor="middle" fontSize="9" fill="#a0aec8" letterSpacing="0.5">CIP FILTER</text>
  {/* nousu molempiin stackin syottoolinjoihin (T x=640) */}
  <line x1="610" y1="405" x2="640" y2="405" stroke="#7bd389" strokeWidth="3.5" strokeDasharray="10 7" />
  <line x1="640" y1="405" x2="640" y2="143" stroke="#7bd389" strokeWidth="3.5" strokeDasharray="10 7" />
  <polygon points="640,143 635,154 645,154" fill="#7bd389" />
  <circle cx="640" cy="297" r="4" fill="#7bd389" opacity="0.6" />
  {sim.cipRunning && (
    <g stroke="#d2f5d8" strokeWidth="1.8" strokeDasharray="10 18" className="lfc-flow">
      {/* annos ylos stackeille */}
      <line x1="640" y1="402" x2="640" y2="147" />
      {/* paluu stackeista takaisin tankkiin (x=726) */}
      <line x1="743" y1="218" x2="726" y2="218" stroke="#b9ecc3" />
      <line x1="743" y1="338" x2="726" y2="338" stroke="#b9ecc3" />
      <line x1="726" y1="218" x2="726" y2="438" stroke="#b9ecc3" />
      <line x1="726" y1="440" x2="498" y2="440" stroke="#b9ecc3" />
    </g>
  )}

  {/* permeaatin virtaus stackeista tankkiin */}
  {producing && (
    <g stroke="#aee9f8" strokeWidth="1.8" strokeDasharray="10 18" className="lfc-flow">
      {/* stack 1 -> kerayspysty */}
      <line x1="820" y1="164" x2="864" y2="164" />
      {/* stack 2 -> kerayspysty (vain kun linja 2 aktiivinen) */}
      {train2Active && <line x1="820" y1="282" x2="864" y2="282" />}
      {/* kerayspysty alas/ulos tankille */}
      <line x1="866" y1="170" x2="866" y2="216" />
      {train2Active && <line x1="866" y1="276" x2="866" y2="224" />}
      {/* tankkiin */}
      <line x1="868" y1="220" x2="884" y2="220" />
    </g>
  )}

  {/* ================== MITTARIT ================== */}
  <Gauge x="165" y="148" tag="FT-101 FEED FLOW" value={fmt(sim.tags.FT101, 0)} unit="m³/h" color={gaugeColor('FT-101')} />
  <Gauge x="309" y="120" tag="FT-502 ANTISCALANT" value={fmt(sim.tags.FT502, 2)} unit="L/h" color={gaugeColor('FT-502')} />
  <Gauge x="262" y="348" tag="PDT-102 AQUABOLL ΔP" value={fmt(abollDp, 2)} unit="bar" color={abollDp > 0.65 ? "#E53E3E" : abollDp > 0.45 ? "#DD6B20" : "#38A169"} />
  <Gauge x="360" y="345" tag="PDT-103 MEMBRANE ΔP" value={fmt(sim.tags.PDT103, 2)} unit="bar" color={gaugeColor('PDT-103')} />
  <Gauge x="778" y="390" tag="CT-301 CONDUCTIVITY" value={fmt(sim.tags.CT301, 0)} unit="µS/cm" color={gaugeColor('CT-301')} />
  <Gauge x="778" y="30" tag="AT-501 pH" value={fmt(sim.tags.AT501, 2)} unit="pH" color={gaugeColor('AT-501')} />
  <Gauge x="900" y="30" tag="LT-401 TANK" value={fmt(sim.tags.LT401, 0)} unit="%" color={gaugeColor('LT-401')} />
  <Gauge x="900" y="415" tag="FT-501 NaOH DOSE" value={fmt(sim.tags.FT501, 1)} unit="L/h" color={gaugeColor('FT-501')} />
  <Gauge x="63" y="320" tag="TT-104 SEA TEMP" value={fmt(sim.tags.TT104)} unit="°C" color={gaugeColor('TT-104')} />
</svg>
        </Box>

        {/* Ohjauspaneeli + mittarit */}
        <Flex direction="column" gap={3} flex="1" minW="300px">
          <Box className="lfc-panel" p={4}>
            <HStack justify="space-between" mb={2}>
              <Heading size="md" color="#e8ecf4">Control panel</Heading>
              <Badge colorScheme={producing ? 'green' : 'gray'}>{producing ? 'PRODUCING' : 'STOPPED'}</Badge>
            </HStack>
            <HStack mb={4}>
              <Button size="sm" variant={sim.mode === 'auto' ? 'solid' : 'outline'} colorScheme="blue" onClick={() => useSim.getState().setMode('auto')}>Auto route</Button>
              <Button size="sm" variant={sim.mode === 'manual' ? 'solid' : 'outline'} colorScheme="blue" onClick={() => useSim.getState().setMode('manual')}>Manual (click map)</Button>
            </HStack>
            <Text fontSize="sm" className="lfc-muted" mb={1}>Production capacity</Text>
            <HStack>
              <Slider min={50} max={200} step={10} value={sim.capacity} onChange={(c) => useSim.getState().setCapacity(c)} isDisabled={producing} colorScheme="green">
                <SliderTrack><SliderFilledTrack /></SliderTrack>
                <SliderThumb />
              </Slider>
              <Text fontWeight="bold" fontSize="xl" width="110px" textAlign="right" color="#7fe3f2" style={{ fontVariantNumeric: 'tabular-nums' }}>{sim.capacity} m³/h</Text>
            </HStack>
            <HStack mt={4}>
              <Button
                width="100%" size="lg"
                colorScheme={sim.cipRunning ? 'red' : 'teal'}
                isDisabled={producing}
                onClick={() => useSim.setState({ cipRunning: !useSim.getState().cipRunning })}
              >
                CIP {sim.cipRunning ? 'STOP' : 'START'}
              </Button>
            </HStack>
            <Tooltip label={producing ? 'CIP lukittu tuotannon ajaksi — pysäytä tuotanto ensin' : 'CIP + fresh water flush -kierto'}>
              <Text fontSize="xs" className="lfc-muted" mt={1} cursor="help">CIP interlock: {producing ? 'production running' : sim.cipRunning ? 'circulating' : 'standby'}</Text>
            </Tooltip>
            <Button mt={2} width="100%" size="lg" colorScheme={producing ? 'red' : 'green'} onClick={producing ? handleStop : handleStart}>
              {producing ? 'STOP PRODUCTION' : 'START PRODUCTION'}
            </Button>
            <SimpleGrid columns={2} spacing={3} mt={4}>
              <Stat size="sm">
                <StatLabel className="lfc-muted">Position</StatLabel>
                <StatNumber fontSize="md" color="#e8ecf4">{sim.vessel.lat.toFixed(3)}, {sim.vessel.lon.toFixed(3)}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel className="lfc-muted">Area</StatLabel>
                <StatNumber fontSize="md" color="#e8ecf4">{nearestArea ? nearestArea.name : 'Open water'}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel className="lfc-muted">Depth</StatLabel>
                <StatNumber fontSize="md" color="#e8ecf4">{v.depth === null ? '—' : `${v.depth.toFixed(1)} m`}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel className="lfc-muted">Nearest farm</StatLabel>
                <StatNumber fontSize="md" color="#e8ecf4">{v.farm ? `${(v.farm.distM / 1000).toFixed(2)} km` : '—'}</StatNumber>
              </Stat>
            </SimpleGrid>
            <Tooltip label={v.reasons.join('; ') || 'No limiting factors detected at current position'}>
              <Badge mt={2} colorScheme={v.status === 'good' ? 'green' : v.status === 'caution' ? 'yellow' : 'orange'}>{statusLabel}</Badge>
            </Tooltip>
          </Box>

          <Box className="lfc-panel" p={4} flex="1" overflowY="auto">
            <Heading size="md" mb={2} color="#e8ecf4">Measured values <Text as="span" fontSize="xs" className="lfc-muted">— Siemens S7 (simulated)</Text></Heading>
            {['FT-101', 'PT-102', 'PDT-103', 'FT-201', 'CT-301', 'AT-501', 'FT-501', 'FT-502', 'LT-401', 'TT-104'].map((tagId) => {
              const t = tagByTag[tagId];
              const value = valueOf(tagId);
              const level = t ? tagLevel(value, t) : 'ok' as Level;
              return (
                <Flex key={tagId} align="center" justify="space-between" py={1.5} borderBottomWidth="1px" borderColor="rgba(110,126,168,0.25)" _last={{ borderBottomWidth: 0 }}>
                  <Box>
                    <Text fontWeight="bold" fontSize="sm" color="#e8ecf4">{t ? tagLabel(t) : tagId}</Text>
                    <Text fontSize="xs" className="lfc-muted">{tagId}{t?.s7Address ? ` · ${t.s7Address}` : ''}</Text>
                  </Box>
                  <Box textAlign="right">
                    <HStack>
                      <Box w="10px" h="10px" borderRadius="full" bg={levelColor(level)} className={level === 'alarm' ? 'lfc-pulse' : ''} />
                      <Text fontWeight="bold" fontSize="md" color={levelColor(level)} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(value, tagId === 'PDT-103' ? 2 : 0)}</Text>
                      <Text fontSize="xs" className="lfc-muted" width="52px">{t?.unit ?? ''}</Text>
                    </HStack>
                    <Text fontSize="10px" className="lfc-muted">normal {t?.normalMin ?? '—'}–{t?.normalMax ?? '—'}</Text>
                  </Box>
                </Flex>
              );
            })}
            <HStack mt={2} fontSize="xs" className="lfc-muted">
              <Box w="10px" h="10px" borderRadius="full" bg="#38A169" /><Text>normal</Text>
              <Box w="10px" h="10px" borderRadius="full" bg="#DD6B20" /><Text>warning</Text>
              <Box w="10px" h="10px" borderRadius="full" bg="#E53E3E" /><Text>alarm</Text>
            </HStack>
          </Box>
        </Flex>
      </Flex>
    </Flex>
  );
}
