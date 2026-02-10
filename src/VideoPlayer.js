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
      // Очищаем контейнер перед добавлением нового iframe
      this.closeVideo();

      this.iframe = document.createElement('iframe');
      this.iframe.src = 'https://vk.com/video_ext.php?oid=-383476&id=456247029&hash=a3a0d805faa5d04c';
      this.iframe.className = 'video-iframe';
      this.iframe.style.backgroundColor = '#000';
      this.iframe.style.borderWidth = '1px';
      this.iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';

      // Создаем обертку для адаптивного видео
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-wrapper';
      videoWrapper.appendChild(this.iframe);

      // Проверяем, что контейнер существует перед добавлением
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

  /**
   * Закрывает видео и освобождает ресурсы
   */
  closeVideo() {
    if (this.iframe) {
      // Останавливаем воспроизведение внутри iframe
      try {
        this.iframe.contentWindow.postMessage({ type: 'stop' }, '*');
      } catch (e) {
        // Игнорируем ошибки при отправке сообщения в iframe другого домена
      }

      // Удаляем iframe и освобождаем ресурсы
      this.iframe.src = 'about:blank'; // Очищаем источник перед удалением

      // Находим родительский элемент (обертку) и удаляем его
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
