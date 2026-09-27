(() => {
  document.addEventListener('pointerdown', event => {
    const view = document.querySelector('.merchant-app.df-prepared-view');
    if (!view || event.target.closest('.state-menu, .state-btn')) return;
    view.querySelectorAll('.order .state-menu').forEach(menu => {
      const trigger = menu.closest('.order')?.querySelector('.state-btn');
      trigger?.click();
    });
  }, true);
})();
