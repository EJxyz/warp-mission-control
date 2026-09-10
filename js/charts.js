// Deck charts (Intensity Over Time, Pulse Impact) + shared axis styling.
// Chart is loaded globally from the Chart.js CDN script.

import { appData, refs } from './state.js';

// Shared axis styling for workspace charts.
export const AXIS = { ticks: { color: '#d8eaf2' }, grid: { color: 'rgba(255,255,255,.10)' } };

export function initCharts() {
  const storms = appData.storms, emps = appData.emps;
  const labels = ['-60', '-45', '-30', '-15', 'Now'];
  refs.intensityChart = new Chart(document.getElementById('intensityChart'), {
    type: 'line',
    data: {
      labels,
      datasets: storms.map((s, i) => {
        const base = s.intensity !== undefined ? s.intensity : .3;
        return {
          label: s.id,
          data: labels.map((_, j) => Math.max(.05, base - (4 - j) * .045 + Math.sin(i + j) * .02)),
          borderColor: s.color || '#20bfff', backgroundColor: s.color || '#20bfff', pointRadius: 0, tension: .34, borderWidth: 2
        };
      })
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#eaf8ff', boxWidth: 20, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#d8eaf2' }, grid: { color: 'rgba(255,255,255,.08)' } },
        y: { min: 0, max: 1, ticks: { color: '#d8eaf2' }, grid: { color: 'rgba(255,255,255,.13)' } }
      }
    }
  });

  refs.pulseChart = new Chart(document.getElementById('pulseChart'), {
    type: 'bar',
    data: { labels: emps.map(p => p.id), datasets: [{ data: emps.map(p => p.impact), backgroundColor: 'rgba(255,214,74,.72)', borderColor: '#ffd64a', borderWidth: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#d8eaf2' }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: '#d8eaf2' }, grid: { color: 'rgba(255,255,255,.13)' } }
      }
    }
  });
}


// Destroy and recreate the deck charts from current appData (used after a
// data-source hot-swap so charts don't show stale data / mismatched ids).
export function rebuildCharts() {
  if (refs.intensityChart) { try { refs.intensityChart.destroy(); } catch (e) { } refs.intensityChart = null; }
  if (refs.pulseChart) { try { refs.pulseChart.destroy(); } catch (e) { } refs.pulseChart = null; }
  initCharts();
}
