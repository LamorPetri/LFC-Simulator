// Phases for workflow: 📟 PLC Tag Map
      
import { PLC_Tag_Map_FieldIds, PLC_Tag_Map_PhaseIds } from "../enums";
      
export const phases: HailerPhaseUpdatePayload[] = [
  {
    _id: PLC_Tag_Map_PhaseIds.new_phase_ac0,
    announcementFields: [],
    announcementFieldsOrder: [],
    announcementRecipients: [],
    description: "",
    fields: [
      PLC_Tag_Map_FieldIds.tag_6d6,
      PLC_Tag_Map_FieldIds.s7_address_6da,
      PLC_Tag_Map_FieldIds.description_6dd,
      PLC_Tag_Map_FieldIds.unit_6e1,
      PLC_Tag_Map_FieldIds.normal_min_6e5,
      PLC_Tag_Map_FieldIds.normal_max_6e8,
      PLC_Tag_Map_FieldIds.alarm_below_6ec,
      PLC_Tag_Map_FieldIds.alarm_above_6ef,
      PLC_Tag_Map_FieldIds.scale_min_409,
      PLC_Tag_Map_FieldIds.scale_max_40c
    ],
    followers: [],
    isEndpoint: false,
    key: "newPhase",
    name: "New Phase",
    possibleNextPhase: [],
    possibleNextPhaseSettings: {}
  }
];