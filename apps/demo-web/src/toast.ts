export type ToastVariant = "info" | "error" | "success";

let stackEl: HTMLElement | null = null;

function getStack(): HTMLElement {
  if (!stackEl) {
    stackEl = document.querySelector<HTMLElement>("#toast-stack");
  }
  if (!stackEl) {
    stackEl = document.createElement("div");
    stackEl.id = "toast-stack";
    stackEl.className = "toast-stack";
    stackEl.setAttribute("aria-live", "polite");
    document.body.appendChild(stackEl);
  }
  return stackEl;
}

export function showToast(message: string, variant: ToastVariant = "info"): void {
  const stack = getStack();
  const el = document.createElement("div");
  el.className = `toast toast--${variant}`;
  el.textContent = message;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--visible"));
  const ttl = variant === "error" ? 6000 : 4000;
  window.setTimeout(() => {
    el.classList.remove("toast--visible");
    window.setTimeout(() => el.remove(), 300);
  }, ttl);
}
