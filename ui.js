// ═══════════════════════════════════════════
//  ui.js — navigazione, toast, modal, ricerca globale
// ═══════════════════════════════════════════

// NAVIGATION
let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.bnav === page);
  });
  const titles = { dashboard: 'Dashboard', preventivi: 'Preventivi', prodotti: 'Catalogo Prodotti', clienti: 'Clienti', impostazioni: 'Impostazioni', categorie: 'Categorie & Materiali' };
  document.getElementById('page-title').textContent = titles[page] || page;
  closeSidebar();
  const renderers = { dashboard: renderDashboard, preventivi: renderPreventivi, prodotti: renderProdotti, clienti: renderClienti, impostazioni: renderImpostazioni, categorie: renderCategoriePage };
  if (renderers[page]) renderers[page]();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// TOAST
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type]||'ℹ'}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// MODAL
let _modalStack = [];

function openModal(html, large = false) {
  const id = 'modal-' + Date.now();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.innerHTML = `<div class="modal ${large?'modal-lg':''}">${html}</div>`;
  document.getElementById('modal-container').appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  _modalStack.push(id);
}

function closeModal() {
  if (!_modalStack.length) return;
  const id = _modalStack.pop();
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 200); }
}

function closeAllModals() {
  [..._modalStack].forEach(() => closeModal());
}

// HELPERS
function fmt(n) { return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(n||0); }
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('it-IT');
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6).toUpperCase(); }

function statusBadge(s) {
  const map = { bozza:'badge-draft', inviato:'badge-sent', accettato:'badge-accepted', rifiutato:'badge-rejected' };
  const label = { bozza:'Bozza', inviato:'Inviato', accettato:'Accettato', rifiutato:'Rifiutato' };
  return `<span class="badge ${map[s]||'badge-draft'}">${label[s]||s}</span>`;
}

// RICERCA GLOBALE
function toggleGlobalSearch() {
  const box = document.getElementById('global-search-box');
  const inp = document.getElementById('global-search-input');
  if (!box) return;
  const visible = box.style.display !== 'none';
  box.style.display = visible ? 'none' : 'flex';
  if (!visible) { inp?.focus(); }
  else { hideGlobalSearch(); }
}

function hideGlobalSearch() {
  const box = document.getElementById('global-search-box');
  const res = document.getElementById('global-search-results');
  if (box) box.style.display = 'none';
  if (res) res.remove();
}

async function globalSearch(q) {
  const old = document.getElementById('global-search-results');
  if (old) old.remove();
  if (!q || q.length < 2) return;

  // Carica dati se non presenti
  if (!clienti.length) await loadClienti();
  if (!prodotti.length) await loadProdotti();
  if (!preventivi.length) await loadPreventivi();

  const ql = q.toLowerCase();
  const results = [];

  // Cerca clienti
  clienti.filter(c => `${c.cognome} ${c.nome} ${c.azienda||''}`.toLowerCase().includes(ql)).slice(0,3).forEach(c => {
    results.push({ tipo: 'cliente', icon: '👤', main: `${c.cognome} ${c.nome}`, sub: c.azienda||c.email||'', action: `openClienteModal('${c.id}')` });
  });

  // Cerca prodotti
  prodotti.filter(p => `${p.nome} ${p.categoria||''} ${p.materiale||''}`.toLowerCase().includes(ql)).slice(0,3).forEach(p => {
    results.push({ tipo: 'prodotto', icon: '📦', main: p.nome, sub: `${p.categoria||''} · ${fmt(p.prezzo)}`, action: `openProdottoModal('${p.id}')` });
  });

  // Cerca preventivi
  const oggiSearch = new Date(); oggiSearch.setHours(0,0,0,0);
  preventivi.filter(p => {
    const cl = clienti.find(c => c.id === p.clienteId);
    return `${p.numero||''} ${p.numeroPrefisso||''} ${p.clienteNome||''} ${cl?.cognome||''} ${cl?.nome||''}`.toLowerCase().includes(ql);
  }).slice(0,4).forEach(p => {
    const num = p.numeroPrefisso ? `${p.numeroPrefisso}/${p.numero}` : `#${p.numero||p.id.slice(-4)}`;
    // Calcola se scaduto
    let scadBadge = '';
    let iconP = '📋';
    if (p.validoFino && p.stato !== 'accettato' && p.stato !== 'rifiutato') {
      const diff = Math.round((new Date(p.validoFino) - oggiSearch) / (1000*60*60*24));
      if (diff < 0) { iconP = '⚠️'; scadBadge = ' · SCADUTO'; }
      else if (diff <= 5) { iconP = '⏰'; scadBadge = ` · scade in ${diff}gg`; }
    }
    results.push({
      tipo: 'preventivo',
      icon: iconP,
      main: `${num} — ${p.clienteNome||''}`,
      sub: `${fmt(p.totaleFinale)} · ${p.stato||'bozza'}${scadBadge}`,
      scaduto: scadBadge.includes('SCADUTO'),
      action: `navigate('preventivi');setTimeout(()=>openPreventivoModal('${p.id}'),300)`
    });
  });

  if (!results.length) {
    const div = document.createElement('div');
    div.id = 'global-search-results';
    div.className = 'global-search-results';
    div.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text3);font-size:0.85rem">Nessun risultato per "${q}"</div>`;
    document.getElementById('global-search-box').appendChild(div);
    return;
  }

  const sections = { cliente: '👤 Clienti', prodotto: '📦 Prodotti', preventivo: '📋 Preventivi' };
  let html = '';
  let lastTipo = '';
  results.forEach(r => {
    if (r.tipo !== lastTipo) { html += `<div class="gsr-section">${sections[r.tipo]}</div>`; lastTipo = r.tipo; }
    const subColor = r.scaduto ? 'color:var(--danger)' : 'color:var(--text3)';
    html += `<div class="gsr-item" onclick="${r.action};hideGlobalSearch()" style="${r.scaduto ? 'border-left:3px solid var(--danger);' : ''}">
      <span class="gsr-icon">${r.icon}</span>
      <div><div class="gsr-main">${r.main}</div><div class="gsr-sub" style="${subColor}">${r.sub}</div></div>
    </div>`;
  });

  const div = document.createElement('div');
  div.id = 'global-search-results';
  div.className = 'global-search-results';
  div.innerHTML = html;
  document.getElementById('global-search-box').appendChild(div);
}