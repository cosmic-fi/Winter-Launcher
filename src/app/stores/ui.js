import { writable, get } from "svelte/store";

export const uiState = {
    activeTab: writable("home"),
    activeModal: writable("none"),
    isBootReady: writable(false),
    theme: writable("dark")
};

// Modal helpers
export function openModal(modalName) {
  uiState.activeModal.set(modalName);
}

export function closeModal() {
    uiState.activeModal.set("none");
}

export function getActiveModal() {
    return get(uiState.activeModal);
}

// Toasts
export const toasts = writable([]);

/**
 * Show a toast.
 * @param {string} message
 * @param {'normal'|'error'|'info'} type
 * @param {number} duration
 */
export function showToast(message, type = "normal", duration = 2500) {
  const id = Date.now() + Math.random();

  toasts.update(all => [
      ...all,
      { id, message, type, duration }
  ]);

  setTimeout(() => {
      toasts.update(all => all.filter(t => t.id !== id));
  }, duration);
}

// Dialog
export const dialogStore = writable({
  open: false,
  title: "",
  message: "",
  buttons: []
});

export function showDialog({ title, message, buttons }) {
  dialogStore.set({
      open: true,
      title,
      message,
      buttons
  });
}

export function closeDialog() {
  dialogStore.update(d => ({
      ...d,
      open: false
  }));
}