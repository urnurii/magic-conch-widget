'use strict';
if (window.__TAURI__) {
  const invoke = window.__TAURI__.core.invoke;
  window.conch = Object.freeze({
    getPreferences: () => invoke('get_preferences'),
    setPreference: (key, value) => invoke('set_preference', { key, value }),
    minimize: () => invoke('minimize_window'),
    close: () => invoke('close_window'),
    startDragging: () => invoke('drag_window'),
    ready: () => invoke('show_widget')
  });
  document.addEventListener('mousedown', event => {
    if (event.button === 0 && event.target.closest('[data-drag-region]')) {
      void window.conch.startDragging().catch(console.error);
    }
  });
}
