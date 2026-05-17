class VideoPlayer {
  constructor() {
    this.videoContainer = document.querySelector('.video');
    this.isActive = false;
    this.iframe = null;
  }

  /**
   * Открывает контейнер для видео
   */
  openVideoContainer() {
    if (this.videoContainer && this.videoContainer.classList.contains('visibal')) {
      this.closeVideo();

      this.iframe = document.createElement('iframe');
      this.iframe.src = 'https://vk.com/video_ext.php?oid=-383476&id=456247029&hash=a3a0d805faa5d04c';
      this.iframe.className = 'video-iframe';
      this.iframe.style.backgroundColor = '#000';
      this.iframe.style.borderWidth = '1px';
      this.iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';

      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-wrapper';
      videoWrapper.appendChild(this.iframe);

      if (this.videoContainer) {
        this.videoContainer.appendChild(videoWrapper);
        this.isActive = true;
      } else {
        console.warn('Video container not found');
      }
    } else {
      this.closeVideo();
    }
  }

  closeVideo() {
    if (this.iframe) {
      try {
        this.iframe.contentWindow.postMessage({ type: 'stop' }, '*');
      } catch {}

      this.iframe.src = 'about:blank'; 

      const wrapper = this.iframe.parentNode;
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      } else if (this.iframe.parentNode) {
        this.iframe.parentNode.removeChild(this.iframe);
      }

      this.iframe = null;
    } else if (this.videoContainer) {
      this.videoContainer.innerHTML = '';
    }
    this.isActive = false;
  }
}

export default VideoPlayer;
