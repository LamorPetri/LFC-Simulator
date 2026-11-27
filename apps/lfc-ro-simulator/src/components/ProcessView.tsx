import { useMemo } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, Flex, HStack, Heading, SimpleGrid, Slider,
  SliderFilledTrack, SliderThumb, SliderTrack, Stat, StatLabel, StatNumber, Text, Tooltip,
} from '@chakra-ui/react';
import { useSim } from '../sim/store';
import { TagRec, AreaRec } from '../api';
import { useProduction } from '../useProduction';
import ProcessDiagram from './ProcessDiagram';
import { Level, levelColor, tagLevel } from './tagLevel';
import { tagLabel } from '../sim/tagLimits';
import './map.css';

interface Props {
  tags: TagRec[];
  areas: AreaRec[];
  instructionByType: Record<string, string>;
  onAfterStop: () => void;
}

function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(digits);
}

export default function ProcessView({ tags, areas, instructionByType, onAfterStop }: Props) {
  const sim = useSim();
  const { handleStart, handleStop, nearestArea } = useProduction({ areas, instructionByType, onAfterStop });
  const tagByTag = useMemo(() => {
    const m: Record<string, TagRec> = {};
    tags.forEach((t) => { m[t.tag] = t; });
    return m;
  }, [tags]);

  const v = sim.vesselEval;
  const valueOf = (tag: string): number => {
    const map: Record<string, number> = {
      'FT-101': sim.tags.FT101, 'PT-102': sim.tags.PT102, 'PDT-103': sim.tags.PDT103,
      'FT-201': sim.tags.FT201, 'CT-301': sim.tags.CT301, 'LT-401': sim.tags.LT401, 'TT-104': sim.tags.TT104, 'AT-501': sim.tags.AT501, 'FT-501': sim.tags.FT501, 'FT-502': sim.tags.FT502,
    };
    return map[tag] ?? 0;
  };
  const statusLabel = v.status === 'good' ? 'SUITABLE' : v.status === 'caution' ? 'CAUTION' : v.status === 'farm' ? 'FISH FARM ZONE' : 'SHALLOW WATER';
  const producing = sim.producing;

  return (
    <Flex direction="column" gap={3} height="100%" overflowY="auto" className="lfc-pid">
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

      <Flex gap={3} direction={{ base: 'column', xl: 'row' }} flex="1" minH="0">
        {/* Prosessikaavio */}
        <Box flex="3" minW="0" className="lfc-pid-panel" overflow="hidden">
          <ProcessDiagram tagByTag={tagByTag} />
        </Box>

        {/* Ohjauspaneeli + mittarit */}
        <Flex direction="column" gap={3} flex="1" minW="320px">
          <Box className="lfc-pid-panel" p={4}>
            <HStack justify="space-between" mb={2}>
              <Heading className="lfc-pid-heading">Control</Heading>
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
              <Text fontWeight="bold" fontSize="lg" minW="110px" textAlign="right" whiteSpace="nowrap" className="lfc-pid-num">{sim.capacity} m³/h</Text>
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
                <StatNumber fontSize="md" color="var(--txt)">{sim.vessel.lat.toFixed(3)}, {sim.vessel.lon.toFixed(3)}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel className="lfc-muted">Area</StatLabel>
                <StatNumber fontSize="md" color="var(--txt)">{nearestArea ? nearestArea.name : 'Open water'}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel className="lfc-muted">Depth</StatLabel>
                <StatNumber fontSize="md" color="var(--txt)">{v.depth === null ? '—' : `${v.depth.toFixed(1)} m`}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel className="lfc-muted">Nearest farm</StatLabel>
                <StatNumber fontSize="md" color="var(--txt)">{v.farm ? `${(v.farm.distM / 1000).toFixed(2)} km` : '—'}</StatNumber>
              </Stat>
            </SimpleGrid>
            <Tooltip label={v.reasons.join('; ') || 'No limiting factors detected at current position'}>
              <Badge mt={2} colorScheme={v.status === 'good' ? 'green' : v.status === 'caution' ? 'yellow' : 'orange'}>{statusLabel}</Badge>
            </Tooltip>
          </Box>

          <Box className="lfc-pid-panel" p={4} flex="1" overflowY="auto">
            <Heading className="lfc-pid-heading" mb={2}>Measured · Siemens S7 (simulated)</Heading>
            {['FT-101', 'PT-102', 'PDT-103', 'FT-201', 'CT-301', 'AT-501', 'FT-501', 'FT-502', 'LT-401', 'TT-104'].map((tagId) => {
              const t = tagByTag[tagId];
              const value = valueOf(tagId);
              const level: Level = tagLevel(value, t);
              return (
                <Flex key={tagId} align="center" justify="space-between" py={1} borderBottomWidth="1px" borderColor="var(--line)" _last={{ borderBottomWidth: 0 }}>
                  <Box>
                    <Text fontWeight="bold" fontSize="sm" color="var(--txt)">{t ? tagLabel(t) : tagId}</Text>
                    <Text fontSize="xs" className="lfc-muted">{tagId}{t?.s7Address ? ` · ${t.s7Address}` : ''}</Text>
                  </Box>
                  <Box textAlign="right">
                    <HStack>
                      <Box w="8px" h="8px" borderRadius="full" bg={level === 'ok' ? 'var(--eqs)' : levelColor(level)} className={level === 'alarm' ? 'lfc-pulse' : ''} />
                      <Text fontWeight="bold" fontSize="md" color={levelColor(level)} className="lfc-pid-num">{fmt(value, tagId === 'PDT-103' ? 2 : 0)}</Text>
                      <Text fontSize="xs" className="lfc-muted" width="52px">{t?.unit ?? ''}</Text>
                    </HStack>
                    <Text fontSize="10px" className="lfc-muted">normal {t?.normalMin ?? '—'}–{t?.normalMax ?? '—'}</Text>
                  </Box>
                </Flex>
              );
            })}
            <HStack mt={2} fontSize="xs" className="lfc-muted">
              <Box w="8px" h="8px" borderRadius="full" bg="var(--eqs)" /><Text>normal</Text>
              <Box w="8px" h="8px" borderRadius="full" bg="var(--warn)" /><Text>warning</Text>
              <Box w="8px" h="8px" borderRadius="full" bg="var(--alarm)" /><Text>alarm</Text>
            </HStack>
          </Box>
        </Flex>
      </Flex>
    </Flex>
  );
}
