(() => {
  'use strict';
  const API = 'https://xyuwqccmqggoctprbhzb.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_RHnLnO4J-PdXnPhLQUHeXg_9vJjjzCx';
  const $ = (selector, root = document) => root.querySelector(selector);
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  };
  const session = () => {
    try { return JSON.parse(localStorage.getItem('dropfly-supabase-session') || 'null'); }
    catch { return null; }
  };
  async function api(table, query, method = 'GET', data) {
    const token = session()?.access_token;
    if (!token) throw Error('سجل الدخول لعرض الإشعارات');
    const response = await fetch(API + table + (query ? '?' + query : ''), {
      method, headers: { apikey: KEY, Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    if (!response.ok) throw Error('تعذر تحديث الإشعارات');
    return method === 'GET' ? response.json() : null;
  }
  const kindIcon = kind => ({ support: '💬', payout_request: '💰', payout: '💸',
    order_status: '📦', new_order: '🛍', account_status: '✓', admin_message: '✉' })[kind] || '🔔';
  function formatTime(value) {
    const time = Date.parse(value); if (!Number.isFinite(time)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return 'قبل ' + minutes + ' دقيقة';
    if (minutes < 1440) return 'قبل ' + Math.floor(minutes / 60) + ' ساعة';
    return new Date(time).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' });
  }

  function merchantPanel(panel) {
    if (panel.dataset.dfEnhanced) return;
    panel.dataset.dfEnhanced = '1'; panel.dir = 'rtl';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'الإشعارات');
    const toolbar = el('div', 'df-notice-toolbar');
    const all = el('button', 'is-active', 'الكل');
    const unread = el('button', '', 'غير المقروءة');
    all.type = unread.type = 'button';
    function filter(mode) {
      panel.classList.toggle('df-unread-only', mode === 'unread');
      all.classList.toggle('is-active', mode === 'all');
      unread.classList.toggle('is-active', mode === 'unread');
      all.setAttribute('aria-pressed', String(mode === 'all'));
      unread.setAttribute('aria-pressed', String(mode === 'unread'));
      panel.querySelector('.df-unread-empty')?.remove();
      if (mode === 'unread' && !panel.querySelector('article:not(.read)'))
        panel.append(el('p', 'df-unread-empty', 'كل الإشعارات مقروءة ✓'));
    }
    all.onclick = () => filter('all'); unread.onclick = () => filter('unread');
    toolbar.append(all, unread); panel.insertBefore(toolbar, panel.children[1] || null);
    filter('all');
  }

  let adminBusy = false;
  async function adminInbox(panel) {
    const box = $('#df-admin-notices', panel);
    if (!box || adminBusy || document.hidden) return;
    adminBusy = true;
    try {
      const currentUser = session()?.user?.id;
      const [rows, receipts] = await Promise.all([
        api('wholesale_notifications',
          'select=id,title,body,message,kind,entity_id,created_at&recipient_role=eq.admin&order=created_at.desc&limit=40'),
        api('wholesale_notification_receipts',
          'select=notification_id,read_at&user_id=eq.' + encodeURIComponent(currentUser) + '&limit=300')
      ]);
      const readIds = new Set(receipts.filter(item => item.read_at).map(item => item.notification_id));
      rows.forEach(row => { row.is_read = readIds.has(row.id); });
      if (!box.isConnected) return;
      const unread = rows.filter(row => !row.is_read).length;
      $('h3', box).textContent = 'الإشعارات المحفوظة' + (unread ? ' • ' + unread + ' جديدة' : '');
      const list = $('.df-admin-notice-list', box); list.replaceChildren();
      if (!rows.length) { list.append(el('p', 'df-notice-empty', 'ماكو إشعارات حالياً')); return; }
      for (const row of rows) {
        const button = el('button', 'df-admin-notice' + (row.is_read ? ' is-read' : ''));
        button.type = 'button';
        button.append(el('span', 'df-notice-kind', kindIcon(row.kind)));
        const content = el('span', 'df-notice-content');
        content.append(el('strong', '', row.title || 'إشعار جديد'),
          el('span', '', row.body || row.message || ''),
          el('small', '', formatTime(row.created_at)));
        button.append(content);
        button.onclick = async () => {
          if (!row.is_read) {
            const receipt = { notification_id: row.id, user_id: currentUser, read_at: new Date().toISOString() };
            try { await api('wholesale_notification_receipts', '', 'POST', receipt).catch(() =>
              api('wholesale_notification_receipts', 'notification_id=eq.' + encodeURIComponent(row.id) +
                '&user_id=eq.' + encodeURIComponent(currentUser), 'PATCH', { read_at: receipt.read_at }));
              row.is_read = true; button.classList.add('is-read');
              adminInbox(panel);
            } catch { /* Keep the unread indicator if saving fails. */ }
          }
          if (row.kind === 'support') $('.admin-header nav button:nth-child(5)')?.click();
          else if (row.kind === 'payout_request' || row.kind === 'payout') $('.admin-header nav button:nth-child(4)')?.click();
          else if (row.kind === 'new_order' || row.kind === 'order_status') $('.admin-header nav button:nth-child(2)')?.click();
          if (row.kind === 'support' || row.kind === 'payout_request' || row.kind === 'new_order' || row.kind === 'order_status')
            $('.admin-header .notify')?.click();
        };
        list.append(button);
      }
    } catch {
      if (box.isConnected) $('.df-admin-notice-list', box).replaceChildren(el('p', 'df-notice-empty', 'تعذر تحميل الإشعارات. حاول مرة ثانية.'));
    } finally { adminBusy = false; }
  }
  function enhanceAdmin(panel) {
    if (panel.dataset.dfEnhanced) return;
    panel.dataset.dfEnhanced = '1'; panel.dir = 'rtl';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'إشعارات الإدارة');
    const box = el('section', 'df-admin-notices'); box.id = 'df-admin-notices';
    box.append(el('h3', '', 'الإشعارات المحفوظة'), el('div', 'df-admin-notice-list'));
    const refresh = el('button', 'df-refresh-notices', 'تحديث الإشعارات'); refresh.type = 'button';
    refresh.onclick = () => adminInbox(panel);
    box.append(refresh); panel.append(box); adminInbox(panel);
  }
  let queued = false;
  function scan() {
    queued = false;
    const merchant = $('.merchant-app .notify-panel'); if (merchant) merchantPanel(merchant);
    const admin = $('.admin .admin-notify-panel'); if (admin) enhanceAdmin(admin);
  }
  new MutationObserver(() => {
    if (queued) return;
    queued = true; requestAnimationFrame(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('pointerdown', event => {
    if ($('.merchant-app .notify-panel') && !event.target.closest('.notify-panel,.merchant-app .notify,.df-notification-settings'))
      $('.merchant-app .notify')?.click();
    if ($('.admin .admin-notify-panel') && !event.target.closest('.admin-notify-panel,.admin-header .notify'))
      $('.admin-header .notify')?.click();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('.merchant-app .notify-panel')) $('.merchant-app .notify')?.click();
    if ($('.admin .admin-notify-panel')) $('.admin-header .notify')?.click();
  });
  setInterval(() => {
    const panel = $('.admin .admin-notify-panel'); if (panel) adminInbox(panel);
  }, 16000);
  scan();
})();
