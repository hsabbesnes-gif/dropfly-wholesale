(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  let installEvent = null;
  let installBanner = null;
  const inStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function addInstallBanner() {
    if (installBanner || inStandalone()) return;
    try {
      if (localStorage.getItem('dropfly-install-invited-v1')) return;
      localStorage.setItem('dropfly-install-invited-v1', '1');
    } catch { /* Keep the prompt available if storage is disabled. */ }
    installBanner = document.createElement('aside');
    installBanner.className = 'df-install-banner';
    installBanner.setAttribute('dir', 'rtl');
    installBanner.setAttribute('role', 'dialog');
    installBanner.setAttribute('aria-label', 'تثبيت تطبيق دروب فلاي');
    const copy = document.createElement('div');
    copy.className = 'df-install-copy';
    copy.innerHTML = '<strong>ثبّت دروب فلاي على جهازك</strong><span>افتح الموقع بسرعة مثل أي تطبيق</span>';
    const actions = document.createElement('div');
    actions.className = 'df-install-actions';
    const install = document.createElement('button');
    install.type = 'button'; install.className = 'df-install-action'; install.textContent = 'تثبيت';
    install.onclick = async () => {
      if (installEvent) {
        installEvent.prompt();
        await installEvent.userChoice.catch(() => null);
        installEvent = null;
        removeInstallBanner();
      } else {
        copy.lastChild.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? 'اضغط مشاركة ثم اختر إضافة إلى الشاشة الرئيسية.'
          : 'من قائمة المتصفح ⋮ اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.';
        install.textContent = 'حسناً';
        install.onclick = removeInstallBanner;
      }
    };
    const dismiss = document.createElement('button');
    dismiss.type = 'button'; dismiss.className = 'df-install-dismiss'; dismiss.textContent = 'لاحقاً'; dismiss.onclick = removeInstallBanner;
    actions.append(install, dismiss); installBanner.append(copy, actions); document.body.append(installBanner);
  }
  function removeInstallBanner() { installBanner?.remove(); installBanner = null; }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installEvent = event;
    if (!inStandalone()) addInstallBanner();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null; removeInstallBanner();
    try { localStorage.setItem('dropfly-install-invited-v1', 'installed'); } catch { /* no-op */ }
  });

  function updateMerchantUI() {
    const app = $('.merchant-app');
    const active = $('.merchant-app .app-nav button.active');
    const label = active?.innerText?.trim() || '';
    // The order tab includes its unread badge in innerText (for example "الطلبات 1").
    document.body.classList.toggle('df-home-orders', !!app && label.includes('الطلبات') && !label.includes('المجهزة'));

    // The app currently asks for a second tap before logging out. Make the visible
    // logout control perform the expected action immediately.
    const logout = $('.merchant-app .app-header .logout');
    if (logout && !logout.dataset.dfSingleTap) {
      logout.dataset.dfSingleTap = '1';
      logout.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        try { localStorage.removeItem('dropfly-supabase-session'); } catch { /* reload still exits the account */ }
        window.location.reload();
      }, true);
    }

    const profile = (() => {
      try { return JSON.parse(localStorage.getItem('dropfly-supabase-session') || 'null')?.user?.user_metadata || {}; }
      catch { return {}; }
    })();
    const ownerName = String(profile.full_name || profile.name || '').trim();
    const greeting = $('.merchant-app .app-header .header-title small');
    if (greeting && ownerName) greeting.textContent = `مرحباً، ${ownerName}`;

    const banner = $('.merchant-app .account-banner');
    if (banner) {
      banner.classList.add('df-account-layout');
      $('.store-photo', banner)?.remove();
      const dueLabel = $('.due-box small', banner);
      if (dueLabel && dueLabel.textContent.trim() === 'الأموال المستحقة على الشركة') {
        dueLabel.textContent = 'مبالغ مستحقة يجب تسديدها إلى الشركة';
      }
      const accounts = banner.closest('.accounts');
      if (accounts) {
        let details = $('.df-merchant-profile-card', accounts);
        if (!details) {
          details = document.createElement('section');
          details.className = 'df-merchant-profile-card';
          details.dir = 'rtl';
          const head = document.createElement('div'); head.className = 'df-owner-head';
          const avatar = document.createElement('div'); avatar.className = 'df-owner-avatar'; avatar.setAttribute('aria-hidden', 'true');
          avatar.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="24" cy="15" r="8"/><path d="M9 41c1-9 7-14 15-14s14 5 15 14"/></svg><span class="df-owner-camera"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3"/></svg></span>';
          const intro = document.createElement('div'); intro.className = 'df-owner-intro';
          const heading = document.createElement('h2'); heading.textContent = 'بيانات صاحب النشاط';
          const hint = document.createElement('span'); hint.textContent = 'بيانات نشاطك التجاري';
          intro.append(heading, hint);
          const arrow = document.createElement('span'); arrow.className = 'df-owner-arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
          head.append(avatar, intro, arrow); details.append(head);
          const nameRow = document.createElement('div'); nameRow.className = 'df-owner-name df-profile-row'; nameRow.dataset.field = 'owner';
          nameRow.innerHTML = '<span class="df-owner-field-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h2m4 0h2m-8 4h2m4 0h2"/></svg></span><span class="df-owner-value"><small>اسم صاحب النشاط</small><b dir="rtl"></b></span>';
          details.append(nameRow);
          const phones = document.createElement('div'); phones.className = 'df-owner-phones';
          for (const [key, labelText, kind] of [['business', 'رقم الهاتف التجاري', 'business'], ['personal', 'رقم الهاتف الشخصي', 'personal']]) {
            const row = document.createElement('div'); row.className = 'df-owner-phone'; row.dataset.field = key;
            const icon = document.createElement('span'); icon.className = 'df-owner-phone-icon ' + kind;
            icon.innerHTML = kind === 'business' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14v16H5zM9 8h2m3 0h2m-7 4h2m3 0h2m-7 4h2m3 0h2"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 2.8 10 2l2.1 5-2.4 1.8a16 16 0 0 0 5.5 5.5L17 12l5 2.1-.8 3.4c-.4 1.7-2.1 2.8-3.8 2.5C10 18.6 5.4 14 4 6.6 3.7 4.9 4.9 3.2 6.6 2.8Z"/></svg>';
            const value = document.createElement('div'); value.className = 'df-owner-value';
            const label = document.createElement('small'); label.textContent = labelText;
            const number = document.createElement('b'); number.dir = 'ltr';
            value.append(label, number); row.append(icon, value); phones.append(row);
          }
          details.append(phones);
          banner.insertAdjacentElement('beforebegin', details);
        }
        const set = (key, value) => { const node = $(`[data-field="${key}"] b`, details); if (node) node.textContent = value || 'غير مسجل'; };
        set('owner', ownerName);
        set('personal', String(profile.phone || '').trim());
        set('business', String(profile.business_phone || '').trim());
      }
    }
    document.querySelectorAll('.df-product').forEach(product => {
      const fields = [...product.querySelectorAll('.df-field')];
      const wholesale = fields.find(field => field.querySelector('span')?.textContent.trim() === 'سعر الجملة');
      const sale = fields.find(field => field.querySelector('span')?.textContent.trim() === 'سعر البيع');
      if (!wholesale || !sale) return;
      const amount = field => Number((field.querySelector('strong')?.textContent || '').replace(/[^\d.-]/g, '')) || 0;
      const quantityField = fields.find(field => field.querySelector('span')?.textContent.trim() === 'الكمية');
      const quantity = Math.max(1, Number((quantityField?.querySelector('strong')?.textContent || '').replace(/[^\d.-]/g, '')) || 1);
      const profit = Math.max(0, amount(sale) - amount(wholesale)) * quantity;
      wholesale.querySelector('span').textContent = 'مبلغك بعد توصيل الطلب';
      wholesale.querySelector('strong').textContent = profit.toLocaleString('en-US') + ' د.ع';
      wholesale.classList.add('df-merchant-profit');
      sale.remove();
    });
  }
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; updateMerchantUI(); });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  schedule();
  document.addEventListener('DOMContentLoaded', () => {
    if (!inStandalone()) window.setTimeout(addInstallBanner, 1800);
  }, { once: true });
})();
