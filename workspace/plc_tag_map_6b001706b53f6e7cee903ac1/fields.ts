
import { PLC_Tag_Map_FieldIds } from "../enums";
      
// Fields for workflow: 📟 PLC Tag Map

// Note: Field functions are extracted to ./functions/ directory
      
// They are referenced here as "@function:functionName" strings
      
export const fields: HailerFieldGeneric[] = [
  {
    _id: PLC_Tag_Map_FieldIds.tag_6d6,
    data: [],
    description: "Loop tag, e.g. FT-101",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "tag",
    label: "Tag",
    required: false,
    type: "text"
  },
  {
    _id: PLC_Tag_Map_FieldIds.s7_address_6da,
    data: [],
    description: "Siemens S7 data block address, e.g. DB100.DBD0 (Real)",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "s7_address",
    label: "S7 address",
    required: false,
    type: "text"
  },
  {
    _id: PLC_Tag_Map_FieldIds.description_6dd,
    data: [],
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "description",
    label: "Description",
    required: false,
    type: "text"
  },
  {
    _id: PLC_Tag_Map_FieldIds.unit_6e1,
    data: [],
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "unit",
    label: "Unit",
    required: false,
    type: "text"
  },
  {
    _id: PLC_Tag_Map_FieldIds.normal_min_6e5,
    data: [],
    description: "Green range lower bound",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "normal_min",
    label: "Normal min",
    required: false,
    type: "numeric"
  },
  {
    _id: PLC_Tag_Map_FieldIds.normal_max_6e8,
    data: [],
    description: "Green range upper bound",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "normal_max",
    label: "Normal max",
    required: false,
    type: "numeric"
  },
  {
    _id: PLC_Tag_Map_FieldIds.alarm_below_6ec,
    data: [],
    description: "Red below this value",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "alarm_below",
    label: "Alarm below",
    required: false,
    type: "numeric"
  },
  {
    _id: PLC_Tag_Map_FieldIds.alarm_above_6ef,
    data: [],
    description: "Red above this value",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "alarm_above",
    label: "Alarm above",
    required: false,
    type: "numeric"
  },
  {
    _id: PLC_Tag_Map_FieldIds.scale_min_409,
    data: [],
    description: "Lower end of the measurement bar in the simulator",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "scale_min",
    label: "Scale min",
    required: false,
    type: "numeric"
  },
  {
    _id: PLC_Tag_Map_FieldIds.scale_max_40c,
    data: [],
    description: "Upper end of the measurement bar in the simulator (red band reaches this)",
    functionEnabled: false,
    inviteToDiscussionOnChange: false,
    key: "scale_max",
    label: "Scale max",
    required: false,
    type: "numeric"
  }
];
