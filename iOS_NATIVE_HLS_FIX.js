// РЕКОМЕНДУЕМОЕ ИСПРАВЛЕНИЕ ДЛЯ ПОДДЕРЖКИ iOS (iPhone 7)
// Добавьте этот код в script.js перед функцией startPlayback()

// Определение платформы
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

function isOldIOS() {
  // iPhone 7, 6s, 6 и старше
  const match = navigator.userAgent.match(/OS (\d+)/);
  if (match) {
    const version = parseInt(match[1]);
    return version <= 13; // iOS 13 и ниже (старые системы)
  }
  return false;
}

// Логирование только если logger доступен (может загружаться после script.js)
if (typeof logger !== 'undefined') {
  logger.info('Platform detection', {
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isOldIOS: isOldIOS(),
    userAgent: navigator.userAgent,
  });
}

// Переделанная функция startPlayback с поддержкой iOS
function startPlaybackOptimized() {
  logger.info('Starting playback (optimized)');

  // На iOS используем нативный HLS плеер (самый надёжный)
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

// Нативное воспроизведение для iOS
function startPlaybackNativeHLS() {
  if (hls) {
    stopPlayback();
  }

  isNativePlayback = true; // Устанавливаем флаг нативного воспроизведения
  isBuffering = true;
  updatePlayButton();
  updateStatusIndicators('buffering');

  try {
    radioPlayer.src = streamUrl;

    // Обработчики событий для нативного воспроизведения
    radioPlayer.removeEventListener('play', handlePlay);
    radioPlayer.removeEventListener('pause', handlePause);
    radioPlayer.removeEventListener('playing', handlePlaying);
    radioPlayer.removeEventListener('error', handleMediaError);
    radioPlayer.removeEventListener('canplay', handleCanPlay);

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
      // Игнорируем ошибки при намеренной остановке воспроизведения
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

    // Пытаемся воспроизвести
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

// Функция для HLS.js (исходная логика)
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

    logger.debug('Hls.isSupported()', {
      supported: typeof Hls !== 'undefined' ? Hls.isSupported() : 'Hls missing',
    });
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

    // Удаляем предыдущие обработчики событий перед добавлением новых
    radioPlayer.removeEventListener('pause', handlePause);
    radioPlayer.removeEventListener('play', handlePlay);
    radioPlayer.removeEventListener('waiting', handleWaiting);
    radioPlayer.removeEventListener('canplay', handleCanPlay);

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

// Функция для обработки окончания буферизации на iOS
function handlePlaying() {
  logger.info('handlePlaying triggered');
  isBuffering = false;
  updatePlayButton();
  if (!radioPlayer.paused) {
    updateStatusIndicators('playing');
  }
}

// Функция для обработки ошибок медиа на iOS
function handleMediaError() {
  // Игнорируем ошибки при намеренной остановке воспроизведения
  if (isStoppingPlayback) {
    logger.debug('Media error ignored: stopping playback');
    return;
  }

  logger.error('Media error detected', {
    errorCode: radioPlayer.error?.code,
    errorMessage: radioPlayer.error?.message,
  });

  isNativePlayback = false; // Сбрасываем флаг при ошибке

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

// КАК ИСПОЛЬЗОВАТЬ ЭТО ИСПРАВЛЕНИЕ:
//
// 1. Откройте script.js
// 2. Скопируйте этот весь файл
// 3. Добавьте содержимое перед функцией startPlayback()
// 4. Замените в функции togglePlayback():
//    if (!hls) {
//      startPlayback();  // <- ЗАМЕНИТЕ НА
//      startPlaybackOptimized();
//    }
//
// 5. Проверьте на iPhone 7!
