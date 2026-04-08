(function () {
  'use strict';

  const requiresAuth = document.body.dataset.protected === 'true';
  if (!requiresAuth) {
    return;
  }

  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.replace('index.html');
  }
})();
