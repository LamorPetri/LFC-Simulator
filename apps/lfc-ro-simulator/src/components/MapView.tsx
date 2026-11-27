import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { useSim } from '../sim/store';
import { AreaRec, ZoneRec, SessionRec } from '../api';
import { FARMS, FARM_RADIUS_M, FARM_KEEP_OUT_M, FARM_CLEARANCE_M } from '../sim/data';

interface Props {
  areas: AreaRec[];
  zones: ZoneRec[];
  sessions: SessionRec[];
}

function suitabilityColor(a: AreaRec): string {
  const s = a.suitability ?? 100;
  if (s >= 70) return '#38A169';
  if (s >= 40) return '#D69E2E';
  if (a.limitingFactor === 'fish farm' || a.limitingFactor === 'shallow water') return '#DD6B20';
  return '#E53E3E';
}

export default function MapView({ areas, zones, sessions }: Props) {
  const mode = useSim((s) => s.mode);
  const avoidFarm = useSim((s) => s.routeAvoidFarm);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const vesselRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // kartan alustus kerran
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const map = L.map(el, { scrollWheelZoom: true });
    mapRef.current = map;
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics · Farms: Fiskeridir (CC BY) · Depths: GEBCO 2020',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.setView([63.7, 9.4], 8);
    let fitted = false;
    const fitRegion = () => map.fitBounds(L.latLngBounds([[63.3, 8.2], [64.08, 10.6]]), { padding: [20, 20] });
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fitted && el.clientWidth > 100) {
        fitted = true;
        fitRegion();
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // datakerrokset
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // matalikkovyöhykkeet (GEBCO) — oranssi
    for (const z of zones.filter((x) => x.type === 'Shallow water' && x.active)) {
      L.circle([z.lat, z.lon], {
        radius: z.radiusM,
        color: '#E67E22',
        weight: 3,
        fillColor: '#E67E22',
        fillOpacity: 0.28,
      })
        .bindTooltip(`Shallows &lt; 10 m — ${z.source ?? 'GEBCO'}`)
        .addTo(layer);
    }
    // häkit — 🐟-merkki + 500 m oranssi ympyrä (merikorttityyli) + punainen kieltoalue (alus ei koskaan mene sisälle)
    for (const f of FARMS) {
      L.circle([f.lat, f.lon], {
        radius: FARM_RADIUS_M,
        color: '#E67E22',
        weight: 3,
        fillColor: '#E67E22',
        fillOpacity: 0.32,
      })
        .bindTooltip(`🐟 ${f.name} — 500 m zone (Fiskeridir)`)
        .addTo(layer);
      L.circle([f.lat, f.lon], {
        radius: FARM_KEEP_OUT_M,
        color: '#E53E3E',
        weight: 2,
        fill: false,
        dashArray: '4 4',
      })
        .bindTooltip(`⛔ ${f.name} — keep-out ${FARM_KEEP_OUT_M} m: cages + hull + ${FARM_CLEARANCE_M} m clearance`)
        .addTo(layer);
      L.marker([f.lat, f.lon], {
        icon: L.divIcon({ className: 'farm-marker', html: '🐟', iconSize: [20, 20], iconAnchor: [10, 10] }),
        interactive: true,
      })
        .bindTooltip(f.name)
        .addTo(layer);
    }
    // toiminta-alueet sopivuusväreillä
    for (const a of areas) {
      if (a.lat === null || a.lon === null) continue;
      L.circle([a.lat, a.lon], {
        radius: (a.radiusKm ?? 4) * 1000,
        color: suitabilityColor(a),
        weight: 2,
        fillColor: suitabilityColor(a),
        fillOpacity: 0.10,
      })
        .bindTooltip(
          `<b>${a.name}</b><br/>Suitability: ${a.suitability ?? '—'}/100` +
          (a.limitingFactor ? `<br/>Limiting: ${a.limitingFactor}` : '') +
          `<br/>Avg depth: ${a.avgDepth ?? '—'} m · Shallow: ${a.shallowPct ?? 0}%` +
          `<br/>Nearest farm: ${a.farmDistance ?? '—'} m`,
        )
        .addTo(layer);
    }
    // tuotantopisteet (session aloituskohdat)
    for (const s of sessions) {
      if (s.startLat === null || s.startLon === null) continue;
      const risk = s.foulingRisk ?? 0;
      const color = risk >= 60 ? '#E53E3E' : risk >= 30 ? '#DD6B20' : '#38A169';
      L.circleMarker([s.startLat, s.startLon], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .bindTooltip(
          `<b>${s.name}</b><br/>${s.start ? new Date(s.start).toLocaleString('en-GB') : ''}` +
          `<br/>Volume: ${s.volume ?? '—'} m³ · Fouling risk: ${s.foulingRisk ?? '—'}` +
          (s.recommendation ? `<br/>${s.recommendation}` : ''),
        )
        .addTo(layer);
    }

    // alus
    const vesselIcon = L.divIcon({
      className: 'vessel-marker',
      html: '<div style="font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">🚢</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const { lat, lon } = useSim.getState().vessel;
    vesselRef.current = L.marker([lat, lon], { icon: vesselIcon, zIndexOffset: 900 })
      .bindTooltip('LFC — click map in Manual mode to move')
      .addTo(layer);
    trailRef.current = L.polyline([[lat, lon]], { color: '#63b3ed', weight: 2, opacity: 0.7, dashArray: '2 6' }).addTo(layer);

    // klikkaus = manuaalinen sijoitus
    const onClick = (e: L.LeafletMouseEvent) => {
      if (useSim.getState().mode !== 'manual') return;
      useSim.getState().placeVessel(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [areas, zones, sessions]);

  // aluksen liike (tila-sinkronointi 1 Hz)
  useEffect(() => {
    const unsub = useSim.subscribe((s) => {
      const m = vesselRef.current;
      const t = trailRef.current;
      if (!m || !t) return;
      m.setLatLng([s.vessel.lat, s.vessel.lon]);
      const pts = t.getLatLngs() as L.LatLng[];
      const last = pts[pts.length - 1];
      if (!last || last.lat !== s.vessel.lat || last.lng !== s.vessel.lon) {
        pts.push(L.latLng(s.vessel.lat, s.vessel.lon));
        if (pts.length > 240) pts.shift();
        t.setLatLngs(pts);
      }
    });
    return unsub;
  }, []);

  return (
    <Box position="relative" height="100%" borderRadius="lg" overflow="hidden" borderWidth="1px">
      <div ref={mountRef} className="lfc-map" />
      {/* Auto/Manual moodin vaihto */}
      <Box
        position="absolute" top={3} right={3} zIndex={500}
        className="lfc-panel" p={2}
      >
        <HStack spacing={2}>
          <Button
            size="xs"
            variant={mode === 'auto' ? 'solid' : 'outline'}
            colorScheme="blue"
            onClick={() => useSim.getState().setMode('auto')}
          >
            Auto route
          </Button>
          <Button
            size="xs"
            variant={mode === 'manual' ? 'solid' : 'outline'}
            colorScheme="blue"
            onClick={() => useSim.getState().setMode('manual')}
          >
            Manual
          </Button>
        </HStack>
        <Text fontSize="10px" color="#8e9ab8" mt={1} textAlign="center">
          {mode === 'manual' ? 'Click map to place vessel — snaps outside keep-out' : 'Following 3-farm route'}
        </Text>
        {mode === 'auto' && avoidFarm && (
          <Text fontSize="10px" color="#f6ad55" textAlign="center">⚠ avoiding {avoidFarm} · keep-out {FARM_KEEP_OUT_M} m</Text>
        )}
      </Box>
      <Box
        position="absolute" bottom={8} left={8} zIndex={500}
        bg="rgba(26,32,44,0.85)" color="white" borderRadius="md" p={2} fontSize="xs"
      >
        <Text fontWeight="bold" mb={1}>Legend</Text>
        <Text>🟢 suitability ≥ 70</Text>
        <Text>🟡 40–69</Text>
        <Text>🟠 &lt; 40 — fish farm / shallows</Text>
        <Text>🔴 &lt; 40 — other (algae etc.)</Text>
        <Text mt={1}>🐟 farm zone 500 m · dashed = &lt; 10 m</Text>
        <Text><span style={{ color: '#E53E3E' }}>⛔ red dashed</span> = keep-out {FARM_KEEP_OUT_M} m (cages + {FARM_CLEARANCE_M} m) — vessel never enters</Text>
        <Text>🚢 vessel · dots = production starts</Text>
      </Box>
    </Box>
  );
}
