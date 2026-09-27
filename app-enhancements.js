(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  let installEvent = null;
  let installBanner = null;
  const inStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function removeInstallBanner() { installBanner?.remove(); installBanner = null; }
  function addInstallBanner() {
    if (installBanner || inStandalone()) return;
    try { if (localStorage.getItem('dropfly-install-invited-v1')) return; localStorage.setItem('dropfly-install-invited-v1', '1'); } catch { /* storage optional */ }
    installBanner = document.createElement('aside');
    installBanner.className = 'df-install-banner'; installBanner.setAttribute('dir', 'rtl'); installBanner.setAttribute('role', 'dialog'); installBanner.setAttribute('aria-label', 'تثبيت تطبيق دروب فلاي');
    const copy = document.createElement('div'); copy.className = 'df-install-copy';
    copy.innerHTML = '<strong>ثبّت دروب فلاي على جهازك</strong><span>افتح الموقع بسرعة مثل أي تطبيق</span>';
    const actions = document.createElement('div'); actions.className = 'df-install-actions';
    const install = document.createElement('button'); install.type = 'button'; install.className = 'df-install-action'; install.textContent = 'تثبيت';
    install.onclick = async () => {
      if (installEvent) { installEvent.prompt(); await installEvent.userChoice.catch(() => null); installEvent = null; removeInstallBanner(); }
      else { copy.lastChild.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'اضغط مشاركة ثم اختر إضافة إلى الشاشة الرئيسية.' : 'من قائمة المتصفح ⋮ اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.'; install.textContent = 'حسناً'; install.onclick = removeInstallBanner; }
    };
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'df-install-dismiss'; dismiss.textContent = 'لاحقاً'; dismiss.onclick = removeInstallBanner;
    actions.append(install, dismiss); installBanner.append(copy, actions); document.body.append(installBanner);
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; if (!inStandalone()) addInstallBanner(); });
  window.addEventListener('appinstalled', () => { installEvent = null; removeInstallBanner(); try { localStorage.setItem('dropfly-install-invited-v1', 'installed'); } catch { /* storage optional */ } });
  function updateMerchantUI() {
    const app = $('.merchant-app'); const active = $('.merchant-app .app-nav button.active');
    document.body.classList.toggle('df-home-orders', !!app && (active?.innerText?.trim() || '') === 'الطلبات');
    const banner = $('.merchant-app .account-banner');
    if (banner) { $('.store-photo', banner)?.remove(); const label = $('.due-box small', banner); if (label && label.textContent.trim() === 'الأموال المستحقة على الشركة') label.textContent = 'مبالغ مستحقة يجب تسديدها إلى الشركة'; }
    document.querySelectorAll('.df-product').forEach(product => {
      const fields = [...product.querySelectorAll('.df-field')];
      const wholesale = fields.find(field => field.querySelector('span')?.textContent.trim() === 'سعر الجملة');
      const sale = fields.find(field => field.querySelector('span')?.textContent.trim() === 'سعر البيع');
      if (!wholesale || !sale) return;
      const amount = field => Number((field.querySelector('strong')?.textContent || '').replace(/[^\d.-]/g, '')) || 0;
      const quantityField = fields.find(field => field.querySelector('span')?.textContent.trim() === 'الكمية');
      const quantity = Math.max(1, Number((quantityField?.querySelector('strong')?.textContent || '').replace(/[^\d.-]/g, '')) || 1);
      const profit = Math.max(0, amount(sale) - amount(wholesale)) * quantity;
      wholesale.querySelector('span').textContent = 'مبلغك بعد توصيل الطلب'; wholesale.querySelector('strong').textContent = profit.toLocaleString('en-US') + ' د.ع'; wholesale.classList.add('df-merchant-profit'); sale.remove();
    });
  }
  let queued = false; const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; updateMerchantUI(); }); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); schedule();
  document.addEventListener('DOMContentLoaded', () => { if (!inStandalone()) window.setTimeout(addInstallBanner, 1800); }, { once: true });
})();
