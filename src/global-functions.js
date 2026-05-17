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

window.showToast = showToast;

if (typeof window.logger === 'undefined') {
  window.logger = null; 
}

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
