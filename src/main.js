import './utils.js';
import './global-functions.js';

import './loging.js';

import App from './App.js';

let appInitialized = false;

function initializeApp() {
  if (!appInitialized) {
    appInitialized = true;
    new App();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}