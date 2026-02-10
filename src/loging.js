// === ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ ===
window.DEBUG_MODE = true;
window.INFO_MODE = true;
window.WARN_MODE = true;
window.ERROR_MODE = true;
window.ERROR_LOGS = false;

/**
 * Логгер с поддержкой различных уровней логирования
 */

const logger = {
  logs: [],
  maxLogs: 500,

  /**
   * Основной метод логирования
   * @param {string} level - уровень логирования (DEBUG, INFO, WARN, ERROR)
   * @param {string} message - сообщение
   * @param {any} data - дополнительные данные
   */
  log(level, message, data = null) {
    if (!window.ERROR_LOGS) {
      return;
    }
    if (level === 'DEBUG' && !window.DEBUG_MODE) {
      return;
    }
    if (level === 'INFO' && !window.INFO_MODE) {
      return;
    }
    if (level === 'WARN' && !window.WARN_MODE) {
      return;
    }
    if (level === 'ERROR' && !window.ERROR_MODE) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: this.safeStringify(data),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Разные методы вывода в зависимости от уровня
    switch (level) {
      case 'ERROR':
        console.error(`[${timestamp}] ${level}: ${message}`, data);
        break;
      case 'WARN':
        console.warn(`[${timestamp}] ${level}: ${message}`, data);
        break;
      case 'DEBUG':
        console.debug(`[${timestamp}] ${level}: ${message}`, data);
        break;
      default:
        console.log(`[${timestamp}] ${level}: ${message}`, data);
    }

    try {
      localStorage.setItem('radioLogs', this.safeStringify(this.logs));
    } catch (e) {
      console.warn('Cannot save logs to localStorage', e);
    }
  },

  /**
   * Безопасная сериализация объектов в JSON
   * @param {any} obj - объект для сериализации
   * @returns {string} строковое представление объекта
   */
  safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, val) => {
      if (val != null && typeof val == 'object') {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
  },

  info(msg, data) {    
    this.log('INFO', msg, data);
  },
  error(msg, data) {
    this.log('ERROR', msg, data);
  },
  warn(msg, data) {
    this.log('WARN', msg, data);
  },
  debug(msg, data) {
    this.log('DEBUG', msg, data);
  },

  getLogs() {
    return this.logs;
  },
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('radioLogs');
  },
  downloadLogs() {
    const logsStr = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([logsStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radio-logs-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};


// Логирование необработанных ошибок
window.addEventListener('error', (event) => {
  logger.error('Uncaught error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled Promise rejection', {
    reason: event.reason,
    promise: event.promise,
  });
});

logger.info('=== ПРИЛОЖЕНИЕ ЗАПУЩЕНО ===', {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  language: navigator.language,
  onLine: navigator.onLine,
  timestamp: new Date().toISOString(),
});

// Логирование действий пользователя
window.addEventListener('beforeunload', () => {
  logger.info('=== ПРИЛОЖЕНИЕ ЗАКРЫВАЕТСЯ ===', {
    timestamp: new Date().toISOString(),
  });
});

// Логирование visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    logger.info('App backgrounded (page hidden)');
  } else {
    logger.info('App restored (page visible)');
  }
});

// === ФУНКЦИИ ОТЛАДКИ ===
// Делаем logger глобально доступным
window.logger = logger;

// Экспортируем логи для доступа из консоли браузера
window.getRadioLogs = () => logger.getLogs();
window.downloadRadioLogs = () => logger.downloadLogs();
window.clearRadioLogs = () => logger.clearLogs();
window.showRadioLogs = () => {
  const logs = logger.getLogs();
  console.table(logs);
  alert(`Всего логов: ${logs.length}\nОтправьте screenshot консоли разработчика.`);
};
