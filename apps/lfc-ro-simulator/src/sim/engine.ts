/**
 * Simulaatiomoottori: pistekohtainen arviointi (häkki/matalikko) ja
 * prosessiarvojen mallinnus. Sama sääntölogiikka kuin työtilan funktiokentissä.
 */
import { DEPTH, FARMS, ROUTE, FARM_RADIUS_M, SHALLOW_LIMIT_M, FARM_KEEP_OUT_M, Farm } from './data';

const R = 6371000;

export function distM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Lähin GEBCO-syvysnäyte metreinä (null = maa). */
export function depthAt(lat: number, lon: number): number | null {
  let best: number | null = null;
  let bd = Infinity;
  for (let i = 0; i < DEPTH.rows; i++) {
    const dLat = Math.abs(DEPTH.lat0 + i * DEPTH.dlat - lat) * 111320;
    if (dLat > 3000) continue;
    for (let j = 0; j < DEPTH.cols; j++) {
      const dLon = Math.abs(DEPTH.lon0 + j * DEPTH.dlon - lon) * 55000;
      if (dLon > 3000) continue;
      const v = DEPTH.values[i * DEPTH.cols + j];
      if (v === 32767) continue;
      const d = dLat * dLat + dLon * dLon;
      if (d < bd) {
        bd = d;
        best = v / 10;
      }
    }
  }
  return best;
}

export interface NearestFarm { farm: Farm; distM: number; }

export function nearestFarm(lat: number, lon: number): NearestFarm | null {
  let best: NearestFarm | null = null;
  for (const f of FARMS) {
    const d = distM(lat, lon, f.lat, f.lon);
    if (!best || d < best.distM) best = { farm: f, distM: d };
  }
  return best;
}

export type PointStatus = 'good' | 'caution' | 'farm' | 'shallow';

export interface PointEval {
  status: PointStatus;
  depth: number | null;
  farm: NearestFarm | null;
  inFarmZone: boolean;
  inShallow: boolean;
  reasons: string[];
}

/** Pistekohtainen sopivuusarvio (samat 500 m / 10 m säännöt kuin työtilassa). */
export function evaluatePoint(lat: number, lon: number): PointEval {
  const depth = depthAt(lat, lon);
  const farm = nearestFarm(lat, lon);
  const inFarmZone = !!farm && farm.distM < FARM_RADIUS_M;
  const inShallow = depth !== null && depth < SHALLOW_LIMIT_M && depth > 0;
  const reasons: string[] = [];
  if (inFarmZone && farm) reasons.push(`Fish farm ${farm.farm.name} ${Math.round(farm.distM)} m away (zone ${FARM_RADIUS_M} m)`);
  if (inShallow && depth !== null) reasons.push(`Depth ${depth.toFixed(1)} m < ${SHALLOW_LIMIT_M} m (shallows)`);
  let status: PointStatus = 'good';
  if (inFarmZone) status = 'farm';
  else if (inShallow) status = 'shallow';
  else if (farm && farm.distM < FARM_RADIUS_M * 4) status = 'caution';
  return { status, depth, farm, inFarmZone, inShallow, reasons };
}

export const MAINTENANCE_ACTIONS = [
  'CIP flush',
  'Extended freshwater flush',
  'Prefilter change',
  'Membrane inspection',
  'Normal stop',
] as const;

/** Ennakoivan huollon suositus samalla sääntötaululla kuin funktiokenttä. */
export function recommend(ev: PointEval, volume: number): string[] {
  const acts: string[] = [];
  if (ev.inFarmZone) {
    acts.push('CIP flush');
    acts.push('Extended freshwater flush');
  }
  if (ev.inShallow) {
    acts.push('Extended freshwater flush');
    acts.push('Prefilter change');
  }
  if (volume > 1500 && acts.length > 0) acts.push('Membrane inspection');
  if (acts.length === 0) acts.push('Normal stop');
  return [...new Set(acts)];
}

/** Likaantumisnopeus (%/h) alueen mukaan. */
export function foulingRatePerHour(ev: PointEval, capacity: number): number {
  let rate = 2;
  if (ev.status === 'caution') rate = 5;
  if (ev.status === 'shallow') rate = 9;
  if (ev.status === 'farm') rate = 12;
  return rate * (capacity / 120);
}

/* ---------- Reitti ja häkkien kiertäminen ---------- */

/** Kiertosuunta: 1 = häkki jää vasemmalle (portti), -1 = oikealle, 0 = ei kiertoa. */
export type AvoidSide = 1 | -1 | 0;
export interface Geo { lat: number; lon: number }
interface Pt { x: number; y: number }
interface FarmLocal { f: Farm; c: Pt; d: number }

/** Saapumisetäisyys reittipisteeseen (häkin keskusta) — kieltoalue jää aina taakse. */
export const ROUTE_ARRIVE_M = 400;
/** Marginaali kieltoalueen ulkopuolella (m): alus kulkee kehää tätä säteenä ja työntyy tänne ulos. */
export const KEEP_OUT_MARGIN_M = 2;
/** Aliaskelten maksimipituus (m) — estää kieltoalueen "tunneloinnin" isolla aika-askeleella. */
const SUBSTEP_M = 20;
/** Kiertöreitin kaaren säde (m). */
const ARC_R = FARM_KEEP_OUT_M + KEEP_OUT_MARGIN_M;
/** Esteen tunnistussäde (m): hieman kaaren säteen sisällä, jotta kehältä päästään lähtemään tangenttisesti. */
const R_TEST = ARC_R - 0.5;

const M_PER_LAT = 111320;
const mPerLon = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Paikallinen taso (m, x = itä, y = pohjoinen) origon ympärillä. */
function toLocal(lat: number, lon: number, oLat: number, oLon: number): Pt {
  return { x: (lon - oLon) * mPerLon(oLat), y: (lat - oLat) * M_PER_LAT };
}
function toGeo(p: Pt, oLat: number, oLon: number): Geo {
  return { lat: oLat + p.y / M_PER_LAT, lon: oLon + p.x / mPerLon(oLat) };
}

/** Leikkaako jana a→b ympyrän (keskus c, säde r)? */
function segmentHitsCircle(a: Pt, b: Pt, c: Pt, r: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((c.x - a.x) * dx + (c.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx - c.x, py = a.y + t * dy - c.y;
  return px * px + py * py < r * r;
}

/** Ensimmäinen häkki jonka kieltoalue jana a→b leikkaa (lähimpänä janan alkua). */
function firstBlocker(a: Pt, b: Pt, farms: FarmLocal[], excludeName?: string): FarmLocal | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let best: FarmLocal | null = null;
  let bestT = Infinity;
  for (const o of farms) {
    if (o.f.name === excludeName) continue;
    if (!segmentHitsCircle(a, b, o.c, R_TEST)) continue;
    const t = l2 > 0 ? ((o.c.x - a.x) * dx + (o.c.y - a.y) * dy) / l2 : 0;
    const key = Math.max(0, Math.min(1, t));
    if (key < bestT) { bestT = key; best = o; }
  }
  return best;
}

/** Kosketuspiste ympyrän (c, r) kehalla aluksen sijainnista — puolelta `side`. */
function tangentPoint(pos: Pt, c: Pt, r: number, side: 1 | -1): Pt {
  const dx = c.x - pos.x, dy = c.y - pos.y;
  const d = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx) + side * Math.asin(Math.min(1, r / d));
  const t = Math.sqrt(Math.max(0, d * d - r * r));
  return { x: pos.x + Math.cos(a) * t, y: pos.y + Math.sin(a) * t };
}

/** Siirtymä ympyrän kehää pitkin puolella `side` pituuden `len` verran. */
function arcAlong(pos: Pt, c: Pt, r: number, side: 1 | -1, len: number): Pt {
  const th = Math.atan2(pos.y - c.y, pos.x - c.x) + (side * len) / r;
  return { x: c.x + Math.cos(th) * r, y: c.y + Math.sin(th) * r };
}

/** Lyhyempi kiertosuunta: se puoli, jolla suora reitti jo kulkee (häkki on reitin toisella puolella).
 *  Jos valitun puolen kosketusviiva osuu toiseen häkkiin, valitaan toinen puoli. */
function chooseSide(tgt: Pt, blk: FarmLocal, farms: FarmLocal[]): 1 | -1 {
  const pos: Pt = { x: 0, y: 0 };
  const cross = tgt.x * blk.c.y - tgt.y * blk.c.x; // > 0 = häkki reitin vasemmalla puolella
  let s: 1 | -1 = cross > 0 ? -1 : 1;
  const blocked = (side: 1 | -1) => {
    const tan = tangentPoint(pos, blk.c, ARC_R, side);
    return farms.some((o) => o !== blk && segmentHitsCircle(pos, tan, o.c, R_TEST));
  };
  const other: 1 | -1 = s === 1 ? -1 : 1;
  if (blocked(s) && !blocked(other)) s = other;
  return s;
}

/** Yksi aliaskel: suoraan kohti reittipistettä tai kieltoalueen kehää pitkin sen ympäri. */
function advanceSub(p: Geo, target: Farm, side: AvoidSide, avoidFarm: string | null, sub: number): { p: Geo; side: AvoidSide; avoiding: string | null } {
  const farms: FarmLocal[] = FARMS.map((f) => {
    const c = toLocal(f.lat, f.lon, p.lat, p.lon);
    return { f, c, d: Math.hypot(c.x, c.y) };
  });
  const pos: Pt = { x: 0, y: 0 };
  const tgt = toLocal(target.lat, target.lon, p.lat, p.lon);
  const dT = Math.hypot(tgt.x, tgt.y) || 1;
  const next: Pt = { x: (tgt.x / dT) * sub, y: (tgt.y / dT) * sub };

  // koko tie reittipisteeseen: tukossa → aloitetaan kiertäminen ajoissa (kosketusviiva kehälle)
  const block = firstBlocker(pos, tgt, farms, target.name) ?? firstBlocker(pos, next, farms);
  if (!block) return { p: toGeo(next, p.lat, p.lon), side: 0, avoiding: null };

  // suunta pysyy samana niin kauan kuin sama häkki estää (ei häärää vasemman/oikean välillä)
  const s: 1 | -1 = side !== 0 && avoidFarm === block.f.name ? side : chooseSide(tgt, block, farms);
  let np: Pt;
  if (block.d <= ARC_R + 6) {
    // kieltoalueen reunalla → kaartaminen kehää pitkin
    np = arcAlong(pos, block.c, ARC_R, s, sub);
  } else {
    const tan = tangentPoint(pos, block.c, ARC_R, s);
    const dTan = Math.hypot(tan.x, tan.y);
    if (dTan <= sub) np = arcAlong(tan, block.c, ARC_R, s, sub - dTan);
    else np = { x: (tan.x / dTan) * sub, y: (tan.y / dTan) * sub };
  }
  return { p: toGeo(np, p.lat, p.lon), side: s, avoiding: block.f.name };
}

/** Työntää pisteen kaikkien häkkien kieltoalueiden ulkopuolelle (radiaalisti kehälle + marginaali). */
export function pushOutOfKeepOut(lat: number, lon: number): Geo {
  let p: Geo = { lat, lon };
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const f of FARMS) {
      // p häkin suhteen; työnnetään radiaalisti kehälle ARC_R häkin keskustasta
      const c = toLocal(p.lat, p.lon, f.lat, f.lon);
      const d = Math.hypot(c.x, c.y);
      if (d < ARC_R) {
        if (d < 1e-6) { c.x = ARC_R; c.y = 0; } else { c.x *= ARC_R / d; c.y *= ARC_R / d; }
        p = toGeo(c, f.lat, f.lon);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return p;
}

export interface RouteResult { lat: number; lon: number; targetIdx: number; avoidSide: AvoidSide; avoiding: string | null }

/** Reittisimulaatio: kolmen häkin kolmio, nopeus solmuina. Häkkien kieltoalue (FARM_KEEP_OUT_M)
 *  kiertäydään aina: suora kosketusviiva kehälle → kaartaminen kehää pitkin → suora kohti reittipistettä.
 *  Reittipiste on häkin keskusta, mutta saapuminen tapahtuu ROUTE_ARRIVE_M päästä (kieltoalueen ulkopuolella). */
export function routeStep(lat: number, lon: number, targetIdx: number, speedKn: number, dtS: number, avoidSide: AvoidSide = 0, avoidFarm: string | null = null): RouteResult {
  const stepM = speedKn * 0.5144 * dtS;
  let p: Geo = { lat, lon };
  let idx = targetIdx;
  let side: AvoidSide = avoidSide;
  let avoiding: string | null = avoidFarm;
  const n = Math.max(1, Math.ceil(stepM / SUBSTEP_M));
  const sub = stepM / n;
  for (let i = 0; i < n; i++) {
    let target = ROUTE[idx % ROUTE.length];
    if (distM(p.lat, p.lon, target.lat, target.lon) < ROUTE_ARRIVE_M) {
      idx = (idx + 1) % ROUTE.length;
      side = 0;
      avoiding = null;
      target = ROUTE[idx];
    }
    const r = advanceSub(p, target, side, avoiding, sub);
    p = r.p;
    side = r.side;
    avoiding = r.avoiding;
  }
  // turvaverkko: sijainti ei voi koskaan jäädä kieltoalueen sisälle
  p = pushOutOfKeepOut(p.lat, p.lon);
  return { lat: p.lat, lon: p.lon, targetIdx: idx, avoidSide: side, avoiding };
}

export const ROUTE_WAYPOINTS = ROUTE;
