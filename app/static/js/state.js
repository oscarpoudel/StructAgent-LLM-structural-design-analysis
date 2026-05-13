export const S = {
  project: null,
  nodes: [],
  members: [],
  slabs: [],
  loads: [],
  memberLoads: [],
  nextNodeId: 1,
  nextMemberId: 1,
  nextSlabId: 1,
  tool: 'select',
  selected: null,
  memberStart: null,
  slabCorners: [],
  results: null,
  dragging: false,
  dragStart: null,
  dragNode: null,
  _lastExport: null,
};

export const NODE_R = 7;
export const SNAP_R = 15;

export function resetModel() {
  S.nodes = [];
  S.members = [];
  S.slabs = [];
  S.loads = [];
  S.memberLoads = [];
  S.nextNodeId = 1;
  S.nextMemberId = 1;
  S.nextSlabId = 1;
  S.selected = null;
  S.results = null;
  S.memberStart = null;
  S._lastExport = null;
}
