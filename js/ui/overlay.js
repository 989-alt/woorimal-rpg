// 겹침 창 공통: 초점 가두기, Esc로 닫기, 닫으면 초점 돌려주기.
const FOCUSABLE = 'button, [tabindex]:not([tabindex="-1"])';

export function mountOverlay(root, el, { label, onClose }) {
  const opener = document.activeElement;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', label);
  root.appendChild(el);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    onClose?.();
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
  };
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => !n.disabled);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!el.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  document.addEventListener('keydown', onKey, true);
  return close;
}
