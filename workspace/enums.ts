
// Field IDs enum for workflow: 🗺️ Operating Areas
// Use these constants instead of hardcoded IDs in fieldsOrder

export enum Operating_Areas_FieldIds {
  code_6aa = "6b001754156ea9e4043476aa",
  latitude_6ad = "6b001754156ea9e4043476ad",
  longitude_6b0 = "6b001754156ea9e4043476b0",
  radius_km_6b3 = "6b001754156ea9e4043476b3",
  salinity_6b6 = "6b001754156ea9e4043476b6",
  temperature_6ba = "6b001754156ea9e4043476ba",
  turbidity_6bd = "6b001754156ea9e4043476bd",
  algae_risk_6c0 = "6b001754156ea9e4043476c0",
  pollution_6c3 = "6b001754156ea9e4043476c3",
  avg_depth_6c7 = "6b001755156ea9e4043476c7",
  shallow_share_6ca = "6b001755156ea9e4043476ca",
  nearest_farm_distance_6cd = "6b001755156ea9e4043476cd",
  notes_6d1 = "6b001755156ea9e4043476d1",
  suitability_0100_994 = "6b0017b06645d8f4a4908994",
  limiting_factor_997 = "6b0017b06645d8f4a4908997",
}

// Phase IDs enum for workflow: 🗺️ Operating Areas
// Use these constants instead of hardcoded IDs in phasesOrder

export enum Operating_Areas_PhaseIds {
  new_phase_aae = "6b001706b53f6e7cee903aae",
}

// Field IDs enum for workflow: 🚫 Risk Zones
// Use these constants instead of hardcoded IDs in fieldsOrder

export enum Risk_Zones_FieldIds {
  zone_type_721 = "6b001756156ea9e404347721",
  label_724 = "6b001756156ea9e404347724",
  latitude_727 = "6b001756156ea9e404347727",
  longitude_72a = "6b001756156ea9e40434772a",
  radius_72d = "6b001756156ea9e40434772d",
  source_730 = "6b001756156ea9e404347730",
  active_733 = "6b001756156ea9e404347733",
}

// Phase IDs enum for workflow: 🚫 Risk Zones
// Use these constants instead of hardcoded IDs in phasesOrder

export enum Risk_Zones_PhaseIds {
  new_phase_ab4 = "6b001706b53f6e7cee903ab4",
}

// Field IDs enum for workflow: 📘 Maintenance Instructions
// Use these constants instead of hardcoded IDs in fieldsOrder

export enum Maintenance_Instructions_FieldIds {
  action_type_698 = "6b001754156ea9e404347698",
  trigger_69b = "6b001754156ea9e40434769b",
  steps_69e = "6b001754156ea9e40434769e",
  duration_6a1 = "6b001754156ea9e4043476a1",
  chemicals_6a4 = "6b001754156ea9e4043476a4",
  safety_6a7 = "6b001754156ea9e4043476a7",
}

// Phase IDs enum for workflow: 📘 Maintenance Instructions
// Use these constants instead of hardcoded IDs in phasesOrder

export enum Maintenance_Instructions_PhaseIds {
  new_phase_aba = "6b001706b53f6e7cee903aba",
}

// Field IDs enum for workflow: 📟 PLC Tag Map
// Use these constants instead of hardcoded IDs in fieldsOrder

export enum PLC_Tag_Map_FieldIds {
  tag_6d6 = "6b001755156ea9e4043476d6",
  s7_address_6da = "6b001755156ea9e4043476da",
  description_6dd = "6b001755156ea9e4043476dd",
  unit_6e1 = "6b001755156ea9e4043476e1",
  normal_min_6e5 = "6b001755156ea9e4043476e5",
  normal_max_6e8 = "6b001755156ea9e4043476e8",
  alarm_below_6ec = "6b001755156ea9e4043476ec",
  alarm_above_6ef = "6b001755156ea9e4043476ef",
  scale_min_409 = "6b0936efebd3962e6d7e9409",
  scale_max_40c = "6b0936efebd3962e6d7e940c",
}

// Phase IDs enum for workflow: 📟 PLC Tag Map
// Use these constants instead of hardcoded IDs in phasesOrder

export enum PLC_Tag_Map_PhaseIds {
  new_phase_ac0 = "6b001706b53f6e7cee903ac0",
}

// Field IDs enum for workflow: 💧 Production Sessions
// Use these constants instead of hardcoded IDs in fieldsOrder

export enum Production_Sessions_FieldIds {
  area_6f3 = "6b001755156ea9e4043476f3",
  start_latitude_6f6 = "6b001755156ea9e4043476f6",
  start_longitude_6f9 = "6b001755156ea9e4043476f9",
  capacity_6fc = "6b001755156ea9e4043476fc",
  period_6ff = "6b001755156ea9e4043476ff",
  volume_produced_702 = "6b001755156ea9e404347702",
  feed_pressure_705 = "6b001755156ea9e404347705",
  membrane_p_708 = "6b001755156ea9e404347708",
  permeate_conductivity_70b = "6b001755156ea9e40434770b",
  feed_temperature_711 = "6b001756156ea9e404347711",
  notes_71e = "6b001756156ea9e40434771e",
  fouling_risk_0100_99a = "6b0017b06645d8f4a490899a",
  maintenance_recommendation_99d = "6b0017b06645d8f4a490899d",
  ph_measured_3f4 = "6b0053046abce11ce6f913f4",
  naoh_dosed_3f7 = "6b0053046abce11ce6f913f7",
  antiscalant_dosed_3fa = "6b0053046abce11ce6f913fa",
}

// Phase IDs enum for workflow: 💧 Production Sessions
// Use these constants instead of hardcoded IDs in phasesOrder

export enum Production_Sessions_PhaseIds {
  planned_299 = "6b0017284bf48d694dafc299",
  active_2a2 = "6b0017284bf48d694dafc2a2",
  ended_2ab = "6b0017284bf48d694dafc2ab",
  maintenance_2b4 = "6b0017284bf48d694dafc2b4",
  closed_2be = "6b0017284bf48d694dafc2be",
}

// Field IDs enum for workflow: ⚠️ Alerts
// Use these constants instead of hardcoded IDs in fieldsOrder

export enum Alerts_FieldIds {
  alert_type_675 = "6b001753156ea9e404347675",
  severity_678 = "6b001754156ea9e404347678",
  message_67b = "6b001754156ea9e40434767b",
  area_67e = "6b001754156ea9e40434767e",
  session_681 = "6b001754156ea9e404347681",
  acknowledged_by_685 = "6b001754156ea9e404347685",
}

// Phase IDs enum for workflow: ⚠️ Alerts
// Use these constants instead of hardcoded IDs in phasesOrder

export enum Alerts_PhaseIds {
  active_25a = "6b0017274bf48d694dafc25a",
  acknowledged_264 = "6b0017274bf48d694dafc264",
  closed_26d = "6b0017274bf48d694dafc26d",
}

// Field IDs enum for workflow: 🔧 Maintenance Actions
// Use these constants instead of hardcoded IDs in fieldsOrder

export enum Maintenance_Actions_FieldIds {
  action_type_688 = "6b001754156ea9e404347688",
  instruction_68b = "6b001754156ea9e40434768b",
  session_68e = "6b001754156ea9e40434768e",
  performed_by_691 = "6b001754156ea9e404347691",
  notes_694 = "6b001754156ea9e404347694",
}

// Phase IDs enum for workflow: 🔧 Maintenance Actions
// Use these constants instead of hardcoded IDs in phasesOrder

export enum Maintenance_Actions_PhaseIds {
  open_27a = "6b0017274bf48d694dafc27a",
  done_283 = "6b0017284bf48d694dafc283",
  closed_28c = "6b0017284bf48d694dafc28c",
}

// Workflow IDs enum - single source of truth for all workflow IDs
// This file is auto-generated by 'hailer-sdk ws-config pull'

export enum WorkflowIds {
  operating_areas_aaf = "6b001706b53f6e7cee903aaf",
  risk_zones_ab5 = "6b001706b53f6e7cee903ab5",
  maintenance_instructions_abb = "6b001706b53f6e7cee903abb",
  plc_tag_map_ac1 = "6b001706b53f6e7cee903ac1",
  production_sessions_ac7 = "6b001706b53f6e7cee903ac7",
  alerts_acd = "6b001706b53f6e7cee903acd",
  maintenance_actions_ad3 = "6b001706b53f6e7cee903ad3",
}

// Workspace Members enum - maps user IDs to their names
// This file is auto-generated by 'hailer-sdk ws-config pull'

export enum WorkspaceMembers {
  petri_vnsk_3b1 = "5d8dc07f1bedbb154b3473b1",
  nico_larsen_74e = "5579d000a9bbb6895dbcc74e",
  robert_broman_506 = "68a2bea86cc0abe93f8a3506",
}

// Workspace Teams enum - maps team IDs to their names
// This file is auto-generated by 'hailer-sdk ws-config pull'

export enum WorkspaceTeams {
  default_team_757 = "6afd55f96c73bd7568e76757",
}

// Workspace Groups enum - maps group IDs to their names
// This file is auto-generated by 'hailer-sdk ws-config pull'

export enum WorkspaceGroups {
}

// Hailer Members enum - all member types in Hailer ID format
// Format: 'user_{uid}', 'team_{tid}', 'group_{gid}', or 'network_{cid}'
// This file is auto-generated by 'hailer-sdk ws-config pull'

export enum HailerMembers {
  workspace = "network_6afd55f96c73bd7568e76753",

  // Users
  petri_vnsk_3b1 = "user_5d8dc07f1bedbb154b3473b1",
  nico_larsen_74e = "user_5579d000a9bbb6895dbcc74e",
  robert_broman_506 = "user_68a2bea86cc0abe93f8a3506",

  // Teams
  default_team_757 = "team_6afd55f96c73bd7568e76757",

  // Groups
}

// Workspace Credentials Vault enum - maps credential IDs to their names (no secrets are pulled)
// This file is auto-generated by 'hailer-sdk ws-config pull'

export enum WorkspaceCredentialIds {
}
