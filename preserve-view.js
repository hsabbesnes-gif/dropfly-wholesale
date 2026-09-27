(() => {
  'use strict';
  const VIEW_KEY = 'dropfly-current-view-v1';
  const session = () => { try { return JSON.parse(localStorage.getItem('dropfly-supabase-session') || 'null'); } catch { return null; } };
  const kind = () => document.querySelector('.admin') ? 'admin' : document.querySelector('.merchant-app') ? 'merchant' : '';
  const nav = type => type === 'admin' ? document.querySelector('.admin-header nav') : type === 'merchant' ? document.querySelector('.merchant-app .app-nav') : null;
  const page = (button, type) => {
    const label = (button?.innerText || button?.textContent || '').replace(/\s+/g, ' ').trim();
    if (type === 'admin') return /الرئيسية/.test(label) ? 'home' : /الطلبات/.test(label) ? 'orders' : /التجار/.test(label) ? 'merchants' : /الحسابات/.test(label) ? 'accounts' : /الدعم/.test(label) ? 'support' : '';
    return /الطلبات/.test(label) ? 'orders' : /المجهزة/.test(label) ? 'prepared' : /الحسابات/.test(label) ? 'accounts' : /الدعم/.test(label) ? 'support' : '';
  };
  const key = type => VIEW_KEY + ':' + type + ':' + (session()?.user?.id || 'guest');
  const scrollKey = type => key(type) + ':scroll';
  let scope = '', restoredScroll = false, restoring = false, scrollTimer;
  try { history.scrollRestoration = 'manual'; } catch {}
  const saveScroll = () => { const type = kind(); if (!type || !nav(type)) return; try { sessionStorage.setItem(scrollKey(type), String(window.scrollY || document.scrollingElement?.scrollTop || 0)); } catch {} };
  const saveView = button => { const type = kind(), selected = page(button, type); if (!selected) return; try { localStorage.setItem(key(type), JSON.stringify({ page: selected })); sessionStorage.setItem(scrollKey(type), '0'); } catch {} window.scrollTo({ top: 0, behavior: 'instant' }); };
  const restore = () => {
    const type = kind(), menu = nav(type); if (!type || !menu) return;
    const activeKey = key(type); if (scope !== activeKey) { scope = activeKey; restoredScroll = false; }
    let saved; try { saved = JSON.parse(localStorage.getItem(activeKey) || 'null'); } catch {}
    if (!saved?.page) return;
    const buttons = [...menu.querySelectorAll('button')];
    const active = buttons.find(button => button.classList.contains('active') || button.getAttribute('aria-current') === 'page');
    const target = buttons.find(button => page(button, type) === saved.page);
    if (target && page(active, type) !== saved.page) { restoring = true; target.click(); setTimeout(() => { restoring = false; }, 0); return; }
    if (page(active, type) !== saved.page || restoredScroll) return;
    restoredScroll = true;
    let top = 0; try { top = Number(sessionStorage.getItem(scrollKey(type)) || 0); } catch {}
    if (top > 0) { let tries = 0; const apply = () => { window.scrollTo({ top, behavior: 'instant' }); if (++tries < 12 && window.scrollY + 4 < top) setTimeout(apply, 180); }; setTimeout(apply, 180); }
  };
  document.addEventListener('click', event => { const button = event.target.closest?.('.admin-header nav button, .merchant-app .app-nav button'); if (button && !restoring) saveView(button); }, true);
  window.addEventListener('pagehide', saveScroll);
  window.addEventListener('beforeunload', saveScroll);
  window.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveScroll, 120); }, { passive: true });
  new MutationObserver(restore).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
  restore();
})();
