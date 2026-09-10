// Accessible modal dialog: show/close, focus management, Escape + Tab focus trap.

let modalReturnFocus = null;

export function closeModal() {
  const m = document.getElementById('modal');
  m.classList.remove('show');
  m.setAttribute('aria-hidden', 'true');
  if (modalReturnFocus && modalReturnFocus.focus) { modalReturnFocus.focus(); }
  modalReturnFocus = null;
}

export function isModalOpen() {
  return document.getElementById('modal').classList.contains('show');
}

export function showModal(title, html, x = 520, y = 120) {
  const m = document.getElementById('modal');
  modalReturnFocus = document.activeElement;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  m.style.left = x + 'px';
  m.style.top = y + 'px';
  m.classList.add('show');
  m.setAttribute('aria-hidden', 'false');
  document.getElementById('modalClose').focus();
}

// Wire close button + global keydown handling (Escape to close, Tab trap).
export function initModal() {
  document.getElementById('modalClose').onclick = closeModal;
  document.addEventListener('keydown', e => {
    const m = document.getElementById('modal');
    if (!m.classList.contains('show')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {
      const f = m.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
