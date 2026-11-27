/**
 * Hailer-datakerros: lukee alueet, vyöhykkeet, ohjeet, PLC-tagit ja historian;
 * kirjoittaa sessiot, hälytykset ja toimenpiteet.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Hailer-aktiviteettien raakamuoto (fields-mappa) on dynaaminen */
import { useApp } from './hailer/use-app';
import {
  WF, OperatingareasFields, OperatingareasPhases,
  RiskzonesFields, RiskzonesPhases,
  MaintenanceinstructionsFields, MaintenanceinstructionsPhases,
  PlctagmapFields, PlctagmapPhases,
  ProductionsessionsFields, ProductionsessionsPhases,
  AlertsFields, AlertsPhases,
  MaintenanceactionsFields, MaintenanceactionsPhases,
} from './sim/ids';

function h(): NonNullable<ReturnType<typeof useApp.getState>['hailer']> {
  const { hailer } = useApp.getState();
  if (!hailer) throw new Error('Hailer SDK not ready');
  return hailer;
}

async function listAll(workflowId: string, phaseIds: readonly string[]): Promise<any[]> {
  const all: any[] = [];
  for (const phaseId of phaseIds) {
    let skip = 0;
    for (;;) {
      const page: unknown = await h().activity.list(workflowId, phaseId, { limit: 200, skip });
      if (!Array.isArray(page) || page.length === 0) break;
      all.push(...page.map((a: any) => ({ ...a, currentPhase: a.currentPhase || phaseId })));
      if (page.length < 200) break;
      skip += 200;
      if (skip > 5000) break;
    }
  }
  return all;
}

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);
const linkId = (v: unknown): string | null => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && '_id' in (v as any)) return (v as any)._id as string;
  return null;
};

/* ----- laodit ----- */

export interface AreaRec {
  id: string; name: string; lat: number | null; lon: number | null; radiusKm: number | null;
  suitability: number | null; limitingFactor: string | null;
  farmDistance: number | null; shallowPct: number | null; avgDepth: number | null;
  turbidity: number | null; algaeRisk: string | null; temperature: number | null;
}

export async function loadAreas(): Promise<AreaRec[]> {
  const F = OperatingareasFields;
  const rows = await listAll(WF.operating_areas, [OperatingareasPhases.new_phase]);
  return rows.map((a) => ({
    id: a._id,
    name: a.name,
    lat: num(a.fields?.[F.latitude]),
    lon: num(a.fields?.[F.longitude]),
    radiusKm: num(a.fields?.[F.radius_km]),
    suitability: num(a.fields?.[F.suitability_0100]),
    limitingFactor: str(a.fields?.[F.limiting_factor]),
    farmDistance: num(a.fields?.[F.nearest_farm_distance]),
    shallowPct: num(a.fields?.[F.shallow_share]),
    avgDepth: num(a.fields?.[F.avg_depth]),
    turbidity: num(a.fields?.[F.turbidity]),
    algaeRisk: str(a.fields?.[F.algae_risk]),
    temperature: num(a.fields?.[F.temperature]),
  }));
}

export interface ZoneRec { id: string; name: string; type: string; lat: number; lon: number; radiusM: number; source: string | null; active: boolean; }

export async function loadZones(): Promise<ZoneRec[]> {
  const F = RiskzonesFields;
  const rows = await listAll(WF.risk_zones, [RiskzonesPhases.new_phase]);
  return rows
    .map((a) => ({
      id: a._id,
      name: a.name,
      type: str(a.fields?.[F.zone_type]) ?? 'Unknown',
      lat: num(a.fields?.[F.latitude]) ?? 0,
      lon: num(a.fields?.[F.longitude]) ?? 0,
      radiusM: num(a.fields?.[F.radius]) ?? 500,
      source: str(a.fields?.[F.source]),
      active: num(a.fields?.[F.active]) === 1,
    }))
    .filter((z) => z.lat !== 0 || z.lon !== 0);
}

export interface InstructionRec { id: string; name: string; actionType: string; trigger: string | null; steps: string; durationH: number | null; chemicals: string | null; safety: string | null; }

export async function loadInstructions(): Promise<InstructionRec[]> {
  const F = MaintenanceinstructionsFields;
  const rows = await listAll(WF.maintenance_instructions, [MaintenanceinstructionsPhases.new_phase]);
  return rows.map((a) => ({
    id: a._id,
    name: a.name,
    actionType: str(a.fields?.[F.action_type]) ?? '',
    trigger: str(a.fields?.[F.trigger]),
    steps: str(a.fields?.[F.steps]) ?? '',
    durationH: num(a.fields?.[F.duration]),
    chemicals: str(a.fields?.[F.chemicals]),
    safety: str(a.fields?.[F.safety]),
  }));
}

export interface TagRec { id: string; name: string; tag: string; description: string | null; s7Address: string | null; unit: string | null; normalMin: number | null; normalMax: number | null; alarmBelow: number | null; alarmAbove: number | null; scaleMin: number | null; scaleMax: number | null; }

export async function loadTags(): Promise<TagRec[]> {
  const F = PlctagmapFields;
  const rows = await listAll(WF.plc_tag_map, [PlctagmapPhases.new_phase]);
  return rows.map((a) => ({
    id: a._id,
    name: a.name,
    tag: str(a.fields?.[F.tag]) ?? '',
    description: str(a.fields?.[F.description]),
    s7Address: str(a.fields?.[F.s7_address]),
    unit: str(a.fields?.[F.unit]),
    normalMin: num(a.fields?.[F.normal_min]),
    normalMax: num(a.fields?.[F.normal_max]),
    alarmBelow: num(a.fields?.[F.alarm_below]),
    alarmAbove: num(a.fields?.[F.alarm_above]),
    scaleMin: num(a.fields?.[F.scale_min]),
    scaleMax: num(a.fields?.[F.scale_max]),
  }));
}

export interface SessionRec {
  id: string; name: string; phase: string; areaId: string | null; areaName: string | null;
  startLat: number | null; startLon: number | null; capacity: number | null;
  start: number | null; end: number | null; volume: number | null; dp: number | null;
  conductivity: number | null; foulingRisk: number | null; recommendation: string | null;
  ph: number | null; naoh: number | null; antiscalant: number | null;
}

const SESSION_PHASES = [
  ProductionsessionsPhases.planned, ProductionsessionsPhases.active,
  ProductionsessionsPhases.ended, ProductionsessionsPhases.maintenance, ProductionsessionsPhases.closed,
];

export async function loadSessions(): Promise<SessionRec[]> {
  const F = ProductionsessionsFields;
  const rows = await listAll(WF.production_sessions, SESSION_PHASES);
  return rows.map((a) => ({
    id: a._id,
    name: a.name,
    phase: a.currentPhase,
    areaId: linkId(a.fields?.[F.area]),
    areaName: (a.fields?.[F.area] as any)?.name ?? null,
    startLat: num(a.fields?.[F.start_latitude]),
    startLon: num(a.fields?.[F.start_longitude]),
    capacity: num(a.fields?.[F.capacity]),
    start: a.fields?.[F.period]?.start ?? null,
    end: a.fields?.[F.period]?.end ?? null,
    volume: num(a.fields?.[F.volume_produced]),
    dp: num(a.fields?.[F.membrane_p]),
    conductivity: num(a.fields?.[F.permeate_conductivity]),
    foulingRisk: num(a.fields?.[F.fouling_risk_0100]),
    recommendation: str(a.fields?.[F.maintenance_recommendation]),
    ph: num(a.fields?.[F.ph_measured]),
    naoh: num(a.fields?.[F.naoh_dosed]),
    antiscalant: num(a.fields?.[F.antiscalant_dosed]),
  }));
}

export interface AlertRec { id: string; name: string; phase: string; type: string | null; severity: string | null; message: string | null; }

export async function loadAlerts(): Promise<AlertRec[]> {
  const F = AlertsFields;
  const rows = await listAll(WF.alerts, [AlertsPhases.active, AlertsPhases.acknowledged, AlertsPhases.closed]);
  return rows.map((a) => ({
    id: a._id,
    name: a.name,
    phase: a.currentPhase,
    type: str(a.fields?.[F.alert_type]),
    severity: str(a.fields?.[F.severity]),
    message: str(a.fields?.[F.message]),
  }));
}

export interface ActionRec { id: string; name: string; phase: string; actionType: string | null; instructionId: string | null; notes: string | null; }

export async function loadActions(): Promise<ActionRec[]> {
  const F = MaintenanceactionsFields;
  const rows = await listAll(WF.maintenance_actions, [MaintenanceactionsPhases.open, MaintenanceactionsPhases.done, MaintenanceactionsPhases.closed]);
  return rows.map((a) => ({
    id: a._id,
    name: a.name,
    phase: a.currentPhase,
    actionType: str(a.fields?.[F.action_type]),
    instructionId: linkId(a.fields?.[F.instruction]),
    notes: str(a.fields?.[F.notes]),
  }));
}

/* ----- kirjoitukset ----- */

export async function createSession(input: { areaId: string | null; lat: number; lon: number; capacity: number; tempC: number }): Promise<string | null> {
  const F = ProductionsessionsFields;
  const fields: Record<string, any> = {
    [F.start_latitude]: input.lat,
    [F.start_longitude]: input.lon,
    [F.capacity]: input.capacity,
    [F.period]: { start: Date.now(), end: Date.now() + 4 * 3600000 },
    [F.feed_temperature]: input.tempC,
  };
  if (input.areaId) fields[F.area] = input.areaId;
  const items = [{ name: `WS-${new Date().toISOString().slice(0, 10)} ${input.lat.toFixed(3)},${input.lon.toFixed(3)}`, fields }];
  const res = await h().activity.create(WF.production_sessions, items as any, { phaseId: ProductionsessionsPhases.active });
  const arr = Array.isArray(res) ? res : [res];
  const first = arr[0] as any;
  return first?._id ?? null;
}

export async function finishSession(sessionId: string, data: { volume: number; dp: number; conductivity: number; needsMaintenance: boolean; startedAt: number; ph: number; naoh: number; antiscalant: number }): Promise<void> {
  const F = ProductionsessionsFields;
  const P = ProductionsessionsPhases;
  await h().activity.update([{
    _id: sessionId,
    fields: {
      [F.volume_produced]: data.volume,
      [F.membrane_p]: data.dp,
      [F.permeate_conductivity]: data.conductivity,
      [F.ph_measured]: Math.round(data.ph * 100) / 100,
      [F.naoh_dosed]: Math.round(data.naoh * 10) / 10,
      [F.antiscalant_dosed]: Math.round(data.antiscalant * 10) / 10,
      [F.period]: { start: data.startedAt, end: Date.now() },
    } as any,
    phaseId: P.ended,
  }], {});
  await h().activity.update([{ _id: sessionId, phaseId: data.needsMaintenance ? P.maintenance : P.closed }], {});
}

export async function createAlert(input: { type: string; severity: string; message: string; areaId: string | null; sessionId: string | null }): Promise<string | null> {
  const F = AlertsFields;
  const fields: Record<string, any> = {
    [F.alert_type]: input.type,
    [F.severity]: input.severity,
    [F.message]: input.message,
  };
  if (input.areaId) fields[F.area] = input.areaId;
  if (input.sessionId) fields[F.session] = input.sessionId;
  const items = [{ name: `${input.type} — ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, fields }];
  const res = await h().activity.create(WF.alerts, items as any, { phaseId: AlertsPhases.active });
  const arr = Array.isArray(res) ? res : [res];
  const first = arr[0] as any;
  return first?._id ?? null;
}

export async function ackAlert(alertId: string): Promise<void> {
  await h().activity.update([{ _id: alertId, phaseId: AlertsPhases.acknowledged }], {});
}

export async function createAction(input: { name: string; actionType: string; instructionId: string | null; sessionId: string | null; notes: string }): Promise<string | null> {
  const F = MaintenanceactionsFields;
  const fields: Record<string, any> = {
    [F.action_type]: input.actionType,
    [F.notes]: input.notes,
  };
  if (input.instructionId) fields[F.instruction] = input.instructionId;
  if (input.sessionId) fields[F.session] = input.sessionId;
  const items = [{ name: input.name, fields }];
  const res = await h().activity.create(WF.maintenance_actions, items as any, { phaseId: MaintenanceactionsPhases.open });
  const arr = Array.isArray(res) ? res : [res];
  const first = arr[0] as any;
  return first?._id ?? null;
}

export async function completeAction(actionId: string): Promise<void> {
  await h().activity.update([{ _id: actionId, phaseId: MaintenanceactionsPhases.done }], {});
}

/* vaihe-id:t näkymiä varten */
export const PHASE_IDS = {
  alertActive: AlertsPhases.active,
  alertClosed: AlertsPhases.closed,
  actionDone: MaintenanceactionsPhases.done,
  actionClosed: MaintenanceactionsPhases.closed,
};
