// В этом файле мы гарантируем, что глобальные переменные будут доступны
// перед тем, как другие модули начнут использовать их

// Импортируем и устанавливаем глобальные функции
import './utils.js';
import './global-functions.js';

// Импортируем логгер и делаем его глобальным
import './loging.js';

// Теперь, когда все глобальные переменные установлены, можно импортировать и инициализировать приложение
import App from './App.js';

let appInitialized = false;

// Функция для инициализации приложения
function initializeApp() {
  if (!appInitialized) {
    appInitialized = true;
    new App();
  }
}

// Убедитесь, что DOM полностью загружен перед инициализацией приложения
if (document.readyState === 'loading') {
  // Если документ еще загружается, ждем события DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // Если документ уже загружен, инициализируем сразу
  initializeApp();
}