const DB_NAME = 'StructAgentDB';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';
const FALLBACK_KEY = 'StructAgentProjects';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
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

function getFallbackProjects() {
  try {
    return JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
  } catch (error) {
    console.warn('[StructAgent] Failed to read project fallback store:', error);
    return [];
  }
}

function setFallbackProjects(projects) {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(projects));
}

async function serverJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || data.status === 'error') {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }
  return data;
}

async function getAllProjectsLocal() {
  try {
    const store = await tx('readonly');
    return await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[StructAgent] Using localStorage project fallback:', error);
    return getFallbackProjects().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
}

async function getProjectLocal(id) {
  try {
    const store = await tx('readonly');
    return await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[StructAgent] Using localStorage project fallback:', error);
    return getFallbackProjects().find(project => project.id === id) || null;
  }
}

async function saveProjectLocal(project) {
  try {
    const store = await tx('readwrite');
    return await new Promise((resolve, reject) => {
      const req = store.put(project);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[StructAgent] Using localStorage project fallback:', error);
    const projects = getFallbackProjects().filter(item => item.id !== project.id);
    projects.push(project);
    setFallbackProjects(projects);
    return project.id;
  }
}

async function deleteProjectLocal(id) {
  try {
    const store = await tx('readwrite');
    return await new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[StructAgent] Using localStorage project fallback:', error);
    setFallbackProjects(getFallbackProjects().filter(project => project.id !== id));
  }
}

function newerProject(first, second) {
  return (first?.updatedAt || 0) >= (second?.updatedAt || 0) ? first : second;
}

async function saveProjectServer(project) {
  await serverJson(`/api/projects/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return project.id;
}

async function mergeLocalProjectsIntoServer(serverProjects) {
  const localProjects = await getAllProjectsLocal();
  if (!localProjects.length) return serverProjects;

  const merged = new Map();
  serverProjects.forEach(project => merged.set(project.id, project));

  for (const localProject of localProjects) {
    const serverProject = merged.get(localProject.id);
    const winningProject = newerProject(localProject, serverProject);
    merged.set(localProject.id, winningProject);

    if (!serverProject || winningProject === localProject) {
      try {
        await saveProjectServer(localProject);
      } catch (error) {
        console.warn('[StructAgent] Failed to migrate local project to server:', error);
      }
    }
  }

  return [...merged.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getAllProjects() {
  try {
    const data = await serverJson('/api/projects');
    return mergeLocalProjectsIntoServer(data.projects || []);
  } catch (error) {
    console.warn('[StructAgent] Using browser project fallback:', error);
    return getAllProjectsLocal();
  }
}

export async function getProject(id) {
  try {
    const data = await serverJson(`/api/projects/${encodeURIComponent(id)}`);
    return data.project || null;
  } catch (error) {
    console.warn('[StructAgent] Using browser project fallback:', error);
    const localProject = await getProjectLocal(id);
    if (localProject) {
      try {
        await saveProjectServer(localProject);
      } catch (saveError) {
        console.warn('[StructAgent] Failed to migrate local project to server:', saveError);
      }
    }
    return localProject;
  }
}

export async function saveProject(project) {
  project.updatedAt = Date.now();
  try {
    await saveProjectServer(project);
    await saveProjectLocal(project);
    return project.id;
  } catch (error) {
    console.warn('[StructAgent] Using browser project fallback:', error);
    return saveProjectLocal(project);
  }
}

export async function deleteProject(id) {
  try {
    await serverJson(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await deleteProjectLocal(id);
  } catch (error) {
    console.warn('[StructAgent] Using browser project fallback:', error);
    await deleteProjectLocal(id);
  }
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
    slabs: data.slabs || [],
    loadCombinations: data.loadCombinations || [],
    activeLoadCombination: data.activeLoadCombination || '1.0D + 1.0L',
    rigidDiaphragms: data.rigidDiaphragms !== undefined ? data.rigidDiaphragms : true,
    nextNodeId: data.nextNodeId || 1,
    nextMemberId: data.nextMemberId || 1,
    nextSlabId: data.nextSlabId || 1,
    analysisType: data.analysisType || '3d_frame',
  };
}
