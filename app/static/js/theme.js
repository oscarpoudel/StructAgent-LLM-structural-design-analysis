import { byId } from './dom.js';

const PALETTES = new Set(['ocean', 'teal', 'violet', 'copper']);

function setTheme(isDark) {
  const themeIco = byId('themeIco');
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeIco.textContent = isDark ? '\u2600' : '\u263E';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function setPalette(value) {
  const palette = PALETTES.has(value) ? value : 'ocean';
  document.documentElement.setAttribute('data-accent', palette);
  localStorage.setItem('accentPalette', palette);
  const selector = byId('accentPalette');
  if (selector) selector.value = palette;
}

export function initTheme() {
  const themeBtn = byId('themeBtn');
  themeBtn.addEventListener('click', () => {
    setTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
  });
  setTheme(localStorage.getItem('theme') === 'dark');
  setPalette(localStorage.getItem('accentPalette') || 'ocean');
  const selector = byId('accentPalette');
  if (selector) selector.addEventListener('change', () => setPalette(selector.value));
}
