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
  rigidDiaphragms: true,
  activeLoadCombination: '1.0D + 1.0L',
  loadCombinations: [
    { name: '1.0D + 1.0L', factors: { D: 1.0, L: 1.0 } },
    { name: '1.2D + 1.6L', factors: { D: 1.2, L: 1.6 } },
    { name: '1.2D + 1.0EX + 0.5L', factors: { D: 1.2, EX: 1.0, L: 0.5 } },
    { name: '1.2D + 1.0EY + 0.5L', factors: { D: 1.2, EY: 1.0, L: 0.5 } },
  ],
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
  S.rigidDiaphragms = true;
  S.activeLoadCombination = '1.0D + 1.0L';
  S._lastExport = null;
}
