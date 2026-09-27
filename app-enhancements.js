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
          const heading = document.createElement('h2');
          heading.textContent = 'بيانات صاحب النشاط';
          details.append(heading);
          for (const [key, labelText] of [['owner', 'اسم صاحب النشاط'], ['personal', 'رقم الهاتف الشخصي'], ['business', 'رقم هاتف النشاط التجاري']]) {
            const row = document.createElement('div'); row.className = 'df-profile-row'; row.dataset.field = key;
            const label = document.createElement('span'); label.textContent = labelText;
            const value = document.createElement('b'); value.dir = key === 'owner' ? 'rtl' : 'ltr';
            row.append(label, value); details.append(row);
          }
          banner.insertAdjacentElement('afterend', details);
        }
        const set = (key, value) => { const node = $(`[data-field="${key}"] b`, details); if (node) node.textContent = value || 'غير مسجل'; };
        set('owner', ownerName);
        set('personal', String(profile.phone || '').trim());
        set('business', String(profile.business_phone || '').trim());
      }
    }
    document.querySelectorAll('.df-product').forEach(product => {
      const fields = [...product.querySelectorAll('.df-field')];
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
          const heading = document.createElement('h2');
          heading.textContent = 'بيانات صاحب النشاط';
          details.append(heading);
          for (const [key, labelText] of [['owner', 'اسم صاحب النشاط'], ['personal', 'رقم الهاتف الشخصي'], ['business', 'رقم هاتف النشاط التجاري']]) {
            const row = document.createElement('div'); row.className = 'df-profile-row'; row.dataset.field = key;
            const label = document.createElement('span'); label.textContent = labelText;
            const value = document.createElement('b'); value.dir = key === 'owner' ? 'rtl' : 'ltr';
            row.append(label, value); details.append(row);
          }
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
})();      const wholesale = fields.find(field => field.querySelector('span')?.textContent.trim() === 'سعر الجملة');
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
