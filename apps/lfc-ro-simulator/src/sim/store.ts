/**
 * Simulaation tila: aluksen reitti, tuotanto, likaantuminen ja prosessiarvot.
 * Päivittyy tick() -kutsusta (App ajaa sekuntikellon).
 */
import { create } from 'zustand';
import { evaluatePoint, foulingRatePerHour, recommend, routeStep, pushOutOfKeepOut, PointEval, AvoidSide } from './engine';
import { ROUTE_WAYPOINTS } from './engine';

export interface BannerAlert {
  id: string;
  type: string;
  severity: 'Warning' | 'Critical';
  message: string;
}

export interface SimState {
  mode: 'auto' | 'manual';
  vessel: { lat: number; lon: number };
  routeTarget: number;
  /** Häkin kiertosuunta (1 = häkki vasemmalla, -1 = oikealla, 0 = ei kiertoa) ja kierrettävä häkki. */
  routeAvoidSide: AvoidSide;
  routeAvoidFarm: string | null;
  vesselEval: PointEval;
  producing: boolean;
  cipRunning: boolean;
  capacity: number;
  fouling: number;
  abollDp: number;
  volume: number;
  naohLiters: number;
  antiscalantLiters: number;
  phSum: number;
  phCount: number;
  tankLevel: number;
  tags: {
    FT101: number; PT102: number; PDT103: number;
    FT201: number; CT301: number; LT401: number; TT104: number;
    AT501: number; FT501: number; FT502: number;
  };
  sessionId: string | null;
  startedAt: number | null;
  chase: boolean;
  banners: BannerAlert[];
  pendingRecommendation: string[] | null;
  foulingAlerted: boolean;
  lastTickAt: number;
  // toiminnot
  setMode: (m: 'auto' | 'manual') => void;
  setCapacity: (c: number) => void;
  placeVessel: (lat: number, lon: number) => void;
  setSessionId: (id: string | null) => void;
  pushBanner: (a: BannerAlert) => void;
  dismissBanner: (id: string) => void;
  setRecommendation: (r: string[] | null) => void;
  tick: (dtS: number) => void;
}

/** Aloitussijainti: ensimmäisen reittipisteen (häkin) länsipuolella 300 m — aina häkkien kieltoalueiden ulkopuolella. */
const START_M_PER_LON = 111320 * Math.cos((ROUTE_WAYPOINTS[0].lat * Math.PI) / 180);
const START = pushOutOfKeepOut(ROUTE_WAYPOINTS[0].lat, ROUTE_WAYPOINTS[0].lon - 300 / START_M_PER_LON);

export const useSim = create<SimState>((set, get) => ({
  mode: 'auto',
  vessel: { ...START },
  routeTarget: 1,
  routeAvoidSide: 0,
  routeAvoidFarm: null,
  vesselEval: evaluatePoint(START.lat, START.lon),
  producing: false,
  cipRunning: false,
  capacity: 125,
  fouling: 8,
  abollDp: 0.2,
  volume: 0,
  naohLiters: 0,
  antiscalantLiters: 0,
  phSum: 0,
  phCount: 0,
  tankLevel: 62,
  tags: { FT101: 0, PT102: 0, PDT103: 0, FT201: 0, CT301: 0, LT401: 62, TT104: 9, AT501: 7.5, FT501: 0, FT502: 0 },
  sessionId: null,
  startedAt: null,
  chase: true,
  banners: [],
  pendingRecommendation: null,
  foulingAlerted: false,
  lastTickAt: Date.now(),

  setMode: (m) => set({ mode: m, routeAvoidSide: 0, routeAvoidFarm: null }),
  setCapacity: (c) => set({ capacity: Math.round(c) }),
  // manuaalinen sijoitus: häkin sisälle klikattu piste työnnetään kieltoalueen ulkopuolelle (runko + 3 m varan päähän)
  placeVessel: (lat, lon) => {
    const p = pushOutOfKeepOut(lat, lon);
    set({ vessel: p, vesselEval: evaluatePoint(p.lat, p.lon), routeAvoidSide: 0, routeAvoidFarm: null });
  },
  setSessionId: (id) => set({ sessionId: id }),
  pushBanner: (a) => set((s) => ({ banners: [a, ...s.banners.filter((b) => b.id !== a.id)].slice(0, 4) })),
  dismissBanner: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),
  setRecommendation: (r) => set({ pendingRecommendation: r }),

  tick: (dtS) => {
    const s = get();
    const patch: Partial<SimState> = { lastTickAt: Date.now() };
    // aluksen liike
    if (s.mode === 'auto') {
      const r = routeStep(s.vessel.lat, s.vessel.lon, s.routeTarget, 11, dtS, s.routeAvoidSide, s.routeAvoidFarm);
      patch.vessel = { lat: r.lat, lon: r.lon };
      patch.routeTarget = r.targetIdx;
      patch.routeAvoidSide = r.avoidSide;
      patch.routeAvoidFarm = r.avoiding;
      patch.vesselEval = evaluatePoint(r.lat, r.lon);
    }
    const ev = patch.vesselEval ?? s.vesselEval;
    const cap = s.capacity;
    let { fouling, abollDp, volume, tankLevel, naohLiters, antiscalantLiters, phSum, phCount } = s;
    // CIP (ei tuotantoa): fouling putoaa ~40%/min kunnes 2-5%; dp palautuu
    if (s.cipRunning && !s.producing) {
      const floor = 2 + Math.sin(Date.now() / 900) * 1.5;
      fouling = Math.max(floor, fouling - (40 * dtS) / 60);
      abollDp = Math.max(0.15, abollDp - (0.3 * dtS) / 60);
      if (fouling < 50 && get().foulingAlerted) set({ foulingAlerted: false });
    }
    const noise = (a: number) => (Math.random() - 0.5) * a;
    let ph = s.tags.AT501;
    let naohRate = 0;
    let antiRate = 0;
    if (s.producing) {
      // AquaBoll dp nousee veden laadun mukaan (0.03-0.12 bar/h)
      const dpRate = ev.status === 'farm' ? 0.12 : ev.status === 'shallow' ? 0.08 : ev.status === 'caution' ? 0.05 : 0.03;
      abollDp = Math.min(1.2, abollDp + ((dpRate * dtS) / 3600) * (cap / 120));
      // fouling: perusnopeus x dp-kerroin (korkea etusuodattimen dp NOPEUTTAA kasvua)
      const dpMul = abollDp > 0.6 ? 1.5 : abollDp > 0.4 ? 1.2 : 1.0;
      const rate = foulingRatePerHour(ev, cap) * dpMul;
      fouling = Math.min(100, fouling + (rate * dtS) / 3600);
      volume = volume + (cap * dtS) / 3600;
      // fouling >= 80%: CIP-suositus (vain kerran per nousu)
      if (fouling >= 80 && !get().foulingAlerted) {
        set({ foulingAlerted: true });
        get().pushBanner({ id: 'fouling-80', type: 'Fouling factor', severity: 'Critical', message: 'Fouling factor at 80%. Stop production and run CIP flush.' });
      }
      tankLevel = Math.min(100, tankLevel + (cap / 500) * dtS / 60);
      // NaOH-annostus: raakapH laskee likaantumisen myötä, säädin tähtää 7.5:een
      const rawPh = 6.6 - (fouling / 100) * 0.8;
      naohRate = Math.max(0, Math.min(12, (7.5 - rawPh) * 5));
      ph += (7.5 - ph) * Math.min(1, dtS * 0.2) + noise(0.02);
      phSum += ph * dtS;
      phCount += dtS;
      naohLiters += (naohRate * dtS) / 3600;
      // Antiskalantti: 2 ml/m3 tuotettua vetta
      antiRate = cap * 0.002 * 10;
      antiscalantLiters += (antiRate * dtS) / 3600;
    } else {
      // fouling pysyy — vain CIP pesee sen pois
      tankLevel = Math.max(0, tankLevel - (0.8 * dtS) / 3600);
    }
    patch.fouling = fouling;
    patch.abollDp = abollDp;
    patch.volume = volume;
    patch.tankLevel = tankLevel;
    patch.naohLiters = naohLiters;
    patch.antiscalantLiters = antiscalantLiters;
    patch.phSum = phSum;
    patch.phCount = phCount;
    patch.tags = {
      FT101: s.producing ? cap + noise(3) : 0,
      PT102: s.producing ? 45.5 + fouling * 0.09 + noise(0.4) : 0,
      PDT103: 0.65 + (fouling / 100) * 1.25 + noise(0.03),
      FT201: s.producing ? cap * 0.88 - (fouling / 100) * 14 + noise(2) : 0,
      CT301: 24 + (fouling / 100) * 38 + noise(2),
      LT401: tankLevel,
      TT104: 9 + Math.sin(Date.now() / 900000) * 1.2 + noise(0.3),
      AT501: Math.round(ph * 100) / 100,
      FT501: Math.round(naohRate * 10) / 10,
      FT502: Math.round(antiRate * 100) / 100,
    };
    set(patch);
  },
}));

/** START: arvioi pisteen, palauta bannerit ja suositus (App hoitaa Hailer-kirjoitukset). */
export function startProduction(): { evalResult: PointEval; recommendation: string[] } {
  const s = useSim.getState();
  const ev = evaluatePoint(s.vessel.lat, s.vessel.lon);
  useSim.setState({ producing: true, volume: 0, vesselEval: ev, pendingRecommendation: null, startedAt: Date.now() });
  return { evalResult: ev, recommendation: recommend(ev, 0) };
}

export function stopProduction(): { volume: number; dp: number; conductivity: number; evalResult: PointEval; recommendation: string[] } {
  const s = useSim.getState();
  const ev = s.vesselEval;
  const rec = recommend(ev, s.volume);
  const out = {
    volume: Math.round(s.volume),
    dp: Math.round(s.tags.PDT103 * 100) / 100,
    conductivity: Math.round(s.tags.CT301),
    evalResult: ev,
    recommendation: rec,
  };
  useSim.setState({ producing: false, pendingRecommendation: rec });
  return out;
}
