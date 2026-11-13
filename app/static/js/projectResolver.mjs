/** Choose a saved record without allowing stale generic names to overwrite a user-entered project name. */

const GENERIC = /^(?:new|untitled)\s+project$/i;

export function hasDescriptiveName(project) {
  const name = String(project?.name ?? '').trim();
  return name.length >= 2 && !GENERIC.test(name);
}

export function selectProjectVersion(localProject, serverProject) {
  if (!localProject) return serverProject || null;
  if (!serverProject) return localProject;
  const localNamed = hasDescriptiveName(localProject);
  const serverNamed = hasDescriptiveName(serverProject);
  // After an upgrade, an older offline placeholder can have a newer timestamp
  // than a meaningful server name. Favor actual human-entered project names.
  if (localNamed && !serverNamed) return localProject;
  if (serverNamed && !localNamed) return serverProject;
  const localTime = Number(localProject.updatedAt) || 0;
  const serverTime = Number(serverProject.updatedAt) || 0;
  return localTime > serverTime ? localProject : serverProject;
}
