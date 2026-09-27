(() => {
  'use strict';
  const BASE = 'https://xyuwqccmqggoctprbhzb.supabase.co';
  const KEY = 'sb_publishable_RHnLnO4J-PdXnPhLQUHeXg_9vJjjzCx';
  const $ = (s, root = document) => root.querySelector(s);
  const el = (tag, cls, value) => { const x = document.createElement(tag); x.className = cls; if (value !== undefined) x.textContent = value; return x; };
  const session = () => { try { return JSON.parse(localStorage.getItem('dropfly-supabase-session') || 'null'); } catch { return null; } };
  let current = null, request = null, profileLoading = false, lastProfileAt = 0, loadedUser = null, photoUrl = null, photoPath = null;
  async function api(path, options = {}) {
    const token = session()?.access_token;
    if (!token) throw Error('انتهت الجلسة. سجّل الدخول من جديد.');
    const response = await fetch(BASE + path, { method: options.method || 'GET', headers: {
      apikey: KEY, Authorization: 'Bearer ' + token,
      ...(options.raw ? {} : {'Content-Type':'application/json'}),
      ...(options.returnRows ? {Prefer:'return=representation'} : {}),
      ...options.headers
    }, body: options.raw || (options.body === undefined ? undefined : JSON.stringify(options.body)) });
    const payload = await response.text(); let data;
    try { data = payload ? JSON.parse(payload) : null; } catch { data = null; }
    if (!response.ok) throw Error(data?.message || data?.error || 'تعذر الاتصال بالخادم');
    return data;
  }
  const uid = () => session()?.user?.id;
  const rest = (table, query) => `/rest/v1/${table}?${query}`;
  const label = {full_name:'اسم صاحب النشاط',business_name:'اسم النشاط التجاري',business_symbol:'رمز النشاط',phone:'رقم الهاتف الشخصي',business_phone:'رقم الهاتف التجاري'};
  const fields = Object.keys(label);
  const note = (box, message, error = false) => { box.textContent = message; box.classList.toggle('error', error); };
  function modal(title) {
    $('.df-profile-shade')?.remove();
    const shade = el('div','df-profile-shade'), pane = el('section','df-profile-pane');
    pane.dir = 'rtl'; pane.setAttribute('role','dialog'); pane.setAttribute('aria-modal','true');
    pane.setAttribute('aria-label',title);
    const header = el('header','df-profile-title'), h = el('h2','',title), close = el('button','df-close','×');
    close.type = 'button'; close.setAttribute('aria-label','إغلاق'); close.onclick = () => shade.remove();
    header.append(h,close); pane.append(header); shade.append(pane); document.body.append(shade);
    shade.onclick = e => { if (e.target === shade) shade.remove(); };
    return pane;
  }
  function showPhoto(url) {
    const pane = modal('صورة صاحب النشاط');
    const img = el('img','df-photo-large'); img.src = url; img.alt = 'صورة صاحب النشاط'; pane.append(img);
    const save = el('a','df-photo-save','حفظ الصورة'); save.href = url; save.target = '_blank'; save.rel = 'noopener';
    // Storage sends a file attachment when the browser supports cross-origin download.
    save.download = 'dropfly-profile.jpg'; pane.append(save);
  }
  async function loadPhoto() {
    if (!current?.avatar_url || current.avatar_url === photoPath) return;
    const path = current.avatar_url;
    const response = await fetch(`${BASE}/storage/v1/object/wholesale-avatars/${path}`,{headers:{apikey:KEY,Authorization:'Bearer '+session().access_token}});
    if (!response.ok) throw Error('تعذر تحميل الصورة');
    const blob = await response.blob(); if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(blob); photoPath = path; paint();
  }
  function paint() {
    const card = $('.merchant-app .df-merchant-profile-card'); if (!card || !current) return;
    for (const [field, selector] of [['full_name','owner'],['phone','personal'],['business_phone','business']]) {
      const value = $(`[data-field="${selector}"] b`,card);
      if (value && value.textContent !== (current[field] || 'غير مسجل')) value.textContent = current[field] || 'غير مسجل';
    }
    const avatar = $('.df-owner-avatar',card);
    if (avatar && photoUrl) {
      let img = $('img',avatar); if (!img) { img = el('img','df-avatar-img'); avatar.prepend(img); }
      if (img.src !== photoUrl) img.src = photoUrl;
      $('svg',avatar)?.classList.add('df-avatar-hidden');
    }
    const greeting = $('.merchant-app .app-header .header-title small');
    if (greeting && greeting.textContent !== `مرحباً، ${current.full_name || ''}`) greeting.textContent = `مرحباً، ${current.full_name || ''}`;
  }
  async function loadProfile(force = false) {
    const id = uid(); if (!id || profileLoading || (!force && Date.now()-lastProfileAt < 12000)) return;
    if (id !== loadedUser) { loadedUser = id; current = null; request = null; lastProfileAt = 0; photoPath=null; if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl=null; }
    profileLoading = true; lastProfileAt = Date.now();
    try {
      const [profiles,requests] = await Promise.all([
        api(rest('wholesale_profiles',`id=eq.${encodeURIComponent(id)}&select=*`)),
        api(rest('wholesale_profile_change_requests',`merchant_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=1`))
      ]);
      current = profiles?.[0]; request = requests?.[0] || null; paint();
      loadPhoto().catch(e=>console.warn(e.message));
    } catch (e) { console.warn('Profile review requires its Supabase migration:',e.message); }
    finally { profileLoading = false; }
  }
  async function uploadPhoto(file, status) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) {
      note(status,'اختر صورة JPG أو PNG أو WebP بحجم أقل من 5 ميغابايت.',true); return;
    }
    note(status,'جارِ رفع الصورة…');
    const path = `${uid()}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
    try {
      await api(`/storage/v1/object/wholesale-avatars/${path}`,{method:'POST',raw:file,headers:{'Content-Type':file.type,'x-upsert':'false'}});
      await api('/rest/v1/rpc/dropfly_set_avatar',{method:'POST',body:{p_url:path}});
      current = {...current,avatar_url:path}; await loadPhoto();
      note(status,'انحفظت الصورة بالسيرفر. راح تظهر من تسجّل دخول مرة ثانية.');
    } catch (e) { note(status,'تعذر حفظ الصورة: '+e.message,true); }
  }
  function openDetails() {
    if (!current) { loadProfile(true); return; }
    const pane = modal('معلومات صاحب النشاط');
    const status = el('p','df-profile-feedback');
    const image = photoUrl ? el('img','df-details-avatar') : el('span','df-details-placeholder','👤');
    if (photoUrl) { image.src = photoUrl; image.onclick = () => showPhoto(photoUrl); image.title = 'تكبير الصورة'; }
    pane.append(image);
    const fileLabel = el('label','df-upload-photo','📷 إضافة أو تغيير الصورة'), file = el('input');
    file.type='file'; file.accept='image/jpeg,image/png,image/webp'; file.hidden=true;
    file.onchange = () => uploadPhoto(file.files?.[0],status).then(() => {
      if (!current?.avatar_url) return;
      const photo = el('img','df-details-avatar'); photo.src=photoUrl;
      photo.onclick=()=>showPhoto(photoUrl); image.replaceWith(photo);
    });
    fileLabel.append(file); pane.append(fileLabel);
    const values = el('div','df-details-values');
    fields.forEach(key => { const row = el('div',''); row.append(el('small','',label[key]),el('b','',current[key] || 'غير مسجل')); values.append(row); });
    pane.append(values);
    const edit = el('button','df-edit-details','✎ تعديل البيانات'); pane.append(edit);
    const form = el('form','df-details-form'); form.hidden = true;
    fields.forEach(key => { const wrap = el('label',''), input = el('input'); input.name = key;
      input.type = key.includes('phone') ? 'tel' : 'text'; input.value = current[key] || '';
      input.maxLength = key.includes('phone') ? 11 : 80; wrap.append(el('span','',label[key]),input); form.append(wrap); });
    const submit = el('button','df-submit-review','إرسال للمراجعة'); submit.type='submit'; form.append(submit);
    pane.append(form,status);
    if (request?.status === 'pending') { edit.disabled=true; note(status,'عندك طلب تعديل قيد مراجعة الإدارة.'); }
    else if (request?.status === 'rejected') note(status,'آخر طلب تعديل انرفض.'+(request.review_note?' السبب: '+request.review_note:''),true);
    edit.onclick = () => { edit.hidden=true; values.hidden=true; form.hidden=false; };
    form.onsubmit = async e => {
      e.preventDefault(); const data = Object.fromEntries(new FormData(form));
      const changes = Object.fromEntries(fields.filter(k => data[k].trim() !== (current[k] || '')).map(k => [k,data[k].trim()]));
      if (!Object.keys(changes).length) return note(status,'ماكو تغييرات حتى ترسلها.');
      for (const key of ['phone','business_phone']) if (changes[key] !== undefined && !/^07\d{9}$/.test(changes[key])) return note(status,'اكتب رقم هاتف عراقي صحيح من 11 رقم.',true);
      if (['full_name','business_name'].some(k => k in changes && !changes[k])) return note(status,'الاسم واسم النشاط ما يصير يكونن فارغات.',true);
      submit.disabled=true; note(status,'جارِ إرسال الطلب…');
      try {
        const rows = await api('/rest/v1/wholesale_profile_change_requests',{method:'POST',returnRows:true,body:{merchant_id:uid(),changes}});
        request = rows?.[0] || {status:'pending',changes};
        form.hidden=true; note(status,'انرسل طلب التغيير للإدارة. البيانات الحالية تبقى لحد الموافقة.');
      } catch (err) { note(status,'تعذر الإرسال: '+err.message,true); submit.disabled=false; }
    };
  }
  function bindMerchant() {
    const card = $('.merchant-app .df-merchant-profile-card'); if (!card) return;
    const head = $('.df-owner-head',card), avatar = $('.df-owner-avatar',card);
    if (head && !head.dataset.dfReview) {
      head.dataset.dfReview='1'; head.classList.add('df-owner-clickable');
      head.tabIndex=0; head.setAttribute('role','button'); head.setAttribute('aria-label','عرض معلومات صاحب النشاط');
      head.onclick=e=>{ if (!e.target.closest('.df-owner-avatar')) openDetails(); };
      head.onkeydown=e=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); openDetails(); } };
      avatar.onclick=e=>{ e.stopPropagation(); if (photoUrl) showPhoto(photoUrl); else openDetails(); };
      avatar.title='عرض الصورة أو إضافتها';
    }
    loadProfile(); paint();
  }
  async function reviewPage() {
    const pane = modal('عملاء يريدون تغيير بياناتهم');
    const count = el('p','df-review-count','جارِ تحميل الطلبات…'), list = el('div','df-review-list');
    pane.classList.add('df-review-pane'); pane.append(count,list);
    async function refresh() {
      try {
        const rows = await api(rest('wholesale_profile_change_requests','select=*&order=created_at.desc&limit=200'));
        const ids = [...new Set(rows.map(x=>x.merchant_id))];
        const profiles = ids.length ? await api(rest('wholesale_profiles',`select=id,full_name,business_name,phone&id=in.(${ids.join(',')})`)) : [];
        const names = new Map(profiles.map(x=>[x.id,x])); list.replaceChildren();
        count.textContent = `${rows.filter(x=>x.status==='pending').length} طلب بانتظار المراجعة`;
        if (!rows.length) list.append(el('p','', 'ماكو طلبات تعديل بعد.'));
        rows.forEach(row => {
          const owner=names.get(row.merchant_id), card=el('article','df-review-card');
          card.append(el('h3','',owner?.business_name || owner?.full_name || 'نشاط تجاري'),
            el('small','',`${owner?.phone || ''} • ${new Date(row.created_at).toLocaleString('ar-IQ')}`),
            el('b','df-review-state',row.status==='pending'?'قيد المراجعة':row.status==='approved'?'تمت الموافقة':'مرفوض'));
          Object.entries(row.changes).forEach(([key,value])=>{
            const line=el('div','df-review-change'); line.append(el('span','',label[key]||key),el('strong','',String(value))); card.append(line);
          });
          if (row.review_note) card.append(el('p','',row.review_note));
          if (row.status === 'pending') {
            const buttons=el('div','df-review-actions'), yes=el('button','approve','موافقة'), no=el('button','reject','رفض');
            async function act(approve) {
              const reason = approve ? null : prompt('سبب الرفض (اختياري):') || null;
              if (!approve && reason === null && !confirm('رفض الطلب بدون سبب؟')) return;
              yes.disabled=no.disabled=true;
              try { await api('/rest/v1/rpc/dropfly_review_profile_request',{method:'POST',body:{p_id:row.id,p_approve:approve,p_note:reason}}); await refresh(); }
              catch(e) { alert('تعذر مراجعة الطلب: '+e.message); yes.disabled=no.disabled=false; }
            }
            yes.onclick=()=>act(true); no.onclick=()=>act(false); buttons.append(yes,no); card.append(buttons);
          }
          list.append(card);
        });
      } catch(e) { count.textContent='تعذر تحميل الطلبات: '+e.message; }
    }
    await refresh();
  }
  function bindAdmin() {
    const nav=$('.admin-header nav'); if (!nav || $('#df-profile-review-nav',nav)) return;
    const button=el('button','df-profile-review-nav','عملاء يريدون تغيير بياناتهم');
    button.id='df-profile-review-nav'; button.type='button'; button.onclick=reviewPage; nav.append(button);
  }
  let queued=false;
  function schedule() { if (queued) return; queued=true; requestAnimationFrame(()=>{queued=false;bindMerchant();bindAdmin();}); }
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule(); setInterval(()=>{ if ($('.merchant-app .df-merchant-profile-card')) loadProfile(true); },30000);
})();
