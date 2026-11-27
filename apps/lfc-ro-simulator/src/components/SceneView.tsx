import { useEffect, useRef } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, HStack, Progress, Slider, SliderFilledTrack,
  SliderThumb, SliderTrack, Text, VStack
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
  const foulColor = sim.fouling > 70 ? 'var(--alarm)' : sim.fouling > 40 ? 'var(--warn)' : 'var(--perm)';
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
      <Box position="absolute" top={2} left="50%" transform="translateX(-50%)" zIndex={600} width="min(680px, calc(100% - 600px))" minWidth="280px">
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

      {/* ohjauspaneeli (HMI-tyyli kuten Process-välilehti) */}
      <Box
        position="absolute" bottom={3} left={3} zIndex={600}
        className="lfc-pid-panel" p={3} width="300px"
      >
        <HStack justify="space-between" mb={2.5}>
          <Text className="lfc-pid-heading">LFC RO control</Text>
          <Badge variant="subtle" colorScheme={sim.producing ? 'green' : 'gray'} fontSize="10px" letterSpacing=".08em">{sim.producing ? 'PRODUCING' : 'STANDBY'}</Badge>
        </HStack>
        <HStack mb={3} spacing={2}>
          <Button size="xs" variant={sim.mode === 'auto' ? 'solid' : 'outline'} colorScheme="blue" onClick={() => useSim.getState().setMode('auto')}>Auto</Button>
          <Button size="xs" variant={sim.mode === 'manual' ? 'solid' : 'outline'} colorScheme="blue" onClick={() => useSim.getState().setMode('manual')}>Manual</Button>
          <Button size="xs" variant={sim.chase ? 'solid' : 'outline'} colorScheme="cyan" onClick={() => useSim.setState({ chase: !useSim.getState().chase })}>
            {sim.chase ? 'Following ship' : 'Free camera'}
          </Button>
        </HStack>
        <Text fontSize="xs" color="var(--mut)">Capacity <Text as="span" className="lfc-pid-num" color="var(--txt)">{sim.capacity}</Text> m³/h</Text>
        <Slider min={50} max={200} step={10} value={sim.capacity} onChange={(c) => useSim.getState().setCapacity(c)} isDisabled={sim.producing} colorScheme="green" mb={2}>
          <SliderTrack bg="var(--eq2)"><SliderFilledTrack bg="var(--perm)" /></SliderTrack><SliderThumb />
        </Slider>
        <Button width="100%" size="lg" colorScheme={sim.producing ? 'red' : 'green'} onClick={sim.producing ? handleStop : handleStart}>
          {sim.producing ? 'STOP PRODUCTION' : 'START PRODUCTION'}
        </Button>
        <Box mt={2.5}>
          <Text fontSize="xs" color="var(--mut)">Fouling index <Text as="span" className="lfc-pid-num" color={foulColor}>{sim.fouling.toFixed(0)} %</Text></Text>
          <Progress value={sim.fouling} size="sm" bg="var(--eq2)" sx={{ '.chakra-progress__indicator': { bg: foulColor } }} borderRadius="sm" />
        </Box>
        <Box mt={2}>
          <Text fontSize="xs" color="var(--mut)">Treatment water <Text as="span" className="lfc-pid-num" color="var(--txt)">{sim.volume.toFixed(0)}</Text> / {(sim.capacity * 7).toFixed(0)} m³ · ~7 h</Text>
          <Progress value={Math.min(100, (sim.volume / (sim.capacity * 7)) * 100)} size="sm" bg="var(--eq2)" sx={{ '.chakra-progress__indicator': { bg: 'var(--perm)' } }} borderRadius="sm" />
        </Box>
      </Box>

      {/* mittarikortit (HMI-tyyli): vihreä = normal, keltainen = varoitus, punainen = hälytys; rajat PLC Tag Map -datasetistä */}
      <Box
        position="absolute" top={3} right={3} zIndex={600}
        className="lfc-pid-panel" p={3} width="276px"
      >
        <HStack justify="space-between" mb={2}>
          <Text className="lfc-pid-heading">S7 measurements</Text>
          <Text fontSize="9px" color="var(--mut)" letterSpacing=".1em">SIEMENS S7 · SIM</Text>
        </HStack>
        <HStack spacing={2.5} fontSize="10px" color="var(--mut)" mb={2.5}>
          <Box w="12px" h="6px" borderRadius="1px" bg="var(--perm)" /><Text>normal</Text>
          <Box w="12px" h="6px" borderRadius="1px" bg="var(--warn)" /><Text>warning</Text>
          <Box w="12px" h="6px" borderRadius="1px" bg="var(--alarm)" /><Text>alarm</Text>
        </HStack>
        <VStack spacing={1.5} align="stretch">
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
                    alert: sim.producing && sim.cipNeeded ? 'CIP REQUIRED — produced water outside ±10 % of request' : undefined,
                  }
                : {};
            return (
              <MeasurementBar key={tagId} tag={t} value={valueOf(tagId)} decimals={tagId === 'PDT-103' ? 2 : tagId === 'AT-501' ? 2 : 0} {...dynamic} />
            );
          })}
        </VStack>
        <Text fontSize="10px" color="var(--mut)" mt={2.5} letterSpacing=".04em">{nearestArea ? nearestArea.name : 'Open water'}</Text>
      </Box>

      {/* tilapalkki */}
      <Box position="absolute" top={3} left={3} zIndex={600}>
        <Badge colorScheme={ev.status === 'good' ? 'green' : ev.status === 'caution' ? 'yellow' : 'orange'} fontSize="sm" px={2} py={1} borderRadius="md" variant="subtle">
          {statusLabel}
        </Badge>
        <Text fontSize="xs" mt={1} color="var(--mut)" className="lfc-pid-num">
          {ev.depth !== null ? `Depth ${ev.depth.toFixed(0)} m · ` : ''}
          {ev.farm ? `farm ${(ev.farm.distM / 1000).toFixed(2)} km` : ''}
        </Text>
      </Box>

    </Box>
  );
}
