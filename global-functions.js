// Глобальные функции, используемые в приложении

/**
 * Показывает всплывающее сообщение пользователю
 * @param {string} message - текст сообщения
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn('Toast element not found');
    return;
  }

  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Экспортируем функцию для использования в других модулях
window.showToast = showToast;

// Также экспортируем другие функции, которые могут использоваться
// как глобальные в различных частях приложения
if (typeof window.logger === 'undefined') {
  window.logger = null; // будет определен в loging.js
}

// Функции отладки, которые могут быть вызваны из консоли
if (typeof window.showRadioLogs === 'undefined') {
  window.showRadioLogs = () => {};
}
if (typeof window.downloadRadioLogs === 'undefined') {
  window.downloadRadioLogs = () => {};
}
if (typeof window.clearRadioLogs === 'undefined') {
  window.clearRadioLogs = () => {};
}
if (typeof window.getRadioLogs === 'undefined') {
  window.getRadioLogs = () => [];
}
