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
        'Content-Type': 'application/json', Prefer: method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal' },
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
  const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  async function waitFor(selector, timeout = 3500) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const node = $(selector); if (node) return node;
      await new Promise(resolve => setTimeout(resolve, 70));
    }
    return null;
  }
  function setInput(input, value) {
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  async function markOne(id) {
    if (!uuid(id)) return;
    const userId = session()?.user?.id;
    if (!userId) throw Error('سجل الدخول مجدداً');
    const read_at = new Date().toISOString();
    await api('wholesale_notification_receipts',
      'on_conflict=notification_id,user_id', 'POST', { notification_id: id, user_id: userId, read_at })
      .catch(() => api('wholesale_notification_receipts',
        'notification_id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + encodeURIComponent(userId),
        'PATCH', { read_at }));
  }
  async function allNoticeIds(admin) {
    const userId = session()?.user?.id;
    if (!userId) throw Error('سجل الدخول مجدداً');
    const ids = [];
    for (let offset = 0; ; offset += 1000) {
      const filter = admin ? 'recipient_role=eq.admin' : 'recipient_id=eq.' + encodeURIComponent(userId);
      const rows = await api('wholesale_notifications',
        'select=id&' + filter + '&order=created_at.desc&limit=1000&offset=' + offset);
      ids.push(...rows.map(row => row.id));
      if (rows.length < 1000) break;
    }
    return ids;
  }
  async function markAll(admin) {
    const userId = session()?.user?.id;
    const ids = await allNoticeIds(admin);
    const read_at = new Date().toISOString();
    for (let i = 0; i < ids.length; i += 100) {
      const records = ids.slice(i, i + 100).map(notification_id => ({ notification_id, user_id: userId, read_at }));
      await api('wholesale_notification_receipts', 'on_conflict=notification_id,user_id', 'POST', records)
        .catch(async () => { for (const record of records) await markOne(record.notification_id); });
    }
  }
  async function openOrder(entityId, kind) {
    if (!entityId && kind !== 'order' && kind !== 'late') return false;
    let number = /^DF-/i.test(entityId || '') ? entityId : '';
    let status = '';
    if (uuid(entityId)) {
      try {
        const rows = await api('wholesale_orders',
          'select=order_number,status&id=eq.' + encodeURIComponent(entityId) + '&limit=1');
        number = rows[0]?.order_number || '';
        status = rows[0]?.status || '';
      } catch { /* The order may have been removed after the notification was created. */ }
    }
    if ($('.merchant-app')) {
      const prepared = number && status !== 'قيد الانتظار' && status !== 'سيجهز غداً';
      const nav = [...document.querySelectorAll('.merchant-app .app-nav button')]
        .find(button => button.textContent.includes(prepared ? 'المجهزة' : 'الطلبات'));
      nav?.click(); await nextFrame();
      if (!number) return kind !== 'support';
      const search = await waitFor('.merchant-app .smart-search input');
      const field = $('.merchant-app .smart-search select');
      if (field && field.value !== 'id') { field.value = 'id'; field.dispatchEvent(new Event('change', { bubbles: true })); }
      const statusFilter = $('.merchant-app .df-prepared-filters select');
      if (statusFilter && statusFilter.value !== 'all') { statusFilter.value = 'all'; statusFilter.dispatchEvent(new Event('change', { bubbles: true })); }
      setInput(search, number); await nextFrame();
      const card = [...document.querySelectorAll('.merchant-app .order-grid .order')]
        .find(node => node.querySelector('.order-top b')?.textContent.trim() === number);
      card?.querySelector('.card-main')?.click();
      return !!card;
    }
    if ($('.admin')) {
      $('.admin-header nav button:nth-child(2)')?.click(); await nextFrame();
      if (!number) return kind !== 'support';
      const search = await waitFor('.admin-order-search input');
      const field = $('.admin-order-search select');
      if (field && field.value !== 'id') { field.value = 'id'; field.dispatchEvent(new Event('change', { bubbles: true })); }
      setInput(search, number); await nextFrame();
      const card = [...document.querySelectorAll('.admin-table.admin-full article[role="button"]')]
        .find(node => node.querySelector('b')?.textContent.startsWith(number + ' •'));
      card?.click();
      return !!card;
    }
    return false;
  }

  function merchantPanel(panel) {
    if (panel.dataset.dfEnhanced) return;
    panel.dataset.dfEnhanced = '1'; panel.dir = 'rtl';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'الإشعارات');
    const toolbar = el('div', 'df-notice-toolbar');
    const all = el('button', 'is-active', 'الكل');
    const unread = el('button', '', 'غير المقروءة');
    const mark = el('button', 'df-mark-all', 'اعتبار الكل مقروء');
    all.type = unread.type = mark.type = 'button';
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
    mark.onclick = async () => {
      mark.disabled = true; mark.textContent = 'جارِ التحديث…';
      try {
        await markAll(false);
        const fresh = [...panel.querySelectorAll('article[data-notice-id="fresh"]')][0];
        const late = [...panel.querySelectorAll('article[data-notice-id="late"]')][0];
        if (fresh) sessionStorage.setItem('df-summary-read-fresh-' + (fresh.querySelector('p')?.textContent.match(/\d+/)?.[0] || ''), '1');
        if (late) sessionStorage.setItem('df-summary-read-late-' + (late.querySelector('p')?.textContent.match(/\d+/)?.[0] || ''), '1');
        panel.querySelectorAll('article').forEach(article => article.classList.add('read'));
        filter(panel.classList.contains('df-unread-only') ? 'unread' : 'all');
        mark.textContent = 'تم اعتبار الكل مقروء ✓';
      } catch { mark.textContent = 'تعذر التحديث، حاول مرة ثانية'; }
      finally { mark.disabled = false; }
    };
    toolbar.append(all, unread, mark); panel.insertBefore(toolbar, panel.children[1] || null);
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
            try { await markOne(row.id);
              row.is_read = true; button.classList.add('is-read');
            } catch { /* Keep the unread indicator if saving fails. */ }
          }
          if (row.kind === 'new_order' || row.kind === 'order_status') {
            $('.admin-header .notify')?.click();
            await openOrder(row.entity_id, row.kind);
          } else if (row.kind === 'support') {
            $('.admin-header .notify')?.click();
            if (!await openOrder(row.entity_id, row.kind)) $('.admin-header nav button:nth-child(5)')?.click();
          } else if (row.kind === 'payout_request' || row.kind === 'payout') {
            $('.admin-header .notify')?.click(); $('.admin-header nav button:nth-child(4)')?.click();
          } else adminInbox(panel);
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
    const mark = el('button', 'df-mark-all-admin', 'اعتبار الكل مقروء'); mark.type = 'button';
    mark.onclick = async () => {
      mark.disabled = true; mark.textContent = 'جارِ التحديث…';
      try { await markAll(true); box.querySelectorAll('.df-admin-notice').forEach(item => item.classList.add('is-read'));
        await adminInbox(panel); mark.textContent = 'تم اعتبار الكل مقروء ✓'; }
      catch { mark.textContent = 'تعذر التحديث، حاول مرة ثانية'; }
      finally { mark.disabled = false; }
    };
    box.append(mark, refresh); panel.append(box); adminInbox(panel);
  }
  let queued = false;
  let openingDeepLink = false;
  function scan() {
    queued = false;
    const merchant = $('.merchant-app .notify-panel'); if (merchant) merchantPanel(merchant);
    const admin = $('.admin .admin-notify-panel'); if (admin) enhanceAdmin(admin);
    const match = location.hash.match(/^#order=([0-9a-f-]{36})$/i);
    if (match && !openingDeepLink && ($('.merchant-app') || $('.admin'))) {
      openingDeepLink = true;
      openOrder(match[1], 'order_status').finally(() => {
        if (location.hash === match[0]) history.replaceState(history.state, '', location.pathname + location.search);
        openingDeepLink = false;
      });
    }
  }
  new MutationObserver(() => {
    if (queued) return;
    queued = true; requestAnimationFrame(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', async event => {
    const article = event.target.closest('.merchant-app .notify-panel article[data-notice-id]');
    if (!article || event.target.closest('.notice-reply')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const { noticeId, entityId, noticeKind } = article.dataset;
    article.classList.add('read');
    if (noticeId === 'fresh' || noticeId === 'late') {
      const count = article.querySelector('p')?.textContent.match(/\d+/)?.[0] || '';
      sessionStorage.setItem('df-summary-read-' + noticeId + '-' + count, '1');
    } else {
      try { await markOne(noticeId); }
      catch { article.classList.remove('read'); return; }
    }
    $('.merchant-app .notify')?.click();
    if (noticeKind === 'payout' || noticeKind === 'payout_request')
      [...document.querySelectorAll('.merchant-app .app-nav button')].find(b => b.textContent.includes('الحسابات'))?.click();
    else if (noticeKind === 'new_order' || noticeKind === 'order_status' || noticeKind === 'support' || noticeId === 'fresh' || noticeId === 'late')
      await openOrder(entityId, noticeId === 'fresh' ? 'order' : noticeKind);
  }, true);
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
