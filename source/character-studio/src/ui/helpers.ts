export function escape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}

export function download(name: string, value: unknown): void {
  downloadText(name, JSON.stringify(value, null, 2) + '\n');
}
export function downloadText(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const paths: Record<string, string> = {
  leaf: 'M20 4C10 3 3 7 5 15c7 6 15-1 15-11ZM5 20 16 9M10 15l-1-5M13 12l4 1',
  undo: 'M8 5 3 10l5 5M3 10h10a6 6 0 0 1 0 12',
  redo: 'm16 5 5 5-5 5m5-5H11a6 6 0 0 0 0 12',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  lock: 'M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
  unlock: 'M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0M12 15v2',
  save: 'M5 3h12l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8',
  dice: 'M5 3h14l2 2v14l-2 2H5l-2-2V5ZM7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01',
  close: 'm6 6 12 12M6 18 18 6',
  person: 'M8 6a4 4 0 1 0 8 0 4 4 0 0 0-8 0M4 22v-3a8 8 0 0 1 16 0v3',
  settings: 'M5 3v18M12 3v18M19 3v18M2 8h6M9 16h6M16 8h6',
  check: 'm5 12 5 5L20 6',
};
export function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.leaf}"/></svg>`;
}
export function button(label: string, action: string, className = '', attrs = ''): string {
  return `<button type="button" data-action="${escape(action)}" class="${className}" ${attrs}>${label}</button>`;
}
export function pathValue(value: unknown, path: string): unknown {
  return path.split('.').reduce((item: any, key) => item?.[key], value);
}
