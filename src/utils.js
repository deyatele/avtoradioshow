// Утилиты для определения платформы
const PlatformUtils = {
  isIOS() {
    const userAgent = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  },

  isAndroid() {
    const userAgent = navigator.userAgent || '';
    return /Android/.test(userAgent);
  },

  isOldIOS() {
    const userAgent = navigator.userAgent || '';
    const match = userAgent.match(/OS (\d+)/);
    if (match && match[1]) {
      const version = parseInt(match[1], 10);
      return version <= 13;
    }
    return false;
  },

  detectOldIOSLocal() {
    try {
      const ua = navigator.userAgent || '';
      if (!/iP(hone|ad|od)/.test(ua)) return false;
      const match = ua.match(/OS (\d+)_?/);
      if (match && match[1]) {
        const v = parseInt(match[1], 10);
        return v <= 13; // старые iOS
      }
    } catch (e) {
      console.warn('Error detecting iOS version:', e);
    }
    return false;
  },
};

const EventUtils = {
  addSafeEventListener(element, eventType, handler) {
    if (element && typeof element.addEventListener === 'function' && typeof handler === 'function') {
      element.addEventListener(eventType, handler);
    }
  },

  removeSafeEventListener(element, eventType, handler) {
    if (element && typeof element.removeEventListener === 'function' && typeof handler === 'function') {
      element.removeEventListener(eventType, handler);
    }
  },
};

const StorageUtils = {
  getItem(key, defaultValue = null) {
    if (typeof key !== 'string') {
      console.warn('StorageUtils.getItem: key must be a string');
      return defaultValue;
    }

    try {
      if (!this.isLocalStorageSupported()) {
        return defaultValue;
      }

      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn(`Error reading from localStorage for key "${key}":`, e);
      return defaultValue;
    }
  },

  setItem(key, value) {
    if (typeof key !== 'string') {
      console.warn('StorageUtils.setItem: key must be a string');
      return;
    }

    try {
      if (!this.isLocalStorageSupported()) {
        return;
      }

      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error writing to localStorage for key "${key}":`, e);
    }
  },

  removeItem(key) {
    if (typeof key !== 'string') {
      console.warn('StorageUtils.removeItem: key must be a string');
      return;
    }

    try {
      if (!this.isLocalStorageSupported()) {
        return;
      }

      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing from localStorage for key "${key}":`, e);
    }
  },

  isLocalStorageSupported() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },
};

const ApiUtils = {
  isServiceWorkerSupported() {
    return 'serviceWorker' in navigator;
  },

  isWebAudioAPISupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  },

  isMediaSessionAPISupported() {
    return 'mediaSession' in navigator;
  },
};

export { PlatformUtils, EventUtils, StorageUtils, ApiUtils };
