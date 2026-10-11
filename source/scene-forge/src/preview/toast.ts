// Transient editor notifications in the #toast live region. A new message replaces
// the current one; errors are styled distinctly and stay visible longer.
import { $ } from './dom.js';

export type Toast = (message: string, error?: boolean) => void;

export function createToast(): Toast {
  let toastTimer: ReturnType<typeof setTimeout>;
  return function toast(message: string, error = false) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.toggle('error', error);
    $('toast').hidden = false;
    toastTimer = setTimeout(
      () => {
        $('toast').hidden = true;
      },
      error ? 7000 : 4500,
    );
  };
}
