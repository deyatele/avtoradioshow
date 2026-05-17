import RadioPlayer from './RadioPlayer.js';
import VideoPlayer from './VideoPlayer.js';
import { loadSong } from './songList.js';

import { StorageUtils, PlatformUtils } from './utils.js';

class App {
  constructor() {
    this.toggleList = document.querySelectorAll('.toggle-button');
    this.radioToggle = this.toggleList[0];
    this.videoToggle = this.toggleList[1];
    this.players = document.querySelectorAll('.player');
    this.radioPlayerContainer = this.players[0];
    this.videoPlayerContainer = this.players[1];

    this.activePlayer = StorageUtils.getItem('toggelePlayer', 'radio');

    this.radioPlayer = null;
    this.videoPlayer = null;

    this.eventHandlers = {};

    this.init();
  }

  init() {
    logger.info('INIT:Initializing application');
    this.eventHandlers.changePlayer = (e) => this.changePlayer(e);
    this.eventHandlers.keydownHandler = (e) => this.handleKeyDown(e);

    if (!this.toggleList || this.toggleList.length === 0) {
      logger.error('Toggle buttons not found');
      return;
    }

    this.toggleList.forEach((toggle, index) => {
      toggle.addEventListener('click', this.eventHandlers.changePlayer);
      toggle.addEventListener('keydown', this.eventHandlers.keydownHandler);

      if (index === 0) {
        toggle.tabIndex = 0;
      } else {
        toggle.tabIndex = -1;
      }
    });

    this.radioPlayer = new RadioPlayer();
    this.videoPlayer = new VideoPlayer();

    this.updatePlayerView();

    logger.info('Application initialized successfully', {
      activePlayer: this.activePlayer,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      onLine: navigator.onLine,
    });

    setInterval(() => loadSong(), 60000);
  }

  handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.target.click();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const currentIndex = Array.from(this.toggleList).indexOf(e.target);
      let nextIndex;

      if (e.key === 'ArrowLeft') {
        nextIndex = currentIndex === 0 ? this.toggleList.length - 1 : currentIndex - 1;
      } else {
        // ArrowRight
        nextIndex = currentIndex === this.toggleList.length - 1 ? 0 : currentIndex + 1;
      }

      e.target.setAttribute('tabindex', '-1');

      const nextElement = this.toggleList[nextIndex];
      nextElement.setAttribute('tabindex', '0');
      nextElement.focus();
      nextElement.click();
    }
  }

  changePlayer(e) {
    if (this.activePlayer === 'video' && e.target.dataset.player === 'radio') {
      this.videoPlayer.closeVideo();
    }

    if (this.activePlayer === 'radio' && e.target.dataset.player === 'video') {
      if (this.radioPlayer && this.radioPlayer.hls && !this.radioPlayer.radioPlayer.paused) {
        this.radioPlayer.togglePlayback();
      }
    }

    const prevPlayer = this.activePlayer;

    this.activePlayer = e.target.dataset.player;
    StorageUtils.setItem('toggelePlayer', this.activePlayer);
    this.updatePlayerView();

    logger.info('Player changed', {
      prevPlayer: prevPlayer,
      activePlayer: this.activePlayer,
    });
  }

  updatePlayerView() {
    if (this.activePlayer === 'radio') {
      this.radioToggle.setAttribute('aria-selected', 'true');
      this.radioToggle.setAttribute('tabindex', '0');
      this.videoToggle.setAttribute('aria-selected', 'false');
      this.videoToggle.setAttribute('tabindex', '-1');

      this.radioToggle.classList.add('active-toggle');
      this.videoToggle.classList.remove('active-toggle');
      this.videoPlayerContainer.classList.remove('visibal');
      this.radioPlayerContainer.classList.remove('hidden');
      this.radioPlayerContainer.classList.add('visibal');
      this.videoPlayerContainer.classList.add('hidden');

      logger.info('Switched to radio player', {
        activePlayer: this.activePlayer,
      });
    } else {
      this.videoToggle.setAttribute('aria-selected', 'true');
      this.videoToggle.setAttribute('tabindex', '0');
      this.radioToggle.setAttribute('aria-selected', 'false');
      this.radioToggle.setAttribute('tabindex', '-1');

      this.radioToggle.classList.remove('active-toggle');
      this.videoToggle.classList.add('active-toggle');
      this.radioPlayerContainer.classList.remove('visibal');
      this.videoPlayerContainer.classList.remove('hidden');
      this.videoPlayerContainer.classList.add('visibal');
      this.radioPlayerContainer.classList.add('hidden');

      // Открываем видео, если оно стало активным
      this.videoPlayer.openVideoContainer();

      logger.info('Switched to video player', {
        activePlayer: this.activePlayer,
      });
    }
  }

  checkVolumeStatus() {
    const info = {
      platform: navigator.userAgent,
      isIOS: typeof PlatformUtils !== 'undefined' ? PlatformUtils.isIOS() : 'unknown',
      isNativePlayback: 'deprecated',
      currentVolume: this.radioPlayer ? this.radioPlayer.currentVolume : 'unknown',
      isMuted: this.radioPlayer ? this.radioPlayer.isMuted : 'unknown',
      audioVolume: this.radioPlayer?.radioPlayer ? this.radioPlayer.radioPlayer.volume : 'unknown',
      audioMuted: this.radioPlayer?.radioPlayer ? this.radioPlayer.radioPlayer.muted : 'unknown',
      sliderValue: this.radioPlayer?.volumeSlider ? this.radioPlayer.volumeSlider.value : 'unknown',
      message:
        'На iPhone громкость управляется кнопками на боку устройства (Side keys). Веб-ползунок только для интерфейса.',
    };
    console.table(info);
    return info;
  }

  checkSWStatus() {
    if ('serviceWorker' in navigator) {
      return navigator.serviceWorker.ready
        .then((registration) => {
          const info = {
            controller: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : 'none',
            activeWorker: registration.active ? registration.active.scriptURL : 'none',
            scope: registration.scope,
            updateViaCache: registration.updateViaCache,
            waitingWorker: registration.waiting ? registration.waiting.scriptURL : 'none',
            installingWorker: registration.installing ? registration.installing.scriptURL : 'none',
          };
          console.table(info);
          logger.info('Service Worker status checked', info);
          return info;
        })
        .catch((error) => {
          logger.error('Error checking SW status', error);
          return { error: error.message };
        });
    } else {
      console.log('Service Worker не поддерживается');
      return { error: 'Service Worker не поддерживается' };
    }
  }

  destroy() {
    this.toggleList.forEach((toggle) => {
      toggle.removeEventListener('click', this.eventHandlers.changePlayer);
      toggle.removeEventListener('keydown', this.eventHandlers.keydownHandler);
    });

    if (this.videoPlayer) {
      this.videoPlayer.closeVideo();
    }

    if (this.radioPlayer) {
      if (this.radioPlayer.hls && !this.radioPlayer.radioPlayer.paused) {
        this.radioPlayer.stopPlayback();
      }
    }
  }
}

export default App;
