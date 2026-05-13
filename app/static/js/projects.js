const DB_NAME = 'StructAgentDB';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(storeMode) {
  return openDB().then(db => db.transaction(PROJECT_STORE, storeMode).objectStore(PROJECT_STORE));
}

export async function getAllProjects() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getProject(id) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(project) {
  project.updatedAt = Date.now();
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(project);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function createProject(data) {
  return {
    id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: data.name || 'Untitled Project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    levels: data.levels || [],
    gridLinesX: data.gridLinesX || [],
    gridLinesY: data.gridLinesY || [],
    nodes: data.nodes || [],
    members: data.members || [],
    loads: data.loads || [],
    memberLoads: data.memberLoads || [],
    nextNodeId: data.nextNodeId || 1,
    nextMemberId: data.nextMemberId || 1,
    analysisType: data.analysisType || '3d_frame',
  };
}
