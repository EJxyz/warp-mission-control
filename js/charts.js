// Deck charts (Intensity Over Time, Pulse Impact) + shared axis styling.
// Chart is loaded globally from the Chart.js CDN script.

import { storms, pulses } from './data.js';
import { refs } from './state.js';

// Shared axis styling for workspace charts.
export const AXIS = { ticks: { color: '#d8eaf2' }, grid: { color: 'rgba(255,255,255,.10)' } };

export function initCharts() {
  const labels = ['-60', '-45', '-30', '-15', 'Now'];
  refs.intensityChart = new Chart(document.getElementById('intensityChart'), {
    type: 'line',
    data: {
      labels,
      datasets: storms.map((s, i) => ({
        label: s.id,
        data: labels.map((_, j) => Math.max(.05, s.intensity - (4 - j) * .045 + Math.sin(i + j) * .02)),
        borderColor: s.color, backgroundColor: s.color, pointRadius: 0, tension: .34, borderWidth: 2
      }))
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
    data: { labels: pulses.map(p => p.id), datasets: [{ data: pulses.map(p => p.impact), backgroundColor: 'rgba(255,214,74,.72)', borderColor: '#ffd64a', borderWidth: 1 }] },
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
