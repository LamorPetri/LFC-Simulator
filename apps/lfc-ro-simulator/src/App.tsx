import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Flex, Heading, HStack, Spinner, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useColorMode,
} from '@chakra-ui/react';
import { useApp } from './hailer/use-app';
import { useSim } from './sim/store';
import ProcessView from './components/ProcessView';
import SceneView from './components/SceneView';
import MapView from './components/MapView';
import MaintenanceView from './components/MaintenanceView';
import HistoryView from './components/HistoryView';
import DataLogView from './components/DataLogView';
import ReportView from './components/ReportView';
import * as api from './api';

export default function App() {
  const { hailer, inside, ready, api: hailerStoreApi } = useApp();
  const { setColorMode } = useColorMode();
  const sim = useSim();

  const [view, setView] = useState(0);
  const [areas, setAreas] = useState<api.AreaRec[]>([]);
  const [zones, setZones] = useState<api.ZoneRec[]>([]);
  const [instructions, setInstructions] = useState<api.InstructionRec[]>([]);
  const [tags, setTags] = useState<api.TagRec[]>([]);
  const [sessions, setSessions] = useState<api.SessionRec[]>([]);
  const [alerts, setAlerts] = useState<api.AlertRec[]>([]);
  const [actions, setActions] = useState<api.ActionRec[]>([]);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    // SCADA-teema: aina tumma riippumatta Hailerin asetuksesta
    setColorMode('dark');
    void hailerStoreApi.init();
  }, [hailerStoreApi, setColorMode]);

  const refreshHistory = useCallback(() => {
    if (!hailer) return;
    void Promise.all([api.loadSessions(), api.loadAlerts(), api.loadActions()])
      .then(([s, a, ac]) => { setSessions(s); setAlerts(a); setActions(ac); })
      .catch((e) => console.error('history refresh failed', e));
  }, [hailer]);

  // datan lataus kun Hailer valmis
  useEffect(() => {
    if (!inside || !hailer) return;
    let cancelled = false;
    void Promise.all([api.loadAreas(), api.loadZones(), api.loadInstructions(), api.loadTags()])
      .then(([a, z, i, t]) => {
        if (cancelled) return;
        setAreas(a); setZones(z); setInstructions(i); setTags(t);
        setDataReady(true);
      })
      .catch((e) => {
        console.error('data load failed', e);
        setDataReady(true);
      });
    refreshHistory();
    return () => { cancelled = true; };
  }, [inside, hailer, refreshHistory]);

  // simulaatiokello: 1 Hz
  useEffect(() => {
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      useSim.getState().tick(dt);
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const handleAfterStop = useCallback(() => refreshHistory(), [refreshHistory]);

  const instructionByType = useMemo(() => {
    const m: Record<string, string> = {};
    instructions.forEach((i) => { if (!m[i.actionType]) m[i.actionType] = i.id; });
    return m;
  }, [instructions]);

  const statusColor = sim.vesselEval.status === 'good' ? 'green' : sim.vesselEval.status === 'caution' ? 'yellow' : 'orange';
  const statusText = sim.vesselEval.status === 'good' ? 'SUITABLE AREA'
    : sim.vesselEval.status === 'caution' ? 'CAUTION'
    : sim.vesselEval.status === 'farm' ? 'FISH FARM ZONE' : 'SHALLOW WATER';

  if (!ready && inside === null) {
    return <Flex h="100vh" align="center" justify="center"><Spinner size="xl" /></Flex>;
  }

  return (
    <Flex direction="column" h="100vh" w="100%" overflow="hidden" p={3} gap={3} bg="#131826">
      {/* Otsikko */}
      <Flex h="56px" flexShrink={0} align="center" gap={3} px={4} className="lfc-header" borderRadius="lg">
        <Text fontSize="2xl" lineHeight="1">🚢</Text>
        <Heading size="lg" color="#e8ecf4">LFC RO Simulator</Heading>
        <Text fontSize="xs" className="lfc-muted" display={{ base: 'none', xl: 'block' }}>freshwater treatment · parasite removal</Text>
        <Badge colorScheme={sim.producing ? 'green' : 'gray'} variant={sim.producing ? 'solid' : 'subtle'}>
          {sim.producing ? `PRODUCING ${sim.capacity} m³/h` : 'STANDBY'}
        </Badge>
        <Badge colorScheme={statusColor}>{statusText}</Badge>
        <Text fontSize="xs" className="lfc-muted" display={{ base: 'none', lg: 'block' }}>
          {sim.vessel.lat.toFixed(3)}°N {sim.vessel.lon.toFixed(3)}°E · {sim.mode === 'auto' ? 'auto route' : 'manual'}
          {sim.mode === 'auto' && sim.routeAvoidFarm && (
            <Text as="span" color="#f6ad55" ml={2}>
              · ⚠ avoiding {sim.routeAvoidFarm} ({sim.routeAvoidSide === 1 ? 'farm to port' : 'farm to starboard'})
            </Text>
          )}
        </Text>
        <Box marginLeft="auto">
          <HStack spacing={2} fontSize="xs" className="lfc-muted">
            <Text>{dataReady ? `${areas.length} areas · ${zones.length} zones` : 'loading…'}</Text>
            {sim.banners.length > 0 && <Badge colorScheme="red">{sim.banners.length} alert(s)</Badge>}
          </HStack>
        </Box>
      </Flex>

      {/* Näkymät */}
      <Tabs variant="hailer" isFitted isLazy flex="1" minH="0" display="flex" flexDirection="column" onChange={setView} index={view}>
        <TabList flexShrink={0} className="lfc-tablist">
          <Tab _selected={{ color: '#7fe3f2', borderBottom: '2px solid #7fe3f2' }}>Scene 3D</Tab>
          <Tab _selected={{ color: '#7fe3f2', borderBottom: '2px solid #7fe3f2' }}>Process</Tab>
          <Tab _selected={{ color: '#7fe3f2', borderBottom: '2px solid #7fe3f2' }}>Map</Tab>
          <Tab _selected={{ color: '#7fe3f2', borderBottom: '2px solid #7fe3f2' }}>Maintenance</Tab>
          <Tab _selected={{ color: '#7fe3f2', borderBottom: '2px solid #7fe3f2' }}>History</Tab>
          <Tab _selected={{ color: '#7fe3f2', borderBottom: '2px solid #7fe3f2' }}>Datalog</Tab>
          <Tab _selected={{ color: '#7fe3f2', borderBottom: '2px solid #7fe3f2' }}>Report</Tab>
        </TabList>
        <TabPanels flex="1" minH="0" display="flex" flexDirection="column">
          <TabPanel flex="1" minH="0" display="flex" flexDirection="column" p={0} pt={3}>
            <SceneView tags={tags} areas={areas} instructionByType={instructionByType} onAfterStop={handleAfterStop} />
          </TabPanel>
          <TabPanel flex="1" minH="0" display="flex" flexDirection="column" p={0} pt={3}>
            <ProcessView tags={tags} areas={areas} instructionByType={instructionByType} onAfterStop={handleAfterStop} />
          </TabPanel>
          <TabPanel flex="1" minH="0" p={0} pt={3}>
            <MapView areas={areas} zones={zones} sessions={sessions} />
          </TabPanel>
          <TabPanel flex="1" minH="0" p={0} pt={3}>
            <MaintenanceView instructions={instructions} actions={actions} alerts={alerts} sessions={sessions} onRefresh={refreshHistory} />
          </TabPanel>
          <TabPanel flex="1" minH="0" p={0} pt={3}>
            <HistoryView sessions={sessions} alerts={alerts} actions={actions} />
          </TabPanel>
          <TabPanel flex="1" minH="0" p={0} pt={3}>
            <DataLogView sessions={sessions} />
          </TabPanel>
                  <TabPanel flex="1" minH="0" p={0} pt={3}>
            <ReportView sessions={sessions} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>
  );
}
