// ==== Tooltip Singleton ====
// One tooltip DOM node for entire page. Delegated events on document — scales to any number of triggers.

let tooltipEl: HTMLSpanElement | null = null;

function getTooltip(): HTMLSpanElement {
  if (tooltipEl) return tooltipEl;
  const el = document.createElement('span');
  el.className = 'art-tooltip';
  el.setAttribute('role', 'tooltip');
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  tooltipEl = el;
  return el;
}

function show(trigger: HTMLElement, label: string) {
  const el = getTooltip();
  // Browser quirk: showModal() puts the dialog above everything outside it, so live inside it.
  const host = trigger.closest('dialog') ?? document.body;
  if (el.parentElement !== host) host.appendChild(el);
  el.textContent = label;

  const rect = trigger.getBoundingClientRect();
  el.style.top = `${rect.top - 6}px`;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.transform = 'translate(-50%, -100%)';

  el.style.transition = 'none';
  el.style.opacity = '0';
  void el.offsetWidth;
  el.style.transition = '';
  el.style.opacity = '1';
}

function hide() {
  if (!tooltipEl) return;
  tooltipEl.style.opacity = '0';
}

function onMouseOver(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target === tooltipEl) return;
  const trigger = target.closest<HTMLElement>('[data-tooltip]');
  // A trigger removed from the page (navigation, closed dialog) never fires mouseout.
  if (!trigger) { if (!tooltipEl?.contains(target)) hide(); return; }
  const label = trigger.dataset.tooltip;
  if (label) show(trigger, label);
}

function onMouseOut(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const related = e.relatedTarget as HTMLElement | null;
  if (related === tooltipEl) return;

  if (target === tooltipEl) {
    if (related && tooltipEl?.contains(related)) return;
    hide();
    return;
  }

  const trigger = target.closest<HTMLElement>('[data-tooltip]');
  if (!trigger) return;
  if (related && trigger.contains(related)) return;
  hide();
}

let initialized = false;

export function initTooltipSingleton() {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
  document.addEventListener('pointerdown', (e) => { if (!tooltipEl?.contains(e.target as Node)) hide(); }, true);
}
