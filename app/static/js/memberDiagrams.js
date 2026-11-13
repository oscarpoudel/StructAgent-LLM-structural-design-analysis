import { byId } from './dom.js';
import { S } from './state.js';
import { triggerRedraw } from './canvas3d/scene.js';

const COMPONENTS = [
  ['N', 'Axial force N', 'kN', '#1b7f79'],
  ['Vy', 'Local shear Vy', 'kN', '#2563eb'],
  ['Vz', 'Local shear Vz', 'kN', '#7c3aed'],
  ['My', 'Local bending My', 'kN-m', '#dc6b21'],
  ['Mz', 'Local bending Mz', 'kN-m', '#d14360'],
  ['T', 'Local torsion T', 'kN-m', '#64748b'],
];

function getComboResults() {
  const selected = byId('diagramCombination')?.value;
  return S.results?.combination_results?.[selected] || S.results;
}

function getSelectedDiagram() {
  const id = byId('diagramMember')?.value;
  const result = getComboResults();
  return result?.member_force_diagrams?.[id] || null;
}

function fillOptions(select, values, selected) {
  select.replaceChildren();
  for (const [value, label] of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  if (values.some(([value]) => value === selected)) select.value = selected;
}

function refreshMembers(preferredMember = null) {
  const result = getComboResults();
  const ids = Object.keys(result?.member_force_diagrams || {})
    .sort((a, b) => Number(a) - Number(b));
  const selected = preferredMember || byId('diagramMember').value;
  fillOptions(byId('diagramMember'), ids.map(id => [id, `Frame ${id}`]), selected);
  renderDiagrams();
}

function openMemberDiagrams() {
  const modal = byId('modal-member-diagrams');
  modal.classList.remove('hidden');
  const active = S.results?.load_combination || '';
  const results = S.results?.combination_results;
  const combos = results
    ? Object.keys(results).map(name => [name, name])
    : S.results ? [[active || 'Current', active || 'Current']] : [];
  fillOptions(byId('diagramCombination'), combos, active);
  refreshMembers(S.selected?.type === 'member' ? String(S.selected.id) : null);
}

function closeMemberDiagrams() {
  const modal = byId('modal-member-diagrams');
  modal.classList.add('hidden');
  // Plotly may keep event listeners unless explicitly purged.
  if (window.Plotly) {
    modal.querySelectorAll('.member-diagram-chart').forEach(plot => window.Plotly.purge(plot));
  }
}

function formatForce(value) {
  return Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 }) : 'n/a';
}

function renderDiagrams() {
  const plotGrid = byId('memberDiagramPlots');
  const note = byId('memberDiagramNotes');
  if (window.Plotly) {
    plotGrid.querySelectorAll('.member-diagram-chart').forEach(plot => window.Plotly.purge(plot));
  }
  plotGrid.replaceChildren();
  const diagram = getSelectedDiagram();
  if (!diagram || !Array.isArray(diagram.station_m)) {
    note.textContent = 'Run a new OpenSees 3D frame analysis to view local member-force diagrams. The previous analysis may lack local-force station data.';
    return;
  }
  const combo = byId('diagramCombination').value;
  const member = byId('diagramMember').value;
  const residuals = Object.values(diagram.end_equilibrium_residuals || {});
  const residual = Math.max(0, ...residuals.map(Math.abs));
  note.textContent = `Combination: ${combo}. Member: ${member}. Length: ${formatForce(diagram.station_m.at(-1))} m. ` +
    `Maximum local end-equilibrium residual: ${formatForce(residual)} in component units. ` +
    'Section resultants use the I-to-J local member coordinates. Reanalyze the structure after editing members, loads or combinations.';

  const selected = byId('diagramComponent').value;
  const items = selected === 'all'
    ? COMPONENTS : COMPONENTS.filter(item => item[0] === selected);
  plotGrid.classList.toggle('single', items.length === 1);

  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  for (const [key, title, unit, color] of items) {
    const series = diagram.components?.[key];
    if (!Array.isArray(series) || series.length !== diagram.station_m.length) continue;
    const card = document.createElement('section');
    card.className = 'member-diagram-card';
    const heading = document.createElement('h3');
    heading.textContent = title + ` (${unit})`;
    const chart = document.createElement('div');
    chart.className = 'member-diagram-chart';
    const extent = document.createElement('p');
    extent.className = 'member-diagram-extents';
    extent.textContent = `Start: ${formatForce(series[0])} ${unit}; end: ${formatForce(series.at(-1))} ${unit}; ` +
      `minimum: ${formatForce(diagram.ranges?.[key]?.min)} ${unit}; maximum: ${formatForce(diagram.ranges?.[key]?.max)} ${unit}.`;
    card.append(heading, chart, extent);
    plotGrid.appendChild(card);

    if (window.Plotly) {
      requestAnimationFrame(() => {
        if (!chart.isConnected) return;
        const background = dark ? '#1c222c' : '#ffffff';
        const textColor = dark ? '#d9e3ee' : '#334155';
        window.Plotly.newPlot(chart, [{
          x: diagram.station_m, y: series, mode: 'lines', type: 'scatter',
          line: { color, width: 2.4 }, fill: 'tozeroy', fillcolor: color + '18',
          hovertemplate: `Station %{x:.2f} m<br>${key}: %{y:.3f} ${unit}<extra></extra>`,
        }], {
          margin: { l: 62, r: 18, t: 12, b: 48 },
          paper_bgcolor: background, plot_bgcolor: background,
          font: { color: textColor, family: 'Inter, sans-serif', size: 11 },
          showlegend: false,
          xaxis: { title: 'Along member I to J (m)', zeroline: true, automargin: true },
          yaxis: { title: `${key} (${unit})`, zeroline: true, automargin: true },
        }, { responsive: true, displaylogo: false, scrollZoom: false });
      });
    } else {
      chart.textContent = 'Plotly is not available. Numeric diagram values can still be exported as CSV.';
    }
  }
}

function exportDiagramCsv() {
  const diagram = getSelectedDiagram();
  if (!diagram) return;
  const keys = COMPONENTS.map(entry => entry[0]);
  const rows = [['station_m', ...keys].join(',')];
  for (let i = 0; i < diagram.station_m.length; i++) {
    rows.push([diagram.station_m[i], ...keys.map(key => diagram.components[key][i])].join(','));
  }
  const blob = new Blob([rows.join('\n') + '\n'], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `structagent-member-${byId('diagramMember').value}-local-forces.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function initMemberDiagrams() {
  ['memberDiagramsBtn', 'memberDiagramsResultsBtn'].forEach(id => {
    byId(id)?.addEventListener('click', openMemberDiagrams);
  });
  byId('memberDiagramClose')?.addEventListener('click', closeMemberDiagrams);
  byId('modal-member-diagrams')?.addEventListener('click', event => {
    if (event.target === byId('modal-member-diagrams')) closeMemberDiagrams();
  });
  ['diagramCombination', 'diagramMember', 'diagramComponent'].forEach(id => {
    byId(id)?.addEventListener('change',
      id === 'diagramCombination' ? refreshMembers : renderDiagrams);
  });
  byId('diagramCsvBtn')?.addEventListener('click', exportDiagramCsv);
  byId('forceComponentSelect')?.addEventListener('change', () => {
    const overlay = byId('showForces');
    if (overlay) overlay.checked = true;
    triggerRedraw();
  });
  byId('resultsPanelToggleBtn')?.addEventListener('click', () => {
    const pane = byId('tab-draw');
    const collapsed = pane.classList.toggle('results-collapsed');
    byId('resultsPanelToggleBtn').textContent = collapsed ? 'Show Results' : 'Expand Canvas';
    byId('resultsPanelToggleBtn').setAttribute('aria-pressed', String(collapsed));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });
  byId('closeResultsPanelBtn')?.addEventListener('click', () => byId('resultsPanelToggleBtn').click());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !byId('modal-member-diagrams').classList.contains('hidden')) {
      closeMemberDiagrams();
    }
  });
}
