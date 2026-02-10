// Утилиты для определения платформы
const PlatformUtils = {
  /**
   * Определяет, является ли устройство iOS
   * @returns {boolean} true если iOS устройство
   */
  isIOS() {
    const userAgent = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  },

  /**
   * Определяет, является ли устройство Android
   * @returns {boolean} true если Android устройство
   */
  isAndroid() {
    const userAgent = navigator.userAgent || '';
    return /Android/.test(userAgent);
  },

  /**
   * Определяет, является ли iOS старой версией (13 и ниже)
   * @returns {boolean} true если iOS 13 или старше
   */
  isOldIOS() {
    const userAgent = navigator.userAgent || '';
    const match = userAgent.match(/OS (\d+)/);
    if (match && match[1]) {
      const version = parseInt(match[1], 10);
      return version <= 13;
    }
    return false;
  },

  // Локальная проверка iOS версии (не зависим от внешнего скрипта)
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

// Утилиты для обработки событий
const EventUtils = {
  /**
   * Безопасное добавление обработчика события
   * @param {Element} element - DOM элемент
   * @param {string} eventType - тип события
   * @param {Function} handler - обработчик события
   */
  addSafeEventListener(element, eventType, handler) {
    if (element && typeof element.addEventListener === 'function' && typeof handler === 'function') {
      element.addEventListener(eventType, handler);
    }
  },

  /**
   * Безопасное удаление обработчика события
   * @param {Element} element - DOM элемент
   * @param {string} eventType - тип события
   * @param {Function} handler - обработчик события
   */
  removeSafeEventListener(element, eventType, handler) {
    if (element && typeof element.removeEventListener === 'function' && typeof handler === 'function') {
      element.removeEventListener(eventType, handler);
    }
  },
};

// Утилиты для работы с localStorage
const StorageUtils = {
  /**
   * Безопасное получение значения из localStorage
   * @param {string} key - ключ
   * @param {*} defaultValue - значение по умолчанию
   * @returns {*} значение из localStorage или значение по умолчанию
   */
  getItem(key, defaultValue = null) {
    // Проверяем, что ключ является строкой
    if (typeof key !== 'string') {
      console.warn('StorageUtils.getItem: key must be a string');
      return defaultValue;
    }

    try {
      // Проверяем поддержку localStorage
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

  /**
   * Безопасная запись значения в localStorage
   * @param {string} key - ключ
   * @param {*} value - значение
   */
  setItem(key, value) {
    // Проверяем, что ключ является строкой
    if (typeof key !== 'string') {
      console.warn('StorageUtils.setItem: key must be a string');
      return;
    }

    try {
      // Проверяем поддержку localStorage
      if (!this.isLocalStorageSupported()) {
        return;
      }

      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error writing to localStorage for key "${key}":`, e);
    }
  },

  /**
   * Безопасное удаление значения из localStorage
   * @param {string} key - ключ
   */
  removeItem(key) {
    // Проверяем, что ключ является строкой
    if (typeof key !== 'string') {
      console.warn('StorageUtils.removeItem: key must be a string');
      return;
    }

    try {
      // Проверяем поддержку localStorage
      if (!this.isLocalStorageSupported()) {
        return;
      }

      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing from localStorage for key "${key}":`, e);
    }
  },

  /**
   * Проверяет, доступен ли localStorage
   * @returns {boolean} true если localStorage поддерживается
   */
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

// Утилиты для проверки доступности API
const ApiUtils = {
  /**
   * Проверяет, доступен ли Service Worker
   * @returns {boolean} true если Service Worker поддерживается
   */
  isServiceWorkerSupported() {
    return 'serviceWorker' in navigator;
  },

  /**
   * Проверяет, доступен ли Web Audio API
   * @returns {boolean} true если Web Audio API поддерживается
   */
  isWebAudioAPISupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  },

  /**
   * Проверяет, доступен ли Media Session API
   * @returns {boolean} true если Media Session API поддерживается
   */
  isMediaSessionAPISupported() {
    return 'mediaSession' in navigator;
  },
};

export { PlatformUtils, EventUtils, StorageUtils, ApiUtils };
