import { PlatformUtils, StorageUtils } from './utils.js';

class RadioPlayer {
  constructor() {
    // Основные элементы
    this.playButton = document.getElementById('playButton');
    this.muteButton = document.getElementById('muteButton');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.radioPlayer = document.getElementById('radioPlayer');
    this.playStatus = document.getElementById('playStatus');
    this.soundStatus = document.getElementById('soundStatus');
    this.networkStatus = document.getElementById('networkStatus');

    this.streamUrl = 'https://hls-01-gpm.hostingradio.ru/avtoradio831/playlist.m3u8';

    this.hls = null;
    this.isStoppingPlayback = false;
    this.isMuted = StorageUtils.getItem('radioMuted', false);
    this.currentVolume = StorageUtils.getItem('radioVolume', 1);
    this.isBuffering = false;

    this.isIOS = PlatformUtils.isIOS();
    this.isOldIOS = this.isIOS && PlatformUtils.isOldIOS();

    if (this.isIOS && this.isOldIOS) {
      this.createHiddenVideoElement();
    }

    this.mediaElement = this.isIOS && this.isOldIOS ? this.videoElement : this.radioPlayer;

    this.fatalRetryCount = 0;
    this.maxFatalRetries = 5;
    this.nonFatalRetryCount = 0;
    this.maxNonFatalRetries = 10;
    this.retryTimeout = null;

    this.eventHandlers = {};

    this.hlsConfig = {
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

    this.init();
  }

  createHiddenVideoElement() {
    this.videoElement = document.createElement('video');
    this.videoElement.style.display = 'none';
    this.videoElement.setAttribute('preload', 'none');
    this.videoElement.setAttribute('playsinline', '');
    this.videoElement.setAttribute('webkit-playsinline', '');
    this.videoElement.setAttribute('aria-label', 'Видеоплеер (для iOS)');

    this.radioPlayer.parentNode.insertBefore(this.videoElement, this.radioPlayer.nextSibling);
  }

  getCurrentMediaElement() {
    return this.isOldIOS ? this.videoElement : this.radioPlayer;
  }

  init() {
    try {
      logger.info('Initializing player...');

      if (!this.playButton || !this.muteButton || !this.volumeSlider || !this.radioPlayer) {
        throw new Error('Required DOM elements not found');
      }

      this.isMuted = StorageUtils.getItem('radioMuted', false);
      this.currentVolume = StorageUtils.getItem('radioVolume', 1);
      logger.debug('Loaded settings', { isMuted: this.isMuted, currentVolume: this.currentVolume });

      this.updatePlayButton();
      this.updateMuteButton();
      this.updateVolume();
      this.updateStatusIndicators('offline');

      this.eventHandlers.togglePlayback = this.togglePlayback.bind(this);
      this.eventHandlers.toggleMute = this.toggleMute.bind(this);
      this.eventHandlers.handleVolumeChange = this.handleVolumeChange.bind(this);
      this.eventHandlers.handleOnline = this.handleOnline.bind(this);
      this.eventHandlers.handleOffline = this.handleOffline.bind(this);

      this.playButton.addEventListener('click', this.eventHandlers.togglePlayback);
      this.muteButton.addEventListener('click', this.eventHandlers.toggleMute);
      this.volumeSlider.addEventListener('input', this.eventHandlers.handleVolumeChange);
      window.addEventListener('online', this.eventHandlers.handleOnline);
      window.addEventListener('offline', this.eventHandlers.handleOffline);

      setTimeout(() => {
        try {
          const isIOSDevice = PlatformUtils.isIOS() || /iP(hone|ad|od)/.test(navigator.userAgent);
          if (isIOSDevice) {
            logger.info('iOS detected - hiding volume controls (not supported on iOS)');
            this.muteButton.style.display = 'none';
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

  updatePlayButton() {
    if (this.isBuffering) {
      this.playButton.innerHTML = '<div class="spinner" aria-label="Загрузка..."></div>';
      this.playButton.setAttribute('aria-label', 'Загрузка...');
      this.playButton.title = 'Загрузка...';
    } else if (this.hls && !this.getCurrentMediaElement().paused) {
      this.playButton.innerHTML = '<i class="fas fa-stop" aria-hidden="true"></i>';
      this.playButton.setAttribute('aria-label', 'Остановить воспроизведение');
      this.playButton.title = 'Остановить воспроизведение';
    } else {
      this.playButton.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i>';
      this.playButton.setAttribute('aria-label', 'Воспроизвести');
      this.playButton.title = 'Воспроизвести';
    }
  }

  updateMuteButton() {
    if (this.isMuted) {
      this.muteButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
      this.muteButton.title = 'Включить звук';
    } else {
      this.muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
      this.muteButton.title = 'Выключить звук';
    }
  }

  updateVolume() {
    const mediaElement = this.getCurrentMediaElement();
    mediaElement.volume = this.isMuted ? 0 : this.currentVolume;
    this.volumeSlider.value = this.currentVolume;
    StorageUtils.setItem('radioVolume', this.currentVolume);

    logger.debug('Volume update', {
      volume: mediaElement.volume,
      currentVolume: this.currentVolume,
      isMuted: this.isMuted,
      sliderValue: this.volumeSlider.value,
    });
  }

  updateStatusIndicators(networkState) {
    const mediaElement = this.getCurrentMediaElement();
    this.playStatus.classList.toggle('playing', this.hls && !mediaElement.paused);
    this.playStatus.classList.toggle('muted', !(this.hls && !mediaElement.paused));

    this.soundStatus.classList.toggle('muted', this.isMuted);
    this.soundStatus.classList.toggle('playing', !this.isMuted);

    const networkStatusText = this.networkStatus.querySelector('.status-text');
    this.networkStatus.classList.remove('playing', 'muted', 'warning');

    switch (networkState) {
      case 'buffering':
        this.networkStatus.classList.add('warning');
        networkStatusText.textContent = 'Буферизация...';
        break;
      case 'reconnecting':
        this.networkStatus.classList.add('warning');
        networkStatusText.textContent = 'Переподключение...';
        break;
      case 'playing':
        this.networkStatus.classList.add('playing');
        networkStatusText.textContent = 'В сети';
        break;
      case 'offline':
      default:
        this.networkStatus.classList.add('muted');
        networkStatusText.textContent = 'Офлайн';
        break;
    }
  }

  togglePlayback() {
    if (!this.getCurrentMediaElement()) {
      logger.error('Audio/video element not found');
      return;
    }

    if (this.isStoppingPlayback) {
      logger.warn('Playback stop in progress, ignoring toggle request');
      return;
    }

    if (!this.hls) {
      this.startPlaybackOptimized();
    } else {
      this.stopPlayback();
    }
  }

  startPlaybackOptimized() {
    logger.info('Starting playback (optimized)');

    if (this.isIOS || (window.Hls && window.Hls.isSupported())) {
      logger.info(
        this.isIOS ? 'iOS detected - using HLS.js playback with video element' : 'Using HLS.js playback',
      );
      this.startPlaybackHLSJS();
    } else {
      logger.error('No compatible playback method found');
      showToast('Ваш браузер не поддерживает воспроизведение HLS');
    }
  }

  startPlaybackHLSJS() {
    if (this.hls) {
      this.stopPlayback();
    }
    this.isBuffering = true;
    this.updatePlayButton();
    this.updateStatusIndicators('buffering');

    try {
      if (!window.Hls || !window.Hls.isSupported()) {
        logger.error('HLS.js is not supported in this browser');
        showToast('Ваш браузер не поддерживает HLS. Попробуйте другой браузер.');
        return;
      }

      this.hls = new window.Hls(this.hlsConfig);
      logger.info('HLS instance created');

      try {
        this.hls.loadSource(this.streamUrl);
        logger.info('Loading stream', { url: this.streamUrl });
      } catch (sourceError) {
        logger.error('Failed to load HLS source', {
          error: sourceError.message,
          streamUrl: this.streamUrl,
        });
        showToast('Ошибка загрузки потока. Проверьте подключение к интернету.');
        this.handleFatalError();
        return;
      }

      try {
        const mediaElement = this.getCurrentMediaElement();
        this.hls.attachMedia(mediaElement);
        logger.info('Media attached to ' + (this.isIOS ? 'video' : 'audio') + ' element');
      } catch (attachError) {
        logger.error('Failed to attach media to ' + (this.isIOS ? 'video' : 'audio') + ' element', {
          error: attachError.message,
        });
        showToast('Ошибка подключения аудиоустройства.');
        this.handleFatalError();
        return;
      }

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        logger.info('Manifest parsed successfully');
        const mediaElement = this.getCurrentMediaElement();
        mediaElement
          .play()
          .then(() => {
            logger.info('Playback started');
            this.updateStatusIndicators('playing');
            this.resetRetryCounts();
          })
          .catch((error) => {
            logger.error('Play error', error);
            if (error.name === 'NotAllowedError') {
              logger.warn('User interaction required for autoplay');
              this.updateStatusIndicators('offline');
              this.playButton.innerHTML = 'Нажмите для старта';
            } else {
              this.handleFatalError();
            }
          });
      });

      this.hls.on(window.Hls.Events.ERROR, (event, data) => {
        logger.error('HLS Error', {
          fatal: data.fatal,
          type: data.type,
          details: data.details,
          error: data.error,
        });

        if (data.fatal) {
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            logger.error('Network error detected');
            showToast(`Нет интернета. Проверьте подключение к интернету.`);
          }
          this.handleFatalError();
        } else if (
          data.type === window.Hls.ErrorTypes.MEDIA_ERROR &&
          data.details === window.Hls.ErrorDetails.BUFFER_STALLED_ERROR
        ) {
          logger.warn('Buffer stalled, recovering...');
          this.handleBufferStall();
        } else {
          logger.warn('Non-fatal HLS error, continuing...', data);
        }
      });

      this.removeAllEventListeners();

      const mediaElement = this.getCurrentMediaElement();
      mediaElement.addEventListener('pause', this.handlePause.bind(this));
      mediaElement.addEventListener('play', this.handlePlay.bind(this));
      mediaElement.addEventListener('waiting', this.handleWaiting.bind(this));
      mediaElement.addEventListener('canplay', this.handleCanPlay.bind(this));

      logger.info('All HLS.js event handlers attached');
    } catch (error) {
      logger.error('Error during HLS.js setup', {
        message: error.message,
        stack: error.stack,
      });
      showToast('Ошибка инициализации HLS. Попробуйте обновить страницу.');
    }
  }

  removeAllEventListeners() {
    const mediaElement = this.getCurrentMediaElement();
    mediaElement.removeEventListener('pause', this.handlePause.bind(this));
    mediaElement.removeEventListener('play', this.handlePlay.bind(this));
    mediaElement.removeEventListener('waiting', this.handleWaiting.bind(this));
    mediaElement.removeEventListener('canplay', this.handleCanPlay.bind(this));
    mediaElement.removeEventListener('playing', this.handlePlaying.bind(this));
    mediaElement.removeEventListener('error', this.handleMediaError.bind(this));
    mediaElement.removeEventListener('loadstart', this.handleLoadStart.bind(this));
  }

  removeGlobalEventListeners() {
    if (this.eventHandlers.togglePlayback) {
      this.playButton.removeEventListener('click', this.eventHandlers.togglePlayback);
    }
    if (this.eventHandlers.toggleMute) {
      this.muteButton.removeEventListener('click', this.eventHandlers.toggleMute);
    }
    if (this.eventHandlers.handleVolumeChange) {
      this.volumeSlider.removeEventListener('input', this.eventHandlers.handleVolumeChange);
    }
    if (this.eventHandlers.handleOnline) {
      window.removeEventListener('online', this.eventHandlers.handleOnline);
    }
    if (this.eventHandlers.handleOffline) {
      window.removeEventListener('offline', this.eventHandlers.handleOffline);
    }
  }

  stopPlayback() {
    logger.info('Stopping playback');
    this.isBuffering = false;
    this.isStoppingPlayback = true;
    clearTimeout(this.retryTimeout);

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    this.removeAllEventListeners();

    if (this.eventHandlers.handleOnline) {
      window.removeEventListener('online', this.eventHandlers.handleOnline);
    }
    if (this.eventHandlers.handleOffline) {
      window.removeEventListener('offline', this.eventHandlers.handleOffline);
    }

    const mediaElement = this.getCurrentMediaElement();
    mediaElement.pause();
    mediaElement.src = '';
    this.updatePlayButton();
    this.updateStatusIndicators('offline');
    this.resetRetryCounts();

    setTimeout(() => {
      this.isStoppingPlayback = false;
    }, 500);

    this.fatalRetryCount = 0;
    this.nonFatalRetryCount = 0;
  }

  handlePause() {
    this.updatePlayButton();
    const mediaElement = this.getCurrentMediaElement();
    if (!this.hls) {
      this.updateStatusIndicators('offline');
    } else if (this.isBuffering) {
      this.updateStatusIndicators('buffering');
    } else {
      this.updateStatusIndicators('offline');
    }
  }

  handlePlay() {
    this.updatePlayButton();
    const mediaElement = this.getCurrentMediaElement();
    if (!mediaElement.waiting) {
      this.updateStatusIndicators('playing');
    }
    this.resetRetryCounts();
  }

  handleWaiting() {
    this.isBuffering = true;
    this.updatePlayButton();
    this.updateStatusIndicators('buffering');
  }

  handleCanPlay() {
    this.isBuffering = false;
    this.updatePlayButton();
    const mediaElement = this.getCurrentMediaElement();
    if (!mediaElement.paused) {
      this.updateStatusIndicators('playing');
    }
  }

  handlePlaying() {
    logger.info('handlePlaying triggered');
    this.isBuffering = false;
    this.updatePlayButton();
    const mediaElement = this.getCurrentMediaElement();
    if (!mediaElement.paused) {
      this.updateStatusIndicators('playing');
    }
  }

  handleMediaError() {
    if (this.isStoppingPlayback) {
      logger.debug('Media error ignored: stopping playback');
      return;
    }

    const mediaElement = this.getCurrentMediaElement();
    logger.error('Media error detected', {
      errorCode: mediaElement.error?.code,
      errorMessage: mediaElement.error?.message,
    });

    switch (mediaElement.error?.code) {
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

    this.handleFatalError();
  }

  handleLoadStart() {
    logger.info('Audio/video element: loadstart');
  }

  handleBufferStall() {
    if (!this.hls) {
      return;
    }
    this.isBuffering = true;
    this.updatePlayButton();
    this.nonFatalRetryCount++;
    this.updateStatusIndicators('buffering');

    if (this.nonFatalRetryCount > this.maxNonFatalRetries) {
      showToast(`Превышен лимит попыток восстановления буфера. Запуск фатального восстановления.`);
      this.handleFatalError();
      return;
    }

    if (this.hls) {
      this.hls.startLoad();
    }
  }

  handleFatalError() {
    if (this.isStoppingPlayback || !this.hls) {
      return;
    }

    if (this.fatalRetryCount >= this.maxFatalRetries) {
      logger.warn('Превышено максимальное количество попыток восстановления. Останавливаем попытки.');
      showToast('Ошибка подключения к потоку. Проверьте интернет соединение.');
      this.stopPlayback();
      return;
    }

    this.fatalRetryCount++;
    const maxDelay = 30000;
    const delay = Math.min(Math.pow(2, this.fatalRetryCount) * 1000, maxDelay);

    this.updateStatusIndicators('reconnecting');

    clearTimeout(this.retryTimeout);
    this.retryTimeout = setTimeout(() => {
      if (!this.hls) {
        return;
      }

      logger.info('Попытка переподключения', { attempt: this.fatalRetryCount });

      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
      this.startPlaybackOptimized();
    }, delay);
  }

  resetRetryCounts() {
    this.fatalRetryCount = 0;
    this.nonFatalRetryCount = 0;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    StorageUtils.setItem('radioMuted', this.isMuted);
    this.updateVolume();
    this.updateMuteButton();

    logger.debug('Mute toggled', { isMuted: this.isMuted });
    const mediaElement = this.getCurrentMediaElement();
    this.updateStatusIndicators(this.hls && !mediaElement.paused ? 'playing' : 'offline');
  }

  setVolume(volume) {
    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
      logger.warn('Invalid volume value', { volume, expected: 'number between 0 and 1' });
      return;
    }

    const mediaElement = this.getCurrentMediaElement();
    const wasPlaying = !mediaElement.paused;
    this.isMuted = false;
    this.currentVolume = volume;
    StorageUtils.setItem('radioVolume', volume);
    this.updateVolume();
    this.updateMuteButton();
    logger.debug('Volume set', { volume: volume, wasPlaying });

    if (wasPlaying && mediaElement.paused && this.hls) {
      mediaElement.play().catch((err) => {
        logger.warn('Could not resume playback after volume change', {
          error: err.message,
          name: err.name,
        });
      });
    }
    this.updateStatusIndicators(this.hls && !mediaElement.paused ? 'playing' : 'offline');
  }

  handleVolumeChange(e) {
    if (!e || !e.target || typeof e.target.value === 'undefined') {
      logger.warn('Invalid volume change event', { event: e });
      return;
    }

    const volumeValue = parseFloat(e.target.value);
    this.setVolume(volumeValue);
  }

  handleOnline() {
    const mediaElement = this.getCurrentMediaElement();
    this.updateStatusIndicators(this.hls && !mediaElement.paused ? 'playing' : 'offline');
  }

  handleOffline() {
    this.updateStatusIndicators('offline');
    if (this.hls) {
      showToast('Интернет пропал. Воспроизведение остановлено.');
      this.handleFatalError();
    }
  }
}

export default RadioPlayer;
