// ═══════════════════════════════════════════
//  impostazioni.js — dati azienda, categorie, materiali
// ═══════════════════════════════════════════

// COMPANY PROFILE
let companyData = {};

async function loadCompany(force = false) {
  if (!force && companyData.nome && _cacheValida('company')) return;
  const doc = await db.collection('settings').doc('company').get();
  if (doc.exists) companyData = doc.data();
  _cacheDirty.company = false;
  _cacheTs.company = Date.now();
}

function renderImpostazioni() {
  document.getElementById('topbar-actions').innerHTML = '';
  document.getElementById('page-content').innerHTML = `
  <div class="settings-section">
    <h3>🏢 Dati Aziendali</h3>
    <div class="card">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nome Azienda</label>
          <input class="form-input" id="s-name" value="${companyData.nome||''}" placeholder="Es. Infissi Rossi Srl">
        </div>
        <div class="form-group">
          <label class="form-label">P.IVA / C.F.</label>
          <input class="form-input" id="s-piva" value="${companyData.piva||''}" placeholder="IT00000000000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Indirizzo</label>
          <input class="form-input" id="s-address" value="${companyData.indirizzo||''}" placeholder="Via Roma 1, 80100 Napoli">
        </div>
        <div class="form-group">
          <label class="form-label">Telefono</label>
          <input class="form-input" id="s-phone" value="${companyData.telefono||''}" placeholder="+39 081 000000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="s-email" value="${companyData.email||''}" placeholder="info@tuaazienda.it">
        </div>
        <div class="form-group">
          <label class="form-label">Sito Web</label>
          <input class="form-input" id="s-web" value="${companyData.sito||''}" placeholder="www.tuaazienda.it">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Note / Condizioni PDF (pie' di pagina)</label>
        <textarea class="form-textarea" id="s-note" placeholder="Validità preventivo 30 giorni. IVA esclusa se non diversamente indicato...">${companyData.note||''}</textarea>
      </div>
    </div>
  </div>

  <div class="settings-section">
    <h3>🖼️ Logo Aziendale</h3>
    <div class="card">
      <p style="color:var(--text2);font-size:0.85rem;margin-bottom:16px">Il logo apparirà nell'intestazione dei PDF dei preventivi. Formato consigliato: PNG trasparente, max 400×150px.</p>
      ${companyData.logoBase64 ? `<img src="${companyData.logoBase64}" class="logo-preview" style="max-height:80px;margin-bottom:12px;display:block">` : ''}
      <div class="logo-upload-area" onclick="document.getElementById('logo-file').click()">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" style="margin:0 auto 8px;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <div style="color:var(--text2);font-size:0.85rem">Clicca per caricare il logo</div>
        <div style="color:var(--text3);font-size:0.75rem">PNG, JPG — max 2MB</div>
      </div>
      <input type="file" id="logo-file" accept="image/*" style="display:none" onchange="handleLogoUpload(event)">
    </div>
  </div>

  <div class="settings-section">
    <h3>📊 IVA Predefinita</h3>
    <div class="card">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Aliquota IVA (%)</label>
          <select class="form-select" id="s-iva">
            <option value="0" ${(companyData.iva||22)==0?'selected':''}>0% (Esente)</option>
            <option value="4" ${companyData.iva==4?'selected':''}>4%</option>
            <option value="10" ${companyData.iva==10?'selected':''}>10%</option>
            <option value="22" ${companyData.iva==22?'selected':''}>22%</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Valuta del preventivo</label>
          <select class="form-select" id="s-valuta">
            <option value="EUR" ${(companyData.valuta||'EUR')=='EUR'?'selected':''}>EUR (€)</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  ${isAdmin() ? `
  <div class="settings-section">
    <h3>🔧 Funzionalità Avanzate <span style="font-size:0.75rem;color:var(--text3);font-weight:400;font-family:'DM Sans',sans-serif">(solo admin — le modifiche si applicano a tutti gli utenti)</span></h3>
    <div class="card">
      <p style="color:var(--text2);font-size:0.83rem;margin-bottom:20px">Attiva o disattiva le funzionalità extra dell'app. Quando le abiliti tu, diventano visibili anche agli altri utenti.</p>
      <div style="display:flex;flex-direction:column;gap:14px">

        ${renderToggle('storicoClienti','📋 Storico preventivi per cliente','Mostra tutti i preventivi passati quando apri una scheda cliente')}
        ${renderToggle('firmaDigitale','✍️ Firma digitale','Il cliente firma il preventivo sul telefono con il dito — salvata nel PDF')}
        ${renderToggle('whatsapp','💬 WhatsApp diretto','Bottone accanto all&apos;email che apre WhatsApp con messaggio pre-compilato')}
        ${renderToggle('notifiche','🔔 Notifiche scadenze','Avviso automatico per preventivi in scadenza o rimasti in "inviato" da troppo tempo')}

      </div>
      <div style="margin-top:20px;display:flex;justify-content:flex-end">
        <button class="btn btn-primary" onclick="saveFeaturesAndRefresh()">💾 Salva funzionalità</button>
      </div>
    </div>
  </div>` : ''}

  <div style="display:flex;gap:12px;justify-content:flex-end">
    <button class="btn btn-primary" onclick="saveSettings()">💾 Salva Impostazioni</button>
  </div>`;
}

function renderToggle(key, label, desc) {
  const on = features[key];
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-weight:600;font-size:0.9rem">${label}</div>
        <div style="color:var(--text3);font-size:0.78rem;margin-top:2px">${desc}</div>
      </div>
      <button onclick="toggleFeature('${key}')" style="
        width:46px;height:26px;border-radius:13px;border:none;cursor:pointer;
        background:${on ? 'var(--gold)' : 'var(--border)'};
        position:relative;transition:background 0.2s;flex-shrink:0" id="toggle-${key}">
        <span style="
          position:absolute;top:3px;left:${on?'23':'3'}px;
          width:20px;height:20px;border-radius:50%;
          background:white;transition:left 0.2s;
          box-shadow:0 1px 4px rgba(0,0,0,0.2)"></span>
      </button>
    </div>`;
}

function toggleFeature(key) {
  features[key] = !features[key];
  // aggiorna visivamente il toggle senza ricaricare tutto
  const btn = document.getElementById('toggle-' + key);
  if (btn) {
    btn.style.background = features[key] ? 'var(--gold)' : 'var(--border)';
    const dot = btn.querySelector('span');
    if (dot) dot.style.left = features[key] ? '23px' : '3px';
  }
}

async function saveFeaturesAndRefresh() {
  await saveFeatures();
  toast('Funzionalità aggiornate per tutti gli utenti!', 'success');
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2*1024*1024) { toast('File troppo grande (max 2MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    companyData.logoBase64 = ev.target.result;
    renderImpostazioni();
    toast('Logo caricato — salva per confermare', 'info');
  };
  reader.readAsDataURL(file);
}

async function saveSettings() {
  companyData = {
    ...companyData,
    nome: document.getElementById('s-name').value,
    piva: document.getElementById('s-piva').value,
    indirizzo: document.getElementById('s-address').value,
    telefono: document.getElementById('s-phone').value,
    email: document.getElementById('s-email').value,
    sito: document.getElementById('s-web').value,
    note: document.getElementById('s-note').value,
    iva: parseInt(document.getElementById('s-iva').value),
    valuta: document.getElementById('s-valuta').value,
  };
  await db.collection('settings').doc('company').set(companyData);
  invalidaCache('company');
  toast('Impostazioni salvate!', 'success');
}

// CATEGORIE & MATERIALI
let categorieList = ["Finestra","Porta","Portafinestra","Porta d'ingresso","Tapparella","Veneziana","Zanzariera","Altro"];
let materialiList = ["PVC","Alluminio","Legno","Legno-Alluminio","Acciaio","Altro"];

async function loadCatMat() {
  const doc = await db.collection("settings").doc("catmat").get();
  if (doc.exists) {
    if (doc.data().categorie?.length) categorieList = doc.data().categorie;
    if (doc.data().materiali?.length) materialiList = doc.data().materiali;
  }
}
async function saveCatMat() {
  await db.collection("settings").doc("catmat").set({ categorie: categorieList, materiali: materialiList });
}

function openCatMatModal() {
  const catTags = () => categorieList.map((c,i)=>"<span class='chip' style='display:inline-flex;align-items:center;gap:4px'>"+c+"<button onclick='removeCat("+i+")' style='background:none;border:none;cursor:pointer;color:var(--gold-dark);font-size:0.9rem;padding:0 2px'>x</button></span>").join("");
  const matTags = () => materialiList.map((m,i)=>"<span class='chip' style='display:inline-flex;align-items:center;gap:4px'>"+m+"<button onclick='removeMat("+i+")' style='background:none;border:none;cursor:pointer;color:var(--gold-dark);font-size:0.9rem;padding:0 2px'>x</button></span>").join("");
  openModal("<div class='modal-header'><h2 class='modal-title'>Categorie e Materiali</h2><button class='btn-close' onclick='closeModal()'>x</button></div><div class='modal-body'><div class='form-row'><div><label class='form-label'>Categorie prodotto</label><div id='cat-tag-list' style='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px'>"+catTags()+"</div><div style='display:flex;gap:8px'><input class='form-input' id='new-cat-input' placeholder='Nuova categoria...' style='flex:1'><button class='btn btn-primary btn-sm' onclick='addCat()'>+ Aggiungi</button></div></div><div><label class='form-label'>Materiali</label><div id='mat-tag-list' style='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px'>"+matTags()+"</div><div style='display:flex;gap:8px'><input class='form-input' id='new-mat-input' placeholder='Nuovo materiale...' style='flex:1'><button class='btn btn-primary btn-sm' onclick='addMat()'>+ Aggiungi</button></div></div></div></div><div class='modal-footer'><button class='btn btn-secondary' onclick='closeModal()'>Annulla</button><button class='btn btn-primary' onclick='saveCatMatAndClose()'>Salva</button></div>");
}

function refreshCatTags(){const el=document.getElementById("cat-tag-list");if(el)el.innerHTML=categorieList.map((c,i)=>"<span class='chip' style='display:inline-flex;align-items:center;gap:4px'>"+c+"<button onclick='removeCat("+i+")' style='background:none;border:none;cursor:pointer;color:var(--gold-dark);font-size:0.9rem;padding:0 2px'>x</button></span>").join("");}
function refreshMatTags(){const el=document.getElementById("mat-tag-list");if(el)el.innerHTML=materialiList.map((m,i)=>"<span class='chip' style='display:inline-flex;align-items:center;gap:4px'>"+m+"<button onclick='removeMat("+i+")' style='background:none;border:none;cursor:pointer;color:var(--gold-dark);font-size:0.9rem;padding:0 2px'>x</button></span>").join("");}
function addCat(){const v=document.getElementById("new-cat-input").value.trim();if(v&&!categorieList.includes(v)){categorieList.push(v);document.getElementById("new-cat-input").value="";refreshCatTags();}}
function removeCat(i){categorieList.splice(i,1);refreshCatTags();}
function addMat(){const v=document.getElementById("new-mat-input").value.trim();if(v&&!materialiList.includes(v)){materialiList.push(v);document.getElementById("new-mat-input").value="";refreshMatTags();}}
function removeMat(i){materialiList.splice(i,1);refreshMatTags();}
async function saveCatMatAndClose(){await saveCatMat();closeModal();toast("Categorie e materiali salvati!","success");}

// PAGINA CATEGORIE & MATERIALI
function renderCategoriePage() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary" onclick="saveCatMatFromPage()">💾 Salva modifiche</button>`;

  document.getElementById('page-content').innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

    <div class="card">
      <h3 style="font-size:1.1rem;margin-bottom:6px">🏷️ Categorie prodotto</h3>
      <p style="color:var(--text3);font-size:0.82rem;margin-bottom:16px">Appaiono nel selettore categoria quando crei o modifichi un prodotto.</p>
      <div id="cat-page-tags" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;min-height:32px"></div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="cat-page-input" placeholder="Nuova categoria..." style="flex:1"
          onkeydown="if(event.key==='Enter'){addCatPage();event.preventDefault()}">
        <button class="btn btn-primary" onclick="addCatPage()">+ Aggiungi</button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem;margin-bottom:6px">🔩 Materiali</h3>
      <p style="color:var(--text3);font-size:0.82rem;margin-bottom:16px">Appaiono nel selettore materiale del prodotto.</p>
      <div id="mat-page-tags" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;min-height:32px"></div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="mat-page-input" placeholder="Nuovo materiale..." style="flex:1"
          onkeydown="if(event.key==='Enter'){addMatPage();event.preventDefault()}">
        <button class="btn btn-primary" onclick="addMatPage()">+ Aggiungi</button>
      </div>
    </div>

  </div>`;

  renderCatPageTags();
  renderMatPageTags();
}

function renderCatPageTags() {
  const el = document.getElementById('cat-page-tags');
  if (!el) return;
  el.innerHTML = categorieList.length ? categorieList.map((c,i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:var(--gold-light);color:var(--gold-dark);border-radius:20px;padding:5px 12px;font-size:0.82rem;font-weight:600">
      ${c}
      <button onclick="removeCatPage(${i})" style="background:none;border:none;cursor:pointer;color:var(--gold-dark);font-size:1rem;line-height:1;padding:0;opacity:0.7" title="Rimuovi">×</button>
    </span>`).join('') : `<span style="color:var(--text3);font-size:0.85rem">Nessuna categoria — aggiungine una</span>`;
}

function renderMatPageTags() {
  const el = document.getElementById('mat-page-tags');
  if (!el) return;
  el.innerHTML = materialiList.length ? materialiList.map((m,i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);color:var(--text);border-radius:20px;padding:5px 12px;font-size:0.82rem;font-weight:600;border:1px solid var(--border)">
      ${m}
      <button onclick="removeMatPage(${i})" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:1rem;line-height:1;padding:0;opacity:0.7" title="Rimuovi">×</button>
    </span>`).join('') : `<span style="color:var(--text3);font-size:0.85rem">Nessun materiale — aggiungine uno</span>`;
}

function addCatPage() {
  const inp = document.getElementById('cat-page-input');
  const v = inp?.value.trim();
  if (v && !categorieList.includes(v)) { categorieList.push(v); inp.value = ''; renderCatPageTags(); }
  else if (v) toast('Categoria già presente', 'info');
}
function removeCatPage(i) { categorieList.splice(i,1); renderCatPageTags(); }

function addMatPage() {
  const inp = document.getElementById('mat-page-input');
  const v = inp?.value.trim();
  if (v && !materialiList.includes(v)) { materialiList.push(v); inp.value = ''; renderMatPageTags(); }
  else if (v) toast('Materiale già presente', 'info');
}
function removeMatPage(i) { materialiList.splice(i,1); renderMatPageTags(); }

async function saveCatMatFromPage() {
  await saveCatMat();
  toast('Categorie e materiali salvati!', 'success');
}