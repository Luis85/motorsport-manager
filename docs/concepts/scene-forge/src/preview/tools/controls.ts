export function input(
  parent: HTMLElement,
  label: string,
  type = 'number',
  value = '',
  attributes: Record<string, string> = {},
) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  wrapper.textContent = label;
  const control = document.createElement('input');
  control.type = type;
  control.value = value;
  Object.entries(attributes).forEach(([key, value]) => control.setAttribute(key, value));
  wrapper.append(control);
  parent.append(wrapper);
  return control;
}
export function select(parent: HTMLElement, label: string, options: [string, string][]) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  wrapper.textContent = label;
  const control = document.createElement('select');
  control.setAttribute('aria-label', label);
  options.forEach(([value, text]) => control.add(new Option(text, value)));
  wrapper.append(control);
  parent.append(wrapper);
  return control;
}
export function action(parent: HTMLElement, label: string, click: () => void, signal: AbortSignal) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', click, { signal });
  parent.append(button);
  return button;
}
export function note(parent: HTMLElement, text: string) {
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = text;
  parent.append(p);
  return p;
}
