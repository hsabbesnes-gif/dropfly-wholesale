(() => {
  'use strict';
  const base = 'https://xyuwqccmqggoctprbhzb.supabase.co';
  const key = 'sb_publishable_RHnLnO4J-PdXnPhLQUHeXg_9vJjjzCx';
  const money = value => Number(value || 0).toLocaleString('en-US') + ' د.ع';
  const $ = (selector, root = document) => root.querySelector(selector);
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  };
  const safeImage = value => /^https?:\/\//i.test(value || '') ? value : '';
  const session = () => { try { return JSON.parse(localStorage.getItem('dropfly-supabase-session') || 'null'); } catch { return null; } };
  async function api(table, query = '', options = {}) {
    const token = session()?.access_token;
    if (!token) throw new Error('يرجى تسجيل الدخول مجدداً');
    const response = await fetch(`${base}/rest/v1/${table}${query ? '?' + query : ''}`, {
      method: options.method || 'GET',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.method === 'POST' ? { Prefer: 'return=representation' } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const result = response.status === 204 ? [] : await response.json().catch(() => []);
    if (!response.ok) throw new Error(result?.message || result?.hint || 'تعذر الاتصال، حاول مجدداً');
    return result;
  }
  const copy = async (value, button) => {
    try { await navigator.clipboard.writeText(String(value || '')); button.textContent = 'تم النسخ ✓'; setTimeout(() => { button.textContent = 'نسخ'; }, 1600); }
    catch { button.textContent = 'تعذر النسخ'; }
  };
  function row(label, value, copyable = false) {
    const box = el('div', 'df-field'); box.append(el('span', '', label), el('strong', '', value || '—'));
    if (copyable) { const b = el('button', 'df-copy', 'نسخ'); b.type = 'button'; b.onclick = () => copy(value, b); box.append(b); }
    return box;
  }
  function phoneLink(phone, type) {
    const digits = String(phone || '').replace(/\D/g, '');
    const international = digits.startsWith('0') ? '964' + digits.slice(1) : digits;
    const a = el('a', type === 'whatsapp' ? 'df-whatsapp' : 'df-call', type === 'whatsapp' ? 'واتساب' : 'اتصال');
    a.href = type === 'whatsapp' ? 'https://wa.me/' + international : 'tel:' + digits;
    if (type === 'whatsapp') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }
  function imageButton(url, alt) {
    const safe = safeImage(url), box = el('div', 'df-product-photo');
    if (!safe) return box;
    const image = el('img'); image.src = safe; image.alt = alt || 'صورة المنتج'; image.loading = 'lazy';
    const open = el('button', '', 'تكبير الصورة'); open.type = 'button'; open.onclick = () => {
      const backdrop = el('div', 'df-image-viewer'); const panel = el('div', 'df-image-panel');
      const close = el('button', 'df-close', 'إغلاق'); close.onclick = () => backdrop.remove();
      const full = el('img'); full.src = safe; full.alt = image.alt;
      const save = el('a', 'df-save', 'فتح الصورة وحفظها'); save.href = safe; save.target = '_blank'; save.rel = 'noopener noreferrer';
      panel.append(close, full, save); backdrop.append(panel); backdrop.onclick = event => { if (event.target === backdrop) backdrop.remove(); }; document.body.append(backdrop);
    };
    box.append(image, open); return box;
  }
  let currentChat = null, chatPoll = null, inboxPoll = null;
  function closeChat() { if (chatPoll) clearInterval(chatPoll); chatPoll = null; currentChat?.remove(); currentChat = null; }
  async function openChat(ticket, title, admin = false) {
    closeChat(); const overlay = el('div', 'df-chat-overlay'); const panel = el('section', 'df-chat');
    const header = el('header'); const heading = el('div'); heading.append(el('b', '', title), el('small', '', 'دردشة خاصة بهذا الطلب'));
    const close = el('button', 'df-close', '×'); close.setAttribute('aria-label', 'إغلاق الدردشة'); close.onclick = closeChat; header.append(heading, close);
    const messages = el('div', 'df-messages'); const status = el('p', 'df-chat-status');
    const form = el('form', 'df-chat-form'); const input = el('textarea'); input.placeholder = 'اكتب رسالتك بخصوص الطلب...'; input.maxLength = 5000; input.rows = 2;
    const send = el('button', '', 'إرسال'); send.type = 'submit'; form.append(input, send);
    panel.append(header, status, messages, form); overlay.append(panel); document.body.append(overlay); currentChat = overlay;
    overlay.onclick = event => { if (event.target === overlay) closeChat(); };
    let lastSignature = '';
    async function refresh() {
      if (currentChat !== overlay) return;
      const closed = Date.now() >= new Date(ticket.expires_at).getTime() || ticket.status === 'closed';
      input.disabled = send.disabled = closed;
      status.textContent = closed ? 'انغلقت الدردشة بعد 24 ساعة. تگدر تطّلع على الرسائل السابقة.' : 'الدردشة مفتوحة 24 ساعة من وقت إنشائها';
      const rows = await api('wholesale_support_messages', 'select=id,sender_id,body,created_at,deleted_at&ticket_id=eq.' + ticket.id + '&order=created_at.asc');
      const signature = JSON.stringify(rows.map(m => [m.id, m.body, m.deleted_at]));
      if (signature === lastSignature) return; lastSignature = signature;
      messages.replaceChildren();
      const mine = session()?.user?.id;
      for (const message of rows) {
        const bubble = el('article', 'df-bubble ' + (message.sender_id === mine ? 'mine' : 'other'));
        bubble.append(el('b', '', message.sender_id === mine ? 'أنت' : admin ? 'التاجر' : 'دعم دروب فلاي'));
        bubble.append(el('p', '', message.deleted_at ? 'رسالة محذوفة' : message.body || ''));
        bubble.append(el('time', '', new Date(message.created_at).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })));
        messages.append(bubble);
      }
      messages.scrollTop = messages.scrollHeight;
    }
    form.onsubmit = async event => {
      event.preventDefault(); const text = input.value.trim(); if (!text || send.disabled) return;
      send.disabled = true; status.textContent = 'جارِ الإرسال...';
      try { await api('wholesale_support_messages', '', { method: 'POST', body: { ticket_id: ticket.id, sender_id: session()?.user?.id, body: text } }); input.value = ''; await refresh(); }
      catch (error) { status.textContent = error.message; } finally { if (Date.now() < new Date(ticket.expires_at).getTime()) send.disabled = false; }
    };
    try { await refresh(); } catch (error) { status.textContent = error.message; }
    chatPoll = setInterval(() => refresh().catch(error => { status.textContent = error.message; }), 3000);
    input.focus();
  }
  async function merchantChat(order) {
    const query = 'select=id,order_id,merchant_id,status,expires_at,subject&order_id=eq.' + order.id + '&limit=1';
    let rows = await api('wholesale_support_tickets', query);
    if (!rows.length) {
      try { rows = await api('wholesale_support_tickets', '', { method: 'POST', body: { order_id: order.id, merchant_id: order.merchant_id } }); }
      catch { rows = await api('wholesale_support_tickets', query); }
    }
    if (!rows.length) throw new Error('تعذر فتح دردشة الطلب');
    await openChat(rows[0], 'الطلب ' + order.order_number);
  }
  async function enhanceDetails(sheet) {
    if (sheet.dataset.dfReady) return;
    const number = $('header h2', sheet)?.textContent?.trim(); if (!number || !session()?.access_token) return;
    sheet.dataset.dfReady = 'loading';
    try {
      const rows = await api('wholesale_orders', 'select=*,wholesale_order_items(*)&order_number=eq.' + encodeURIComponent(number) + '&limit=1');
      if (!sheet.isConnected) return;
      const order = rows[0]; if (!order) throw new Error('لم تتوفر تفاصيل الطلب');
      const content = el('div', 'df-order-details');
      const identity = el('section', 'df-details-identity'); identity.append(row('رقم الطلب', order.order_number, true), row('اسم الزبون', order.customer_name));
      const phone = row('هاتف الزبون', order.customer_phone); const links = el('div', 'df-phone-links'); links.append(phoneLink(order.customer_phone, 'whatsapp'), phoneLink(order.customer_phone, 'call')); phone.append(links);
      identity.append(phone, row('محافظة الزبون', order.province, true), row('منطقة الزبون', order.area, true), row('الملاحظات', order.note || 'لا توجد ملاحظات', true));
      const sale = el('div', 'df-sale'); sale.append(el('span', '', 'سعر البيع المتفق مع الزبون'), el('strong', '', money(order.customer_price)));
      const products = el('section', 'df-products'); products.append(el('h3', '', 'المنتجات المطلوبة'));
      for (const item of order.wholesale_order_items || []) {
        const card = el('article', 'df-product'); card.append(imageButton(item.image_url, item.product_name));
        const info = el('div', 'df-product-info'); info.append(el('h4', '', item.product_name));
        info.append(row('سعر الجملة', money(item.wholesale_price)), row('سعر البيع', money(item.sale_price)), row('اللون', item.color), row('القياس', item.size), row('الكمية', item.quantity)); card.append(info); products.append(card);
      }
      if (!(order.wholesale_order_items || []).length) products.append(el('p', '', 'لم تتوفر تفاصيل المنتجات'));
      const profit = el('div', 'df-profit'); profit.append(el('span', '', 'الصافي لك بعد التوصيل'), el('strong', '', money(order.customer_price - order.product_price)));
      const chat = el('button', 'df-open-chat', 'إرسال ملاحظة • فتح دردشة الطلب'); chat.type = 'button';
      chat.onclick = async () => { chat.disabled = true; try { await merchantChat(order); } catch (error) { alert(error.message); } finally { chat.disabled = false; } };
      content.append(identity, sale, products, profit, chat); $('header', sheet).after(content); sheet.classList.add('df-enhanced'); sheet.dataset.dfReady = 'done';
    } catch { delete sheet.dataset.dfReady; }
  }
  let inbox = null;
  async function refreshInbox(list, errorBox) {
    const tickets = await api('wholesale_support_tickets', 'select=id,order_id,merchant_id,subject,status,created_at,expires_at&order_id=not.is.null&order=created_at.desc&limit=100');
    list.replaceChildren(); if (!tickets.length) { list.append(el('p', '', 'لا توجد دردشات طلبات بعد')); return; }
    const merchants = await api('wholesale_profiles', 'select=id,full_name,business_name&id=in.(' + [...new Set(tickets.map(t => t.merchant_id))].join(',') + ')');
    const names = new Map(merchants.map(m => [m.id, m.business_name || m.full_name]));
    for (const ticket of tickets) {
      const button = el('button', 'df-ticket'); button.type = 'button';
      const closed = Date.now() >= new Date(ticket.expires_at).getTime() || ticket.status === 'closed';
      button.append(el('b', '', ticket.subject), el('small', '', (names.get(ticket.merchant_id) || 'تاجر') + ' • ' + (closed ? 'مغلقة' : 'مفتوحة')));
      button.onclick = () => openChat(ticket, ticket.subject, true); list.append(button);
    }
    errorBox.textContent = '';
  }
  function openInbox() {
    if (inbox) { inbox.remove(); inbox = null; clearInterval(inboxPoll); return; }
    inbox = el('aside', 'df-inbox'); const head = el('header'); head.append(el('b', '', 'دردشات الطلبات'));
    const close = el('button', 'df-close', '×'); close.onclick = openInbox; head.append(close);
    const error = el('p', 'df-inbox-error'); const list = el('div', 'df-ticket-list'); inbox.append(head, error, list); document.body.append(inbox);
    const update = () => refreshInbox(list, error).catch(e => { error.textContent = e.message; }); update(); inboxPoll = setInterval(update, 5000);
  }
  let scheduled = false;
  function scan() {
    scheduled = false;
    const merchant = $('.merchant-app'), admin = $('.admin');
    document.body.classList.toggle('df-prepared', !!merchant && !!$('.app-nav button.active')?.textContent?.includes('المجهزة'));
    document.querySelectorAll('.merchant-app .details-sheet').forEach(enhanceDetails);
    if (admin && !$('#df-admin-chat-button')) {
      const button = el('button', 'df-admin-chat-button', 'دردشات الطلبات'); button.id = 'df-admin-chat-button'; button.onclick = openInbox; admin.append(button);
    }
    if (!admin) { $('#df-admin-chat-button')?.remove(); if (inbox) { inbox.remove(); inbox = null; clearInterval(inboxPoll); } }
  }
  new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(scan); } }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  scan();
})();
