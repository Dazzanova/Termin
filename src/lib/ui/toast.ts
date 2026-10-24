export function showToast(message: string, variant?: "error"): void {
  const toast = document.createElement("div");

  toast.className = variant ? `toast toast-${variant}` : "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;

  document.body.appendChild(toast);

  window.setTimeout(() => toast.remove(), 3000);
}
