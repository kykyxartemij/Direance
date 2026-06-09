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
  el.textContent = label;

  const rect = trigger.getBoundingClientRect();
  el.style.top = `${rect.top - 6}px`;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.transform = 'translate(-50%, -100%)';
  el.style.opacity = '1';
}

function hide() {
  if (!tooltipEl) return;
  tooltipEl.style.opacity = '0';
}

function onMouseOver(e: MouseEvent) {
  const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');
  if (!trigger) return;
  const label = trigger.dataset.tooltip;
  if (label) show(trigger, label);
}

function onMouseOut(e: MouseEvent) {
  const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');
  if (!trigger) return;
  const related = e.relatedTarget as HTMLElement | null;
  if (related && trigger.contains(related)) return;
  hide();
}

let initialized = false;

export function initTooltipSingleton() {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
}
