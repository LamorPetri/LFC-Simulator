import { useMemo } from 'react';
import {
  Box, Button, Flex, HStack, Heading, SimpleGrid, Text,
} from '@chakra-ui/react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, ReferenceLine, ReferenceDot,
} from 'recharts';
import { SessionRec } from '../api';
import { useSim } from '../sim/store';

interface Props {
  sessions: SessionRec[];
  
}

interface DataPoint {
  volume: number;
  ph: number | null;
  dp: number | null;
  fouling: number | null;
  naoh: number | null;
  antiscalant: number | null;
  name: string;
  live: boolean;
}

interface CipMarker {
  volume: number;
  foulingBefore: number;
}

interface CumPoint {
  cumVol: number;
  cumNaoh: number;
  cumAnti: number;
  name: string;
  live: boolean;
}

/** Recharts-tooltipin props: active + payload[0].payload = datarivi. */
interface TooltipProps<T> {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: T }>;
}

const chartTooltip = ({ active, payload }: TooltipProps<DataPoint>) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DataPoint;
  return (
    <Box bg="rgba(26,32,44,0.95)" p={2} borderRadius="md" borderWidth="1px" borderColor="#4a5568" fontSize="xs">
      <Text fontWeight="bold" color="#e8ecf4">{d.name}</Text>
      <Text color="#a0aec8">Vol: {d.volume?.toFixed(0)} m³</Text>
      {d.ph !== null && <Text color="#7fd8f2">pH: {d.ph?.toFixed(2)}</Text>}
      {d.dp !== null && <Text color="#f6ad55">ΔP: {d.dp?.toFixed(2)} bar</Text>}
      {d.fouling !== null && <Text color="#fc8181">Fouling factor: {d.fouling?.toFixed(0)}%</Text>}
      {d.naoh !== null && <Text color="#7bd389">NaOH: {d.naoh?.toFixed(1)} l</Text>}
      {d.antiscalant !== null && <Text color="#d69e2e">Antiscal: {d.antiscalant?.toFixed(2)} l</Text>}
      {d.live && <Text color="#38a169" fontWeight="bold">● LIVE</Text>}
    </Box>
  );
};

export default function ReportView({ sessions }: Props) {
  const sim = useSim();

  const data = useMemo((): DataPoint[] => {
    const pts: DataPoint[] = sessions
      .filter((s) => s.volume !== null && s.volume > 0)
      .map((s) => ({
        volume: s.volume ?? 0,
        ph: s.ph,
        dp: s.dp,
        fouling: s.foulingRisk,
        naoh: s.naoh,
        antiscalant: s.antiscalant,
        name: s.name,
        live: false,
      }));
    if (sim.producing && sim.volume > 0) {
      pts.push({
        volume: Math.round(sim.volume),
        ph: sim.tags.AT501,
        dp: Math.round(sim.tags.PDT103 * 100) / 100,
        fouling: Math.round(sim.fouling),
        naoh: Math.round(sim.naohLiters * 10) / 10,
        antiscalant: Math.round(sim.antiscalantLiters * 100) / 100,
        name: 'Current session',
        live: true,
      });
    }
    return pts.sort((a, b) => a.volume - b.volume);
  }, [sessions, sim.producing, sim.volume, sim.tags.AT501, sim.tags.PDT103, sim.fouling, sim.naohLiters, sim.antiscalantLiters]);

  /* CIP-pisteet: tunnista fouling-pudotukset (>20 %-yksikkoa) sessionien valilta */
  const cipMarkers = useMemo((): CipMarker[] => {
    const markers: CipMarker[] = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      if (prev.fouling !== null && curr.fouling !== null) {
        const drop = prev.fouling - curr.fouling;
        if (drop > 20) {
          markers.push({
            volume: curr.volume,
            foulingBefore: prev.fouling,
          });
        }
      }
    }
    return markers;
  }, [data]);


  /* Kumulatiivinen kemikaalikulutus (lineaarinen trendi) — juokseva summa kronologisesti */
  const cumulative = useMemo((): CumPoint[] => {
    const sorted = [...sessions]
      .filter((x) => (x.volume ?? 0) > 0)
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
    const acc = sorted.reduce(
      (a, x) => {
        const cv = a.cv + (x.volume ?? 0);
        const cn = a.cn + (x.naoh ?? 0);
        const ca = a.ca + (x.antiscalant ?? 0);
        const pt: CumPoint = { cumVol: Math.round(cv), cumNaoh: Math.round(cn * 10) / 10, cumAnti: Math.round(ca * 100) / 100, name: x.name, live: false };
        return { pts: [...a.pts, pt], cv, cn, ca };
      },
      { pts: [] as CumPoint[], cv: 0, cn: 0, ca: 0 },
    );
    if (sim.producing && sim.volume > 0) {
      const live: CumPoint = {
        cumVol: Math.round(acc.cv + sim.volume),
        cumNaoh: Math.round((acc.cn + sim.naohLiters) * 10) / 10,
        cumAnti: Math.round((acc.ca + sim.antiscalantLiters) * 100) / 100,
        name: 'Current session',
        live: true,
      };
      return [...acc.pts, live];
    }
    return acc.pts;
  }, [sessions, sim.producing, sim.volume, sim.naohLiters, sim.antiscalantLiters]);

  const hasData = data.length > 0;
  const axisStyle = { fill: '#8e9ab8', fontSize: 11 };
  const gridStroke = 'rgba(110,126,168,0.15)';

  const exportCsv = () => {
    const head = 'volume_m3,ph,dp_bar,fouling_factor,naoh_l,antiscalant_l,cip_done,session';
    const lines = data.map((d) => {
      const cip = cipMarkers.some((m) => m.volume === d.volume) ? 'yes' : '';
      return [d.volume, d.ph ?? '', d.dp ?? '', d.fouling ?? '', d.naoh ?? '', d.antiscalant ?? '', cip, JSON.stringify(d.name)].join(',');
    });
    const csv = [head, ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lfc-ro-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Flex direction="column" gap={4} height="100%" overflowY="auto">
      <HStack justify="space-between">
        <Heading size="md" color="#e8ecf4">Production reporting</Heading>
        <Button size="xs" variant="outline" colorScheme="blue" onClick={exportCsv}>Export CSV</Button>
      </HStack>

      {!hasData && (
        <Box className="lfc-panel" p={8} textAlign="center">
          <Text color="#8e9ab8">No data yet — start and stop a production session to populate the charts.</Text>
        </Box>
      )}

      {hasData && (
        <SimpleGrid columns={{ base: 1, xl: 1 }} spacing={4}>
          {/* ===== KUVAJA 1: Tuotettu vesi vs pH ===== */}
          <Box className="lfc-panel" p={4}>
            <Heading size="sm" mb={1} color="#a0aec8" letterSpacing="0.5">PRODUCED VOLUME vs pH</Heading>
            <Text fontSize="xs" color="#687389" mb={2}>Permeate pH target 6.8–8.0 (green band)</Text>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid stroke={gridStroke} />
                <XAxis dataKey="volume" name="Volume" unit=" m³" tick={axisStyle} label={{ value: 'Produced (m³)', position: 'insideBottom', offset: -2, ...axisStyle }} />
                <YAxis dataKey="ph" name="pH" domain={[5.5, 9]} tick={axisStyle} label={{ value: 'pH', angle: -90, position: 'insideLeft', ...axisStyle }} />
                <ReferenceLine y={6.8} stroke="#38a169" strokeDasharray="4 4" />
                <ReferenceLine y={8.0} stroke="#38a169" strokeDasharray="4 4" />
                <Tooltip content={chartTooltip} />
                <Scatter data={data} fill="#7fd8f2" />
              </ScatterChart>
            </ResponsiveContainer>
          </Box>

          {/* ===== KUVAJA 2: Tuotettu vesi vs ΔP ja fouling factor + CIP-pisteet ===== */}
          <Box className="lfc-panel" p={4}>
            <Heading size="sm" mb={1} color="#a0aec8" letterSpacing="0.5">PRODUCED VOLUME vs MEMBRANE ΔP & FOULING FACTOR</Heading>
            <Text fontSize="xs" color="#687389" mb={2}>
              Orange = ΔP (bar) · Red = fouling factor (%) · <Text as="span" color="#38a169" fontWeight="bold">◆ CIP wash</Text> — fouling drops after CIP
            </Text>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 5, right: 60, bottom: 5, left: 0 }}>
                <CartesianGrid stroke={gridStroke} />
                <XAxis dataKey="volume" tick={axisStyle} label={{ value: 'Produced (m³)', position: 'insideBottom', offset: -2, ...axisStyle }} />
                <YAxis yAxisId="dp" domain={[0, 2.5]} tick={axisStyle} label={{ value: 'ΔP (bar)', angle: -90, position: 'insideLeft', ...axisStyle }} />
                <YAxis yAxisId="foul" orientation="right" domain={[0, 100]} tick={axisStyle} label={{ value: 'Fouling factor (%)', angle: 90, position: 'insideRight', ...axisStyle }} />
                <ReferenceLine yAxisId="dp" y={1.8} stroke="#e53e3e" strokeDasharray="4 4" />
                <ReferenceLine yAxisId="foul" y={70} stroke="#e53e3e" strokeDasharray="4 4" />
                {/* CIP-pisteet: vihreä timantti fouling-akselilla */}
                {cipMarkers.map((m, i) => (
                  <ReferenceDot
                    key={`cip-${i}`}
                    yAxisId="foul"
                    x={m.volume}
                    y={m.foulingBefore}
                    r={8}
                    fill="#38a169"
                    stroke="#e2e8f0"
                    strokeWidth={2}
                  />
                ))}
                {cipMarkers.map((m, i) => (
                  <ReferenceLine
                    key={`cipline-${i}`}
                    yAxisId="foul"
                    x={m.volume}
                    stroke="#38a169"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    label={{ value: 'CIP', position: 'top', fill: '#38a169', fontSize: 10, fontWeight: 'bold' }}
                  />
                ))}
                <Tooltip content={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#a0aec8' }} />
                <Line yAxisId="dp" type="monotone" dataKey="dp" name="ΔP (bar)" stroke="#f6ad55" strokeWidth={2} dot={{ r: 4, fill: '#f6ad55' }} connectNulls />
                <Line yAxisId="foul" type="monotone" dataKey="fouling" name="Fouling factor (%)" stroke="#fc8181" strokeWidth={2} dot={{ r: 4, fill: '#fc8181' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* ===== KUVAJA 3: Kumulatiivinen tuotanto vs kumulatiivinen kemikaalikulutus ===== */}
          <Box className="lfc-panel" p={4}>
            <Heading size="sm" mb={1} color="#a0aec8" letterSpacing="0.5">CUMULATIVE PRODUCTION vs CUMULATIVE CHEMICAL CONSUMPTION</Heading>
            <Text fontSize="xs" color="#687389" mb={2}>Green = NaOH total (l) · Yellow = antiscalant total (l) — linear trend = steady dosing rate</Text>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={cumulative} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid stroke={gridStroke} />
                <XAxis dataKey="cumVol" tick={axisStyle} label={{ value: 'Cumulative produced (m³)', position: 'insideBottom', offset: -2, ...axisStyle }} />
                <YAxis tick={axisStyle} label={{ value: 'Cumulative litres', angle: -90, position: 'insideLeft', ...axisStyle }} />
                <Tooltip content={({ active, payload }: TooltipProps<CumPoint>) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <Box bg="rgba(26,32,44,0.95)" p={2} borderRadius="md" borderWidth="1px" borderColor="#4a5568" fontSize="xs">
                      <Text fontWeight="bold" color="#e8ecf4">{d?.name}</Text>
                      <Text color="#a0aec8">Cum. volume: {d?.cumVol?.toFixed(0)} m³</Text>
                      <Text color="#7bd389">Cum. NaOH: {d?.cumNaoh?.toFixed(1)} l</Text>
                      <Text color="#d69e2e">Cum. antiscalant: {d?.cumAnti?.toFixed(2)} l</Text>
                      {d?.live && <Text color="#38a169" fontWeight="bold">● LIVE</Text>}
                    </Box>
                  );
                }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#a0aec8' }} />
                <Line type="linear" dataKey="cumNaoh" name="NaOH cumulative (l)" stroke="#7bd389" strokeWidth={2} dot={{ r: 4, fill: '#7bd389' }} connectNulls />
                <Line type="linear" dataKey="cumAnti" name="Antiscalant cumulative (l)" stroke="#d69e2e" strokeWidth={2} dot={{ r: 4, fill: '#d69e2e' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </SimpleGrid>
      )}
    </Flex>
  );
}
