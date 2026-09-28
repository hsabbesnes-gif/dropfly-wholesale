(() => {
  'use strict';
  const menus = () => [...document.querySelectorAll('.merchant-app .order .state-menu')];
  const triggerFor = menu => menu.closest('.order')?.querySelector('.state-btn');
  function closeMenus() {
    menus().forEach(menu => triggerFor(menu)?.click());
    document.querySelectorAll('.admin #df-status-picker').forEach(menu => menu.remove());
  }
  function placeMenus() {
    menus().forEach(menu => {
      const button = triggerFor(menu); if (!button) return;
      [...menu.querySelectorAll('button')].forEach(option => {
        if (option.textContent.trim() === 'تم التوصيل') option.classList.add('df-delivery-option');
      });
      const rect = button.getBoundingClientRect();
      const width = Math.min(310, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      const above = Math.max(150, rect.top - 18);
      const below = Math.max(150, (window.visualViewport?.height || window.innerHeight) - rect.bottom - 18);
      const openAbove = above > below || above >= 440;
      Object.assign(menu.style, {
        position:'fixed',width:width+'px',left:left+'px',right:'auto',
        top:openAbove?'auto':Math.round(rect.bottom+8)+'px',
        bottom:openAbove?Math.round(window.innerHeight-rect.top+8)+'px':'auto',
        maxHeight:Math.floor(Math.min(560,(openAbove?above:below)-8))+'px',
        overflowY:'auto',zIndex:'10020'
      });
    });
  }
  let confirmedTarget = null;
  function confirmDelivery(onYes) {
    document.querySelector('.df-delivery-confirm')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'df-delivery-confirm';
    backdrop.dir = 'rtl';
    const dialog = document.createElement('section');
    dialog.setAttribute('role','alertdialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','df-delivery-heading');
    const heading = document.createElement('h2');
    heading.id = 'df-delivery-heading'; heading.textContent = 'هل تم توصيل الطلب؟';
    const detail = document.createElement('p');
    detail.textContent = 'في حال ضغطت نعم لا يمكن التراجع عنه في وقت لاحق. يرجى التأكد من الطلب أولاً.';
    const actions = document.createElement('div');
    const yes = document.createElement('button');
    yes.type='button'; yes.className='df-delivery-yes'; yes.textContent='نعم تم التوصيل';
    const back = document.createElement('button');
    back.type='button'; back.className='df-delivery-back'; back.textContent='رجوع';
    yes.onclick = () => { backdrop.remove(); onYes(); };
    back.onclick = () => backdrop.remove();
    actions.append(yes,back); dialog.append(heading,detail,actions); backdrop.append(dialog);
    document.body.append(backdrop); back.focus();
  }
  document.addEventListener('pointerdown', event => {
    if (event.target.closest('.df-delivery-confirm')) return;
    if (event.target.closest('.state-menu, #df-status-picker')) return;
    if (event.target.closest('.admin-order-actions button')?.textContent.includes('تغيير الحالة')) return;
    if (event.target.closest('.state-btn')) {
      // Let the clicked trigger toggle its own list, closing any other open list.
      menus().forEach(menu => { if (triggerFor(menu) !== event.target.closest('.state-btn')) triggerFor(menu)?.click(); });
      return;
    }
    closeMenus();
  }, true);
  document.addEventListener('click', event => {
    const delivered = event.target.closest('.merchant-app .state-menu button');
    if (delivered?.textContent.trim() === 'تم التوصيل') {
      if (confirmedTarget === delivered) { confirmedTarget=null; return; }
      event.preventDefault(); event.stopImmediatePropagation();
      confirmDelivery(() => { confirmedTarget=delivered; delivered.click(); confirmedTarget=null; });
      return;
    }
    const button=event.target.closest('.admin-order-actions button');
    const picker=document.querySelector('.admin #df-status-picker');
    if (button?.textContent.includes('تغيير الحالة') && picker) {
      event.preventDefault(); event.stopImmediatePropagation(); picker.remove();
    }
  }, true);
  document.addEventListener('change', event => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || select.value !== 'تم التوصيل') return;
    if (!select.matches('.admin #df-status-picker select, .admin .df-order-tools select')) return;
    if (confirmedTarget === select) { confirmedTarget=null; return; }
    event.preventDefault(); event.stopImmediatePropagation(); select.value='';
    confirmDelivery(() => {
      confirmedTarget=select; select.value='تم التوصيل';
      select.dispatchEvent(new Event('change',{bubbles:true})); confirmedTarget=null;
    });
  }, true);
  document.addEventListener('keydown', event => { if (event.key==='Escape') closeMenus(); });
  document.addEventListener('scroll', placeMenus, true);
  window.addEventListener('resize', placeMenus);
  window.visualViewport?.addEventListener('resize', placeMenus);
  let queued=false;
  new MutationObserver(() => {
    if (queued) return;
    queued=true; requestAnimationFrame(() => { queued=false; placeMenus(); });
  }).observe(document.documentElement,{childList:true,subtree:true});
  placeMenus();
})();
