// === ОПРЕДЕЛЕНИЕ ПЛАТФОРМЫ ===
/**
 * Определяет, является ли устройство iOS
 * @returns {boolean} true если iOS устройство
 */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Определяет, является ли устройство Android
 * @returns {boolean} true если Android устройство
 */
function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

/**
 * Определяет, является ли iOS старой версией (13 и ниже)
 * @returns {boolean} true если iOS 13 или старше
 */
function isOldIOS() {
  const match = navigator.userAgent.match(/OS (\d+)/);
  if (match) {
    const version = parseInt(match[1]);
    return version <= 13;
  }
  return false;
}

// === ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ ===
window.DEBUG_MODE = true;
window.INFO_MODE = true;
window.WARN_MODE = true;
window.ERROR_MODE = true;
window.ERROR_LOGS = true;

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

    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data) : null,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    console.log(`[${timestamp}] ${level}: ${message}`, data);

    try {
      localStorage.setItem('radioLogs', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Cannot save logs to localStorage', e);
    }
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

// Основные элементы
const playButton = document.getElementById('playButton');
const muteButton = document.getElementById('muteButton');
const volumeSlider = document.getElementById('volumeSlider');
const radioPlayer = document.getElementById('radioPlayer');
const playStatus = document.getElementById('playStatus');
const soundStatus = document.getElementById('soundStatus');
const networkStatus = document.getElementById('networkStatus');
const streamUrl = 'https://hls-01-gpm.hostingradio.ru/avtoradio495/playlist.m3u8';

// Переменные состояния
let hls = null;
let isNativePlayback = false; // Флаг для отслеживания нативного воспроизведения на iOS
let isStoppingPlayback = false; // Флаг для игнорирования ошибок при намеренной остановке
let isMuted = localStorage.getItem('radioMuted') === 'true' || false;
let currentVolume = parseFloat(localStorage.getItem('radioVolume')) || 1;
let isBuffering = false;

// Локальная проверка iOS версии (не зависим от внешнего скрипта)
function detectOldIOSLocal() {
  try {
    const ua = navigator.userAgent || '';
    if (!/iP(hone|ad|od)/.test(ua)) return false;
    const match = ua.match(/OS (\d+)_?/);
    if (match && match[1]) {
      const v = parseInt(match[1], 10);
      return v <= 13; // старые iOS
    }
  } catch (e) {
    // ignore
  }
  return false;
}

// Переменные для логики переподключения
let fatalRetryCount = 0;
const maxFatalRetries = 5;
let nonFatalRetryCount = 0;
const maxNonFatalRetries = 10; // Увеличим порог для нефатальных ошибок
let retryTimeout;

// Конфигурация HLS.js
const hlsConfig = {
  lowLatencyMode: true,
  maxBufferLength: 3,
  liveSyncDurationCount: 1,
  latencyControl: {
    targetLiveSyncDuration: 1.0,
    maxLiveSyncPlaybackRate: 1.4,
  },
  liveBackBufferLength: 2,
  manifestLoadingTimeOut: 15000,
  manifestLoadingMaxRetry: 2,
  manifestLoadingRetryDelay: 500,
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 2,
  levelLoadingRetryDelay: 500,
  fragLoadingTimeOut: 8000,
  fragLoadingMaxRetry: 3,
  fragLoadingRetryDelay: 1000,
  maxMaxBufferLength: 6,
  enableWorker: true,
  enableSoftwareAES: true,
  backBufferLength: 2,
};

// Переопределяем старую функцию log на использование нового логгера
const log = (e) => {
  logger.error('toast', e);
  showToast(typeof e === 'string' ? e : JSON.stringify(e));
};

// Инициализация
/**
 * Инициализирует плеер, загружает сохраненные настройки и подключает обработчики событий
 */
function initPlayer() {
  try {
    logger.info('Initializing player...');
    isMuted = localStorage.getItem('radioMuted') === 'true' || false;
    currentVolume = parseFloat(localStorage.getItem('radioVolume')) || 1;
    logger.debug('Loaded settings', { isMuted, currentVolume });

    updatePlayButton();
    updateMuteButton();
    updateVolume();
    updateStatusIndicators('offline');

    // Один раз подключаем обработчики основных событий
    playButton.addEventListener('click', togglePlayback);
    muteButton.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', handleVolumeChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Проверяем платформу и скрываем элементы управления громкостью на iPhone
    setTimeout(() => {
      try {
        const isIOSDevice = isIOS() || /iP(hone|ad|od)/.test(navigator.userAgent);
        if (isIOSDevice) {
          logger.info('iOS detected - hiding volume controls (not supported on iOS)');
          muteButton.style.display = 'none';
          const volContainer = document.querySelector('.volume-slider-container');
          if (volContainer) volContainer.style.display = 'none';
        } else {
          logger.debug('Not iOS - leaving volume controls visible');
        }
      } catch (e) {
        logger.debug('Platform check error', e);
      }
    }, 100);

    logger.info('Player initialized successfully');
  } catch (error) {
    logger.error('Player initialization failed', {
      message: error.message,
      stack: error.stack,
    });
  }
}

// Обработчик изменения громкости
/**
 * Обрабатывает изменение громкости с ползунка
 * @param {Event} e - событие input ползунка
 */
function handleVolumeChange(e) {
  setVolume(parseFloat(e.target.value));
}

// Обработчики глобальных событий
/**
 * Обработчик события восстановления интернета
 */
function handleOnline() {
  updateStatusIndicators((hls || isNativePlayback) && !radioPlayer.paused ? 'playing' : 'offline');
}

/**
 * Обработчик события потери интернета
 */
function handleOffline() {
  updateStatusIndicators('offline');
  if (hls || isNativePlayback) {
    showToast('Интернет пропал. Воспроизведение остановлено.');
    handleFatalError();
  }
}

// Обновление UI
/**
 * Обновляет кнопку воспроизведения на основе состояния плеера
 */
function updatePlayButton() {
  if (isBuffering) {
    playButton.innerHTML = '<div class="spinner"></div>';
  } else if ((hls || isNativePlayback) && !radioPlayer.paused) {
    playButton.innerHTML = '<i class="fas fa-stop"></i>';
  } else {
    playButton.innerHTML = '<i class="fas fa-play"></i>';
  }
}

/**
 * Обновляет иконку и подсказку кнопки отключения звука
 */
function updateMuteButton() {
  if (isMuted) {
    muteButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
    muteButton.title = 'Включить звук';
  } else {
    muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
    muteButton.title = 'Выключить звук';
  }
}

/**
 * Обновляет громкость аудиоэлемента и сохраняет значение в localStorage
 */
function updateVolume() {
  radioPlayer.volume = isMuted ? 0 : currentVolume;
  volumeSlider.value = currentVolume;
  localStorage.setItem('radioVolume', currentVolume);

  logger.debug('Volume update', {
    volume: radioPlayer.volume,
    currentVolume: currentVolume,
    isMuted: isMuted,
    sliderValue: volumeSlider.value,
  });
}

// Инициализация WebAudio для управления громкостью через gain node
/**
 * Обновляет индикаторы статуса на основе состояния сети и воспроизведения
 * @param {string} networkState - состояние сети ('buffering', 'reconnecting', 'playing', 'offline')
 */
function updateStatusIndicators(networkState) {
  playStatus.classList.toggle('playing', (hls || isNativePlayback) && !radioPlayer.paused);
  playStatus.classList.toggle('muted', !((hls || isNativePlayback) && !radioPlayer.paused));

  soundStatus.classList.toggle('muted', isMuted);
  soundStatus.classList.toggle('playing', !isMuted);

  const networkStatusText = networkStatus.querySelector('.status-text');
  networkStatus.classList.remove('playing', 'muted', 'warning');

  switch (networkState) {
    case 'buffering':
      networkStatus.classList.add('warning');
      networkStatusText.textContent = 'Буферизация...';
      break;
    case 'reconnecting':
      networkStatus.classList.add('warning');
      networkStatusText.textContent = 'Переподключение...';
      break;
    case 'playing':
      networkStatus.classList.add('playing');
      networkStatusText.textContent = 'В сети';
      break;
    case 'offline':
    default:
      networkStatus.classList.add('muted');
      networkStatusText.textContent = 'Офлайн';
      break;
  }
}

// Управление воспроизведением
function togglePlayback() {
  if (!hls && !isNativePlayback) {
    startPlaybackOptimized();
  } else {
    stopPlayback();
  }
}

/**
 * Оптимизированный запуск воспроизведения с поддержкой iOS
 */
function startPlaybackOptimized() {
  logger.info('Starting playback (optimized)');

  if (isIOS()) {
    logger.info('iOS detected - using native HLS playback');
    startPlaybackNativeHLS();
  } else if (Hls && Hls.isSupported()) {
    logger.info('Using HLS.js playback');
    startPlaybackHLSJS();
  } else {
    logger.error('No compatible playback method found');
    showToast('Ваш браузер не поддерживает воспроизведение HLS');
  }
}

/**
 * Нативное воспроизведение для iOS
 */
function startPlaybackNativeHLS() {
  if (hls) {
    stopPlayback();
  }

  isNativePlayback = true;
  isBuffering = true;
  updatePlayButton();
  updateStatusIndicators('buffering');

  try {
    radioPlayer.src = streamUrl;

    // Удаляем предыдущие обработчики перед добавлением новых
    removeAllEventListeners();

    radioPlayer.addEventListener('play', handlePlay);
    radioPlayer.addEventListener('pause', handlePause);
    radioPlayer.addEventListener('playing', () => {
      logger.info('Native playback: playing event');
      isBuffering = false;
      updatePlayButton();
      updateStatusIndicators('playing');
      resetRetryCounts();
    });
    radioPlayer.addEventListener('error', (e) => {
      if (isStoppingPlayback) {
        logger.debug('Error ignored: stopping playback');
        return;
      }
      logger.error('Native playback error', {
        code: radioPlayer.error?.code,
        message: radioPlayer.error?.message,
      });
      showToast('Ошибка воспроизведения');
      isNativePlayback = false;
      handleFatalError();
    });
    radioPlayer.addEventListener('canplay', handleCanPlay);
    radioPlayer.addEventListener('loadstart', () => {
      logger.info('Native playback: loadstart');
      isBuffering = true;
      updateStatusIndicators('buffering');
    });

    logger.info('Attempting to play native HLS');
    const playPromise = radioPlayer.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          logger.info('Native HLS playback started successfully');
          isBuffering = false;
          updatePlayButton();
          updateStatusIndicators('playing');
          resetRetryCounts();
        })
        .catch((error) => {
          logger.error('Native HLS play error', error);
          isNativePlayback = false;
          if (error.name === 'NotAllowedError') {
            logger.warn('User interaction required for native HLS');
            showToast('Нажмите кнопку для начала воспроизведения');
            updateStatusIndicators('offline');
          } else if (error.name === 'NotSupportedError') {
            logger.error('HLS format not supported by native player');
            showToast('Ваш браузер не поддерживает HLS');
          } else {
            showToast('Ошибка при воспроизведении: ' + error.message);
            handleFatalError();
          }
        });
    }
  } catch (error) {
    logger.error('Error setting up native HLS', error);
    showToast('Ошибка инициализации плеера');
    handleFatalError();
  }
}

/**
 * Воспроизведение с использованием HLS.js
 */
function startPlaybackHLSJS() {
  if (hls) {
    stopPlayback();
  }
  isBuffering = true;
  updatePlayButton();
  updateStatusIndicators('buffering');

  try {
    hls = new Hls(hlsConfig);
    logger.info('HLS instance created');

    hls.loadSource(streamUrl);
    logger.info('Loading stream', { url: streamUrl });

    hls.attachMedia(radioPlayer);
    logger.info('Media attached to audio element');

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      logger.info('Manifest parsed successfully');
      radioPlayer
        .play()
        .then(() => {
          logger.info('Playback started');
          updateStatusIndicators('playing');
          resetRetryCounts();
        })
        .catch((error) => {
          logger.error('Play error', error);
          if (error.name === 'NotAllowedError') {
            logger.warn('User interaction required for autoplay');
            updateStatusIndicators('offline');
            playButton.innerHTML = 'Нажмите для старта';
          } else {
            handleFatalError();
          }
        });
    });

    hls.on(Hls.Events.ERROR, function (event, data) {
      logger.error('HLS Error', {
        fatal: data.fatal,
        type: data.type,
        details: data.details,
        error: data.error,
      });

      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          logger.error('Network error detected');
          showToast(`Нет интернета. Проверьте подключение к интернету.`);
        }
        handleFatalError();
      } else if (
        data.type === Hls.ErrorTypes.MEDIA_ERROR &&
        data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR
      ) {
        logger.warn('Buffer stalled, recovering...');
        handleBufferStall();
      }
    });

    removeAllEventListeners();

    radioPlayer.addEventListener('pause', handlePause);
    radioPlayer.addEventListener('play', handlePlay);
    radioPlayer.addEventListener('waiting', handleWaiting);
    radioPlayer.addEventListener('canplay', handleCanPlay);

    logger.info('All HLS.js event handlers attached');
  } catch (error) {
    logger.error('Error during HLS.js setup', error);
    throw error;
  }
}

/**
 * Удаляет все обработчики событий из аудиоэлемента
 */
function removeAllEventListeners() {
  radioPlayer.removeEventListener('pause', handlePause);
  radioPlayer.removeEventListener('play', handlePlay);
  radioPlayer.removeEventListener('waiting', handleWaiting);
  radioPlayer.removeEventListener('canplay', handleCanPlay);
  radioPlayer.removeEventListener('playing', handlePlaying);
  radioPlayer.removeEventListener('error', handleMediaError);
  radioPlayer.removeEventListener('loadstart', handleLoadStart);
}

// Остановка
/**
 * Останавливает воспроизведение и очищает ресурсы
 */
function stopPlayback() {
  logger.info('Stopping playback');
  isBuffering = false;
  isNativePlayback = false;
  isStoppingPlayback = true;
  clearTimeout(retryTimeout);
  if (hls) {
    hls.destroy();
    hls = null;
  }

  removeAllEventListeners();

  radioPlayer.pause();
  radioPlayer.src = '';
  updatePlayButton();
  updateStatusIndicators('offline');
  resetRetryCounts();

  setTimeout(() => {
    isStoppingPlayback = false;
  }, 500);
}

// Функции-обработчики событий
function handlePause() {
  updatePlayButton();
  if (!hls && !isNativePlayback) {
    updateStatusIndicators('offline');
  } else if (isBuffering) {
    updateStatusIndicators('buffering');
  } else {
    updateStatusIndicators('offline');
  }
}

function handlePlay() {
  updatePlayButton();
  if (!radioPlayer.waiting) {
    updateStatusIndicators('playing');
  }
  resetRetryCounts();
}

function handleWaiting() {
  isBuffering = true;
  updatePlayButton();
  updateStatusIndicators('buffering');
}

function handleCanPlay() {
  isBuffering = false;
  updatePlayButton();
  if (!radioPlayer.paused) {
    updateStatusIndicators('playing');
  }
}

function handlePlaying() {
  logger.info('handlePlaying triggered');
  isBuffering = false;
  updatePlayButton();
  if (!radioPlayer.paused) {
    updateStatusIndicators('playing');
  }
}

function handleMediaError() {
  if (isStoppingPlayback) {
    logger.debug('Media error ignored: stopping playback');
    return;
  }

  logger.error('Media error detected', {
    errorCode: radioPlayer.error?.code,
    errorMessage: radioPlayer.error?.message,
  });

  isNativePlayback = false;

  switch (radioPlayer.error?.code) {
    case 1:
      logger.error('MEDIA_ERR_ABORTED');
      break;
    case 2:
      logger.error('MEDIA_ERR_NETWORK');
      showToast('Ошибка сети. Проверьте подключение.');
      break;
    case 3:
      logger.error('MEDIA_ERR_DECODE');
      showToast('Ошибка декодирования потока.');
      break;
    case 4:
      logger.error('MEDIA_ERR_SRC_NOT_SUPPORTED');
      showToast('Формат потока не поддерживается.');
      break;
  }

  handleFatalError();
}

function handleLoadStart() {
  logger.info('Audio element: loadstart');
}

// Функция для отображения всплывающих сообщений
/**
 * Показывает всплывающее сообщение пользователю
 * @param {string} message - текст сообщения
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Обработка ошибок и восстановление
/**
 * Обрабатывает застой буфера и пытается его восстановить
 */
function handleBufferStall() {
  if (!hls) {
    return;
  }

  isBuffering = true;
  updatePlayButton();
  nonFatalRetryCount++;
  updateStatusIndicators('buffering');

  if (nonFatalRetryCount > maxNonFatalRetries) {
    showToast(`Превышен лимит попыток восстановления буфера. Запуск фатального восстановления.`);
    handleFatalError();
    return;
  }

  if (hls) {
    hls.startLoad();
  }
}

/**
 * Обрабатывает фатальные ошибки и инициирует переподключение
 */
function handleFatalError() {
  if (!hls && !isNativePlayback) {
    return;
  }

  if (fatalRetryCount >= maxFatalRetries) {
    fatalRetryCount = 0;
  }
  fatalRetryCount++;
  const delay = Math.pow(2, fatalRetryCount) * 1000;

  updateStatusIndicators('reconnecting');

  clearTimeout(retryTimeout);
  retryTimeout = setTimeout(() => {
    if (!hls && !isNativePlayback) {
      return;
    }
    if (hls) {
      hls.destroy();
      hls = null;
    }
    isNativePlayback = false;
    startPlaybackOptimized();
  }, delay);
}

/**
 * Сбрасывает счетчики попыток переподключения
 */
function resetRetryCounts() {
  fatalRetryCount = 0;
  nonFatalRetryCount = 0;
}

// Управление звуком
/**
 * Переключает режим отключения звука
 */
function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem('radioMuted', isMuted);
  updateVolume();
  updateMuteButton();

  logger.debug('Mute toggled', { isMuted: isMuted });
  updateStatusIndicators((hls || isNativePlayback) && !radioPlayer.paused ? 'playing' : 'offline');
}

/**
 * Устанавливает громкость воспроизведения
 * @param {number} volume - значение громкости от 0 до 1
 */
function setVolume(volume) {
  const wasPlaying = !radioPlayer.paused;
  isMuted = false;
  currentVolume = volume;
  localStorage.setItem('radioVolume', volume);
  updateVolume();
  updateMuteButton();
  logger.debug('Volume set', { volume: volume, wasPlaying });

  if (wasPlaying && radioPlayer.paused && (hls || isNativePlayback)) {
    radioPlayer.play().catch((err) => {
      logger.warn('Could not resume playback after volume change', err);
    });
  }
  updateStatusIndicators((hls || isNativePlayback) && !radioPlayer.paused ? 'playing' : 'offline');
}

// === ФУНКЦИИ ОТЛАДКИ ===
// Экспортируем логи для доступа из консоли браузера
window.getRadioLogs = () => logger.getLogs();
window.downloadRadioLogs = () => logger.downloadLogs();
window.clearRadioLogs = () => logger.clearLogs();
window.showRadioLogs = () => {
  const logs = logger.getLogs();
  console.table(logs);
  alert(`Всего логов: ${logs.length}\nОтправьте screenshot консоли разработчика.`);
};

// Функция для проверки состояния громкости на iOS
window.checkVolumeStatus = () => {
  const info = {
    platform: navigator.userAgent,
    isIOS: typeof isIOS === 'function' ? isIOS() : 'unknown',
    isNativePlayback: isNativePlayback,
    currentVolume: currentVolume,
    isMuted: isMuted,
    audioVolume: radioPlayer.volume,
    audioMuted: radioPlayer.muted,
    sliderValue: volumeSlider.value,
    message:
      'На iPhone громкость управляется кнопками на боку устройства (Side keys). Веб-ползунок только для интерфейса.',
  };
  console.table(info);
  return info;
};

// Логирование действий пользователя
window.addEventListener('beforeunload', () => {
  logger.info('=== ПРИЛОЖЕНИЕ ЗАКРЫВАЕТСЯ ===', {
    hlsActive: hls !== null,
    isPlaying: radioPlayer && !radioPlayer.paused,
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

// Инициализация плеера
logger.info('Document ready, initializing player');
initPlayer();
