/** GENEROITU workspace/enums.ts:stä — älä muokkaa käsin. Aja: node scripts/gen-ids.cjs */

export const WF = {
  operating_areas: '6b001706b53f6e7cee903aaf',
  risk_zones: '6b001706b53f6e7cee903ab5',
  maintenance_instructions: '6b001706b53f6e7cee903abb',
  plc_tag_map: '6b001706b53f6e7cee903ac1',
  production_sessions: '6b001706b53f6e7cee903ac7',
  alerts: '6b001706b53f6e7cee903acd',
  maintenance_actions: '6b001706b53f6e7cee903ad3',
} as const;

export const OperatingareasFields = {
  code: '6b001754156ea9e4043476aa',
  latitude: '6b001754156ea9e4043476ad',
  longitude: '6b001754156ea9e4043476b0',
  radius_km: '6b001754156ea9e4043476b3',
  salinity: '6b001754156ea9e4043476b6',
  temperature: '6b001754156ea9e4043476ba',
  turbidity: '6b001754156ea9e4043476bd',
  algae_risk: '6b001754156ea9e4043476c0',
  pollution: '6b001754156ea9e4043476c3',
  avg_depth: '6b001755156ea9e4043476c7',
  shallow_share: '6b001755156ea9e4043476ca',
  nearest_farm_distance: '6b001755156ea9e4043476cd',
  notes: '6b001755156ea9e4043476d1',
  suitability_0100: '6b0017b06645d8f4a4908994',
  limiting_factor: '6b0017b06645d8f4a4908997',
} as const;

export const OperatingareasPhases = {
  new_phase: '6b001706b53f6e7cee903aae',
} as const;

export const RiskzonesFields = {
  zone_type: '6b001756156ea9e404347721',
  label: '6b001756156ea9e404347724',
  latitude: '6b001756156ea9e404347727',
  longitude: '6b001756156ea9e40434772a',
  radius: '6b001756156ea9e40434772d',
  source: '6b001756156ea9e404347730',
  active: '6b001756156ea9e404347733',
} as const;

export const RiskzonesPhases = {
  new_phase: '6b001706b53f6e7cee903ab4',
} as const;

export const MaintenanceinstructionsFields = {
  action_type: '6b001754156ea9e404347698',
  trigger: '6b001754156ea9e40434769b',
  steps: '6b001754156ea9e40434769e',
  duration: '6b001754156ea9e4043476a1',
  chemicals: '6b001754156ea9e4043476a4',
  safety: '6b001754156ea9e4043476a7',
} as const;

export const MaintenanceinstructionsPhases = {
  new_phase: '6b001706b53f6e7cee903aba',
} as const;

export const PlctagmapFields = {
  tag: '6b001755156ea9e4043476d6',
  s7_address: '6b001755156ea9e4043476da',
  description: '6b001755156ea9e4043476dd',
  unit: '6b001755156ea9e4043476e1',
  normal_min: '6b001755156ea9e4043476e5',
  normal_max: '6b001755156ea9e4043476e8',
  alarm_below: '6b001755156ea9e4043476ec',
  alarm_above: '6b001755156ea9e4043476ef',
  scale_min: '6b0936efebd3962e6d7e9409',
  scale_max: '6b0936efebd3962e6d7e940c',
} as const;

export const PlctagmapPhases = {
  new_phase: '6b001706b53f6e7cee903ac0',
} as const;

export const ProductionsessionsFields = {
  area: '6b001755156ea9e4043476f3',
  start_latitude: '6b001755156ea9e4043476f6',
  start_longitude: '6b001755156ea9e4043476f9',
  capacity: '6b001755156ea9e4043476fc',
  period: '6b001755156ea9e4043476ff',
  volume_produced: '6b001755156ea9e404347702',
  feed_pressure: '6b001755156ea9e404347705',
  membrane_p: '6b001755156ea9e404347708',
  permeate_conductivity: '6b001755156ea9e40434770b',
  feed_temperature: '6b001756156ea9e404347711',
  notes: '6b001756156ea9e40434771e',
  fouling_risk_0100: '6b0017b06645d8f4a490899a',
  maintenance_recommendation: '6b0017b06645d8f4a490899d',
  ph_measured: '6b0053046abce11ce6f913f4',
  naoh_dosed: '6b0053046abce11ce6f913f7',
  antiscalant_dosed: '6b0053046abce11ce6f913fa',
} as const;

export const ProductionsessionsPhases = {
  planned: '6b0017284bf48d694dafc299',
  active: '6b0017284bf48d694dafc2a2',
  ended: '6b0017284bf48d694dafc2ab',
  maintenance: '6b0017284bf48d694dafc2b4',
  closed: '6b0017284bf48d694dafc2be',
} as const;

export const AlertsFields = {
  alert_type: '6b001753156ea9e404347675',
  severity: '6b001754156ea9e404347678',
  message: '6b001754156ea9e40434767b',
  area: '6b001754156ea9e40434767e',
  session: '6b001754156ea9e404347681',
  acknowledged_by: '6b001754156ea9e404347685',
} as const;

export const AlertsPhases = {
  active: '6b0017274bf48d694dafc25a',
  acknowledged: '6b0017274bf48d694dafc264',
  closed: '6b0017274bf48d694dafc26d',
} as const;

export const MaintenanceactionsFields = {
  action_type: '6b001754156ea9e404347688',
  instruction: '6b001754156ea9e40434768b',
  session: '6b001754156ea9e40434768e',
  performed_by: '6b001754156ea9e404347691',
  notes: '6b001754156ea9e404347694',
} as const;

export const MaintenanceactionsPhases = {
  open: '6b0017274bf48d694dafc27a',
  done: '6b0017284bf48d694dafc283',
  closed: '6b0017284bf48d694dafc28c',
} as const;

