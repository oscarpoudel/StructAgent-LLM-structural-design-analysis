import { sendChat } from './api.js';
import { buildCurrentAnalysisPayload, clearCurrentModel, drawSimpleBeam } from './analysis.js';
import { byId } from './dom.js';
import { renderResults } from './results.js';
import { S } from './state.js';

const EXAMPLES = {
  ss: 'Analyze a simply supported steel beam. Span is 6 m, uniform load is 20 kN/m, E is 200 GPa, I is 8e-6 m4. Check deflection against L/360.',
  cant: 'Analyze a cantilever beam with span 4 m, UDL 15 kN/m, E 200 GPa, I 5e-5 m4. Check deflection against L/180.',
  pt: 'Analyze a simply supported beam with span 8 m and a point load of 100 kN at 4 m. E is 200 GPa, I is 3e-5 m4.',
  truss: 'Analyze a 2D truss with span 8 m, height 3 m, and a load of 100 kN at the top node.',
  frame: 'Analyze a portal frame with bay width 6 m, column height 4 m, gravity load 20 kN/m on beam, and lateral load 15 kN.',
  col: 'Check a column for buckling. Length 5 m, pinned-pinned, area 0.008 m2, I 6e-5 m4, E 200 GPa, Fy 345 MPa, axial load 800 kN.',
};

let lastAnalysisPrompt = '';
let lastAnalysisType = '';

export function initChat() {
  initFloatingChat();

  byId('exSel').addEventListener('change', (event) => {
    if (EXAMPLES[event.target.value]) byId('chatInput').value = EXAMPLES[event.target.value];
    event.target.value = '';
  });

  byId('chatForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = byId('chatInput');
    const message = input.value.trim();
    if (!message) return;

    addMsg('user', message);
    input.value = '';
    const pending = addMsg('bot', 'Responding...');

    try {
      const payload = { message, ...buildCurrentAnalysisPayload() };
      const data = await sendChat(payload);
      pending.querySelector('p').textContent = data.message || 'Done.';
      if (data.quick_actions) {
        addQuickActions(pending, data.quick_actions);
      }
      if (data.response_type === 'canvas_action' && data.canvas_action) {
        runCanvasAction(data.canvas_action, pending);
      }
      if (data.response_type === 'analysis' && data.analysis) {
        S.results = data.analysis.results;
        lastAnalysisPrompt = message;
        lastAnalysisType = data.analysis.analysis_type || 'frame';
        renderResults(data.analysis);
        addAnalysisActions(pending);
      }
      if (data.response_type === 'evaluation') {
        addQuickActions(pending, data.quick_actions || []);
      }
    } catch (error) {
      console.error('[StructAgent] Chat error:', error);
      pending.querySelector('p').textContent = 'Error reaching server. Check console for details.';
    }
  });
}

async function handleQuickAction(action, messageEl) {
  if (!S.results) {
    const p = messageEl.querySelector('p');
    p.textContent = 'No analysis results to evaluate. Run an analysis first.';
    return;
  }

  const p = messageEl.querySelector('p');
  p.textContent = 'Thinking...';

  const prompts = {
    evaluate: 'Are these analysis results acceptable? Evaluate against typical engineering criteria including deflection limits, utilization ratios, and code compliance.',
    code_check: 'Check these results against AISC/ASCE/IBC code requirements. What code provisions apply? Are there any code violations or concerns?',
    explain: 'Explain these analysis results in plain language. What do the key numbers mean? What should I pay attention to?',
    load_combos: 'What load combinations should I consider for this structure? Show the controlling combination and explain why.',
    compare_limits: 'Compare the key result values against typical design limits. Show pass/fail for each check with the limit values.',
    reanalyze: 'Re-run the analysis with the current model.',
    export: 'Export the current model.',
  };

  const evalPrompt = prompts[action] || prompts.evaluate;

  try {
    const response = await fetch('/api/chat/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: evalPrompt,
        results: S.results,
        analysis_type: lastAnalysisType,
        prompt: lastAnalysisPrompt,
      }),
    });
    const data = await response.json();
    p.textContent = data.message || 'Unable to evaluate.';
    if (data.quick_actions) {
      addQuickActions(messageEl, data.quick_actions);
    }
  } catch (error) {
    console.error('[StructAgent] Evaluate error:', error);
    p.textContent = 'Error evaluating results: ' + error.message;
  }
}

function addQuickActions(container, actions) {
  const bar = document.createElement('div');
  bar.className = 'chat-actions';
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.className = 'chat-action-btn';
    btn.textContent = a.label;
    btn.addEventListener('click', () => handleQuickAction(a.action, container));
    bar.appendChild(btn);
  });
  container.appendChild(bar);
}

function addAnalysisActions(container) {
  const bar = document.createElement('div');
  bar.className = 'chat-actions';
  const actions = [
    { label: 'Evaluate', action: 'evaluate' },
    { label: 'Code Check', action: 'code_check' },
    { label: 'Explain', action: 'explain' },
    { label: 'Load Combos', action: 'load_combos' },
    { label: 'Limits', action: 'compare_limits' },
  ];
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.className = 'chat-action-btn';
    btn.textContent = a.label;
    btn.addEventListener('click', () => handleQuickAction(a.action, container));
    bar.appendChild(btn);
  });
  container.appendChild(bar);
}

function runCanvasAction(canvasAction, pendingMessage) {
  if (canvasAction.action === 'clear_canvas') {
    clearCurrentModel();
    pendingMessage.querySelector('p').textContent = 'Canvas cleared.';
  } else if (canvasAction.action === 'draw_simple_beam') {
    drawSimpleBeam(canvasAction.arguments);
    const span = Number(canvasAction.arguments?.span_m) || 2;
    pendingMessage.querySelector('p').textContent = `I drew a ${span.toFixed(2).replace(/\.?0+$/, '')} m simply supported beam on the canvas.`;
  }
}

export function setChatPrompt(prompt) {
  byId('chatInput').value = prompt || '';
  byId('floatingChat').classList.remove('hidden');
}

function initFloatingChat() {
  const chat = byId('floatingChat');
  const handle = byId('floatingChatHandle');
  let drag = null;

  handle.addEventListener('mousedown', (event) => {
    drag = {
      x: event.clientX,
      y: event.clientY,
      left: chat.offsetLeft,
      top: chat.offsetTop,
    };
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event) => {
    if (!drag) return;
    const parent = chat.parentElement.getBoundingClientRect();
    const maxLeft = Math.max(0, parent.width - chat.offsetWidth - 8);
    const maxTop = Math.max(0, parent.height - chat.offsetHeight - 8);
    const nextLeft = Math.max(8, Math.min(maxLeft, drag.left + event.clientX - drag.x));
    const nextTop = Math.max(8, Math.min(maxTop, drag.top + event.clientY - drag.y));
    chat.style.left = `${nextLeft}px`;
    chat.style.top = `${nextTop}px`;
  });

  window.addEventListener('mouseup', () => {
    drag = null;
  });
}

function addMsg(role, text) {
  const messages = byId('messages');
  const article = document.createElement('article');
  article.className = `msg msg-${role === 'user' ? 'user' : 'bot'}`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  article.appendChild(paragraph);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}
