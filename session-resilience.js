(() => {
  'use strict';
  const sessionKey = 'dropfly-supabase-session';
  const backendHost = 'xyuwqccmqggoctprbhzb.supabase.co';
  const retryKey = 'dropfly-auth-retry-count';
  let transientAt = 0, authRejectedAt = 0, logoutUntil = 0;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    let url = '';
    try { const request = args[0]; url = typeof request === 'string' ? request : request?.url || ''; } catch {}
    const backend = url.includes(backendHost);
    try {
      const response = await nativeFetch(...args);
      if (backend && (response.status === 429 || response.status >= 500)) transientAt = Date.now();
      if (url.includes('/rest/v1/wholesale_profiles') && [401, 403, 404, 406].includes(response.status)) authRejectedAt = Date.now();
      return response;
    } catch (error) { if (backend) transientAt = Date.now(); throw error; }
  };
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button, [role="button"]');
    const label = (button?.innerText || '') + ' ' + (button?.getAttribute('aria-label') || '') + ' ' + (button?.className || '');
    if (/تسجيل\s*الخروج|logout/i.test(label)) logoutUntil = Date.now() + 5000;
  }, true);
  const nativeRemove = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function (key) {
    const now = Date.now();
    const recentTransient = now - transientAt < 30000;
    if (this === window.localStorage && key === sessionKey && recentTransient && authRejectedAt <= transientAt && now >= logoutUntil) {
      try {
        const count = Number(sessionStorage.getItem(retryKey) || 0);
        if (count < 2) { sessionStorage.setItem(retryKey, String(count + 1)); setTimeout(() => location.reload(), 1200); }
      } catch {}
      return;
    }
    return nativeRemove.call(this, key);
  };
  const observer = new MutationObserver(() => {
    if (document.querySelector('.admin, .merchant-app')) {
      try { sessionStorage.removeItem(retryKey); } catch {}
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
