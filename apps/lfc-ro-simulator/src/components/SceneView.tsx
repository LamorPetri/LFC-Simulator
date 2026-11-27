import { useEffect, useRef } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, HStack, Progress, Slider, SliderFilledTrack,
  SliderThumb, SliderTrack, Text
} from '@chakra-ui/react';
import Scene3D from './Scene3D';
import MeasurementBar from './MeasurementBar';
import { Level } from './tagLevel';
import { useSim } from '../sim/store';
import { AreaRec, TagRec } from '../api';
import { useProduction } from '../useProduction';

interface Props {
  areas: AreaRec[];
  tags: TagRec[];
  instructionByType: Record<string, string>;
  onAfterStop: () => void;
}

export default function SceneView({ areas, tags, instructionByType, onAfterStop }: Props) {
  const sim = useSim();
  const cap = sim.capacity;
  const { handleStart, handleStop, nearestArea } = useProduction({ areas, instructionByType, onAfterStop });
  const sceneMount = useRef<HTMLDivElement | null>(null);
 

  const tagByTag: Record<string, TagRec> = {};
  tags.forEach((t) => { tagByTag[t.tag] = t; });
  const valueOf = (tag: string): number => {
    const map: Record<string, number> = {
      'FT-101': sim.tags.FT101, 'PT-102': sim.tags.PT102, 'PDT-103': sim.tags.PDT103,
      'FT-201': sim.tags.FT201, 'CT-301': sim.tags.CT301, 'LT-401': sim.tags.LT401, 'TT-104': sim.tags.TT104, 'AT-501': sim.tags.AT501,
    };
    return map[tag] ?? 0;
  };

  // välitä chase-tila Scene3D:lle
  useEffect(() => {
    const el = sceneMount.current?.querySelector('.scene-3d') as (HTMLDivElement & { __setChase?: (v: boolean) => void }) | null;
    el?.__setChase?.(sim.chase);
  }, [sim.chase]);

  const ev = sim.vesselEval;
  const statusLabel = ev.status === 'good' ? 'SUITABLE AREA' : ev.status === 'caution' ? 'CAUTION' : ev.status === 'farm' ? 'FISH FARM ZONE' : 'SHALLOW WATER';

  return (
    <Box position="relative" height="100%" borderRadius="lg" overflow="hidden" borderWidth="1px" ref={sceneMount}>
      <Scene3D />

      {/* hälytysbannerit */}
      <Box position="absolute" top={2} left="50%" transform="translateX(-50%)" zIndex={600} width="min(680px, 92%)">
        {sim.banners.map((b) => (
          <Alert status={b.severity === 'Critical' ? 'error' : 'warning'} key={b.id} borderRadius="md" mb={1}>
            <AlertIcon />
            <Box flex="1">
              <Text fontWeight="bold">{b.type}</Text>
              <Text fontSize="sm">{b.message}</Text>
            </Box>
            <Button size="xs" variant="outline" onClick={() => useSim.getState().dismissBanner(b.id)}>Dismiss</Button>
          </Alert>
        ))}
      </Box>

      {/* ohjauspaneeli */}
      <Box
        position="absolute" bottom={3} left={3} zIndex={600}
        className="lfc-panel" p={3} width="300px"
      >
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold">LFC RO control</Text>
          <Badge colorScheme={sim.producing ? 'green' : 'gray'}>{sim.producing ? 'PRODUCING' : 'STANDBY'}</Badge>
        </HStack>
        <HStack mb={3} spacing={2}>
          <Button size="xs" variant={sim.mode === 'auto' ? 'solid' : 'outline'} colorScheme="blue" onClick={() => useSim.getState().setMode('auto')}>Auto</Button>
          <Button size="xs" variant={sim.mode === 'manual' ? 'solid' : 'outline'} colorScheme="blue" onClick={() => useSim.getState().setMode('manual')}>Manual</Button>
          <Button size="xs" variant={sim.chase ? 'solid' : 'outline'} colorScheme="cyan" onClick={() => useSim.setState({ chase: !useSim.getState().chase })}>
            {sim.chase ? 'Following ship' : 'Free camera'}
          </Button>
        </HStack>
        <Text fontSize="xs" color="subtleText">Capacity {sim.capacity} m³/h</Text>
        <Slider min={50} max={200} step={10} value={sim.capacity} onChange={(c) => useSim.getState().setCapacity(c)} isDisabled={sim.producing} colorScheme="green" mb={2}>
          <SliderTrack><SliderFilledTrack /></SliderTrack><SliderThumb />
        </Slider>
        <Button width="100%" size="lg" colorScheme={sim.producing ? 'red' : 'green'} onClick={sim.producing ? handleStop : handleStart}>
          {sim.producing ? 'STOP PRODUCTION' : 'START PRODUCTION'}
        </Button>
        <Box mt={2}>
          <Text fontSize="xs" color="subtleText">Fouling index</Text>
          <Progress value={sim.fouling} size="sm" colorScheme={sim.fouling > 70 ? 'red' : sim.fouling > 40 ? 'orange' : 'green'} />
        </Box>
        <Box mt={2}>
          <Text fontSize="xs" color="subtleText">Treatment water (target {(sim.capacity * 7).toFixed(0)} m³ / ~7 h)</Text>
          <Progress value={Math.min(100, (sim.volume / (sim.capacity * 7)) * 100)} size="sm" colorScheme="cyan" />
        </Box>
        <Text fontSize="xs" color="subtleText" mt={1}>Volume {sim.volume.toFixed(0)} m³</Text>
      </Box>

      {/* mittauspalkit: vihreä = normal, keltainen = varoitus, punainen = hälytys (rajat PLC Tag Map -datasetistä) */}
      <Box
        position="absolute" top="140px" right={3} zIndex={600}
        className="lfc-panel" p={3} width="268px"
      >
        <Text fontWeight="bold" mb={2} fontSize="sm">S7 measurements</Text>
        <Box mb={2}>
          <HStack spacing={2} fontSize="10px" className="lfc-muted">
            <Box w="10px" h="6px" borderRadius="1px" bg="#35e0c4" /><Text>normal</Text>
            <Box w="10px" h="6px" borderRadius="1px" bg="#ffb020" /><Text>warning</Text>
            <Box w="10px" h="6px" borderRadius="1px" bg="#ff5263" /><Text>alarm</Text>
          </HStack>
        </Box>
        {['FT-101', 'FT-201', 'PT-102', 'PDT-103', 'CT-301', 'AT-501'].map((tagId) => {
          const t = tagByTag[tagId];
          if (!t) return null;
          // tuotantopyyntöön suhteutetut palkit: syöttö aina ≥ 2 × pyyntö (saanto 50 %), tuotettu ±10 % pyynnöstä
          const isFeed = tagId === 'FT-101';
          const isProduced = tagId === 'FT-201';
          const dynamic = isFeed
            ? {
                scale: [0, 2.6 * cap] as [number, number],
                bands: [{ from: 0, to: 2 * cap, level: 'alarm' as Level }, { from: 2 * cap, to: 2.6 * cap, level: 'ok' as Level }],
                ticks: [0, 2 * cap, 2.6 * cap],
                level: (sim.producing && sim.tags.FT101 >= 2 * cap ? 'ok' : 'alarm') as Level,
                note: `≥ 2 × request = ${2 * cap} m³/h (recovery 50 %) · now ${cap > 0 ? (sim.tags.FT101 / cap).toFixed(2) : '—'} ×`,
                idle: !sim.producing,
              }
            : isProduced
              ? {
                  scale: [0, 1.5 * cap] as [number, number],
                  bands: [
                    { from: 0, to: 0.9 * cap, level: 'alarm' as Level },
                    { from: 0.9 * cap, to: 1.1 * cap, level: 'ok' as Level },
                    { from: 1.1 * cap, to: 1.5 * cap, level: 'alarm' as Level },
                  ],
                  ticks: [0, 0.9 * cap, 1.1 * cap, 1.5 * cap],
                  level: (sim.producing && !sim.cipNeeded ? 'ok' : 'alarm') as Level,
                  note: `request ${cap} m³/h · now ${cap > 0 ? Math.round((sim.tags.FT201 / cap) * 100) : 0} % (green = ±10 %)`,
                  idle: !sim.producing,
                }
              : {};
          return (
            <Box key={tagId} mb={2.5} _last={{ mb: 0 }}>
              <MeasurementBar tag={t} value={valueOf(tagId)} decimals={tagId === 'PDT-103' ? 2 : tagId === 'AT-501' ? 2 : 0} {...dynamic} />
              {isProduced && sim.producing && sim.cipNeeded && (
                <Text fontSize="10px" fontWeight="bold" color="#ff5263" mt={0.5} className="lfc-pulse">
                  ⚠ CIP REQUIRED — produced water outside ±10 % of request
                </Text>
              )}
            </Box>
          );
        })}
        <Text fontSize="10px" color="subtleText" mt={2}>{nearestArea ? nearestArea.name : 'Open water'}</Text>
      </Box>

      {/* tilapalkki */}
      <Box position="absolute" top={3} left={3} zIndex={600}>
        <Badge colorScheme={ev.status === 'good' ? 'green' : ev.status === 'caution' ? 'yellow' : 'orange'} fontSize="sm" px={2} py={1} borderRadius="md">
          {statusLabel}
        </Badge>
        <Text fontSize="xs" mt={1} className="lfc-muted">
          {ev.depth !== null ? `Depth ${ev.depth.toFixed(0)} m · ` : ''}
          {ev.farm ? `farm ${(ev.farm.distM / 1000).toFixed(2)} km` : ''}
        </Text>
      </Box>

    </Box>
  );
}
