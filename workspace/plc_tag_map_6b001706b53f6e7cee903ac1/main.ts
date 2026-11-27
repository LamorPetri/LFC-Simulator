// Configuration for workflow: 📟 PLC Tag Map
      
import { HailerMembers, PLC_Tag_Map_FieldIds, PLC_Tag_Map_PhaseIds, WorkflowIds, WorkspaceTeams } from "../enums";
      
export const workflowConfig: HailerWorkflowUpdatePayload = {
  _id: WorkflowIds.plc_tag_map_ac1,
  allowGuests: true,
  color: "#8A45A1",
  coverImage: "6b0019501077f5937f0b6f3c",
  defaultView: "table",
  discussionPermissions: [
    "discussion.message.add",
    "discussion.message.add.attachment",
    "discussion.message.remove.own",
    "discussion.read.history"
  ],
  enableAddedField: false,
  enableAttachments: true,
  enableGuestEditing: true,
  enableLinkedAnnouncements: true,
  enableMapLocation: false,
  enableMessenger: false,
  enableModifiedField: false,
  enablePreselectedTeam: true,
  enableUniqueName: false,
  enableUnlinkedMode: true,
  fieldsOrder: [
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
  inviteActivityCreator: true,
  key: "plcTagMap",
  members: [
    {
      id: HailerMembers.petri_vnsk_3b1,
      info: {},
      permissions: [
        "admin"
      ]
    },
    {
      id: HailerMembers.workspace,
      info: {},
      permissions: [
        "any"
      ]
    }
  ],
  name: "📟 PLC Tag Map",
  nameFieldPlaceHolderText: "Give a title",
  order: 3,
  phasesOrder: [
    PLC_Tag_Map_PhaseIds.new_phase_ac0
  ],
  preselectedTeam: {
    account: "6afd55f96c73bd7568e7675b",
    team: WorkspaceTeams.default_team_757
  },
  translations: {
    en: {
      fields: {
        [PLC_Tag_Map_FieldIds.tag_6d6]: {
          description: "Loop tag, e.g. FT-101",
          label: "Tag"
        },
        [PLC_Tag_Map_FieldIds.s7_address_6da]: {
          description: "Siemens S7 data block address, e.g. DB100.DBD0 (Real)",
          label: "S7 address"
        },
        [PLC_Tag_Map_FieldIds.description_6dd]: {
          label: "Description"
        },
        [PLC_Tag_Map_FieldIds.unit_6e1]: {
          label: "Unit"
        },
        [PLC_Tag_Map_FieldIds.normal_min_6e5]: {
          description: "Green range lower bound",
          label: "Normal min"
        },
        [PLC_Tag_Map_FieldIds.normal_max_6e8]: {
          description: "Green range upper bound",
          label: "Normal max"
        },
        [PLC_Tag_Map_FieldIds.alarm_below_6ec]: {
          description: "Red below this value",
          label: "Alarm below"
        },
        [PLC_Tag_Map_FieldIds.alarm_above_6ef]: {
          description: "Red above this value",
          label: "Alarm above"
        },
        [PLC_Tag_Map_FieldIds.scale_min_409]: {
          description: "Lower end of the measurement bar in the simulator",
          label: "Scale min"
        },
        [PLC_Tag_Map_FieldIds.scale_max_40c]: {
          description: "Upper end of the measurement bar in the simulator (red band reaches this)",
          label: "Scale max"
        }
      },
      name: "📟 PLC Tag Map",
      nameFieldPlaceHolderText: "Give a title",
      phases: {
        [PLC_Tag_Map_PhaseIds.new_phase_ac0]: {
          description: "",
          name: "New Phase",
          possibleNextPhaseSettings: {}
        }
      }
    }
  }
};
      