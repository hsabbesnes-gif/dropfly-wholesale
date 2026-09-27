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
  document.addEventListener('pointerdown', event => {
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
    const button=event.target.closest('.admin-order-actions button');
    const picker=document.querySelector('.admin #df-status-picker');
    if (button?.textContent.includes('تغيير الحالة') && picker) {
      event.preventDefault(); event.stopImmediatePropagation(); picker.remove();
    }
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
