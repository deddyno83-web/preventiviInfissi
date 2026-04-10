// ═══════════════════════════════════════════
//  preventivi.js — CRUD preventivi, editor, calcoli
// ═══════════════════════════════════════════

let preventivi = [];
let preventivoItems = [];
let _prevSconto = { tipo: 'nessuno', valore: 0 };
let _prevMeseFiltro = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
})();

function renderPreventivi() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary" onclick="openPreventivoModal()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span class="btn-text">Nuovo Preventivo</span>
    </button>`;

  Promise.all([loadPreventivi(), loadClienti()]).then(() => {
    // Costruisci lista mesi disponibili dai preventivi
    const mesiDisponibili = buildMesiDisponibili();
    const scadutiCount = preventivi.filter(p => {
      if (!p.validoFino || p.stato === 'accettato' || p.stato === 'rifiutato') return false;
      const oggi = new Date(); oggi.setHours(0,0,0,0);
      return new Date(p.validoFino) < oggi;
    }).length;

    document.getElementById('page-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <div class="search-box" style="width:240px">
        <span class="search-icon">🔍</span>
        <input class="form-input" placeholder="Cerca preventivo..." oninput="filterPreventivi(this.value)">
      </div>
      <select class="form-select" style="width:160px;font-size:0.85rem" onchange="filtraMese(this.value)" id="mese-select">
        <option value="">📅 Tutti i mesi</option>
        ${mesiDisponibili.map(m => `<option value="${m.val}" ${m.val===_prevMeseFiltro?'selected':''}>${m.label}</option>`).join('')}
      </select>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" id="fbtn-tutti" onclick="filterPrevByStatus('tutti',this)">Tutti</button>
        <button class="btn btn-sm btn-secondary" id="fbtn-bozza" onclick="filterPrevByStatus('bozza',this)">Bozze</button>
        <button class="btn btn-sm btn-secondary" id="fbtn-inviato" onclick="filterPrevByStatus('inviato',this)">Inviati</button>
        <button class="btn btn-sm btn-secondary" id="fbtn-accettato" onclick="filterPrevByStatus('accettato',this)">Accettati</button>
        ${scadutiCount > 0 ? `<button class="btn btn-sm btn-secondary" id="fbtn-scaduti" onclick="filterPrevByStatus('scaduti',this)" style="border-color:var(--danger);color:var(--danger)">⚠ Scaduti (${scadutiCount})</button>` : ''}
      </div>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>N° Prev.</th><th>Cliente</th><th>Data</th>
            <th>Totale</th><th>Stato</th><th style="text-align:center">Azioni</th>
          </tr></thead>
          <tbody id="preventivi-tbody"></tbody>
        </table>
      </div>
    </div>`;
    applicaFiltriPreventivi();
  });
}

// ── Helper buttons (evita template literal annidati) ──
function btnFirma(id) {
  return '<button class="btn btn-ghost btn-sm btn-icon" onclick="openFirmaModal(\'' + id + '\')" title="Firma digitale" style="color:var(--success)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></button>';
}
function btnWhatsApp(id) {
  return '<button class="btn btn-ghost btn-sm btn-icon" onclick="sendWhatsApp(\'' + id + '\')" title="Apri WhatsApp" style="color:#25D366"><svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M11.956 0C5.354 0 0 5.343 0 11.932c0 2.103.554 4.114 1.606 5.892L.062 24l6.34-1.61A12.04 12.04 0 0 0 11.956 24c6.603 0 11.956-5.343 11.956-11.932C23.912 5.354 18.559 0 11.956 0zm0 21.818a9.87 9.87 0 0 1-5.018-1.367l-.36-.213-3.732.949.979-3.629-.235-.373a9.718 9.718 0 0 1-1.507-5.253c0-5.39 4.42-9.778 9.873-9.778 5.452 0 9.872 4.388 9.872 9.778 0 5.39-4.42 9.886-9.872 9.886z"/></svg></button>';
}

function renderPreventiviTable(list) {
  const tbody = document.getElementById('preventivi-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>Nessun preventivo</h3><p>Crea il primo preventivo</p></div></td></tr>`;
    return;
  }
  // SVG icons
  const icoEdit = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const icoPDF  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
  const icoMail = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
  const icoStat = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const icoDel  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  const icoCopy = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  const oggi = new Date(); oggi.setHours(0,0,0,0);
  tbody.innerHTML = list.map(p => {
    const cl = clienti.find(c => c.id === p.clienteId);
    const nomeCliente = cl ? `${cl.cognome} ${cl.nome}` : p.clienteNome || '—';

    // Calcola stato scadenza
    let scadenzaBadge = '';
    let isScaduto = false;
    let isInScadenza = false;
    if (p.validoFino && p.stato !== 'accettato' && p.stato !== 'rifiutato') {
      const scad = new Date(p.validoFino);
      const diff = Math.round((scad - oggi) / (1000*60*60*24));
      if (diff < 0) {
        isScaduto = true;
        scadenzaBadge = `<br><span style="font-size:0.68rem;color:var(--danger);font-weight:600">⚠ Scaduto da ${Math.abs(diff)}gg</span>`;
      } else if (diff <= 5) {
        isInScadenza = true;
        scadenzaBadge = `<br><span style="font-size:0.68rem;color:#E67E22;font-weight:600">⏰ Scade in ${diff}gg</span>`;
      }
    }

    // Stile riga: rosso per scaduti, arancio per in scadenza
    const rowStyle = isScaduto
      ? 'background:rgba(192,57,43,0.06);border-left:3px solid var(--danger)'
      : isInScadenza
        ? 'background:rgba(230,126,34,0.06);border-left:3px solid #E67E22'
        : '';

    const numDisplay = p.numeroPrefisso ? `${p.numeroPrefisso}/${p.numero||p.id.slice(-4)}` : `#${p.numero||p.id.slice(-6).toUpperCase()}`;
    return `<tr style="${rowStyle}">
      <td><strong>${numDisplay}</strong>${scadenzaBadge}</td>
      <td>${nomeCliente}${cl?.azienda?`<br><small style="color:var(--text3)">${cl.azienda}</small>`:''}</td>
      <td>${fmtDate(p.createdAt)}</td>
      <td><strong>${fmt(p.totaleFinale)}</strong></td>
      <td>
        <select class="stato-select" onchange="cambiaStato('${p.id}',this.value)" style="border:none;background:transparent;font-family:inherit;font-size:0.8rem;cursor:pointer;padding:2px 4px;border-radius:6px;${statoStyle(p.stato||'bozza')}">
          <option value="bozza"    ${(p.stato||'bozza')==='bozza'   ?'selected':''}>📝 Bozza</option>
          <option value="inviato"  ${p.stato==='inviato' ?'selected':''}>📤 Inviato</option>
          <option value="accettato"${p.stato==='accettato'?'selected':''}>✅ Accettato</option>
          <option value="rifiutato"${p.stato==='rifiutato'?'selected':''}>❌ Rifiutato</option>
        </select>
      </td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openPreventivoModal('${p.id}')" title="Modifica preventivo" style="color:var(--info)">${icoEdit}</button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="duplicaPreventivo('${p.id}')" title="Duplica preventivo" style="color:var(--text2)">${icoCopy}</button>
        ${can('firmaDigitale') ? btnFirma(p.id) : ''}
        <button class="btn btn-ghost btn-sm btn-icon" onclick="generatePDF('${p.id}')" title="Scarica / Apri PDF" style="color:var(--danger)">${icoPDF}</button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="sendEmail('${p.id}')" title="Invia email al cliente" style="color:var(--gold-dark)">${icoMail}</button>
        ${can('whatsapp') ? btnWhatsApp(p.id) : ''}
        <button class="btn btn-ghost btn-sm btn-icon" onclick="deletePreventivo('${p.id}')" title="Elimina preventivo" style="color:var(--text3)">${icoDel}</button>
      </td>
    </tr>`;
  }).join('');
}

function statoStyle(stato) {
  const styles = {
    bozza:     'color:#6B6560;background:#F0EDE8;',
    inviato:   'color:#2980B9;background:#EBF5FB;',
    accettato: 'color:#27AE60;background:#EBF8F1;',
    rifiutato: 'color:#C0392B;background:#FDEDED;'
  };
  return styles[stato] || styles.bozza;
}

async function cambiaStato(prevId, nuovoStato) {
  await db.collection('preventivi').doc(prevId).update({
    stato: nuovoStato,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  invalidaCache('preventivi');
  // aggiorna localmente senza ricaricare tutto
  const p = preventivi.find(x => x.id === prevId);
  if (p) p.stato = nuovoStato;
  const sel = document.querySelector(`select[onchange*="${prevId}"]`);
  if (sel) sel.style.cssText = sel.style.cssText.replace(/color:[^;]+;background:[^;]+/, statoStyle(nuovoStato));
  toast('Stato aggiornato!', 'success');
}

let prevStatusFilter = 'tutti';
let _prevSearchQ = '';

// Costruisce lista mesi unici dai preventivi esistenti
function buildMesiDisponibili() {
  const mesi = {};
  preventivi.forEach(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    mesi[key] = label.charAt(0).toUpperCase() + label.slice(1);
  });
  return Object.entries(mesi)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .map(([val, label]) => ({ val, label }));
}

// Applica tutti i filtri combinati: mese + stato + ricerca testo
function applicaFiltriPreventivi() {
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  let list = preventivi;

  // Filtro mese
  if (_prevMeseFiltro) {
    list = list.filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return key === _prevMeseFiltro;
    });
  }

  // Filtro stato (incluso 'scaduti')
  if (prevStatusFilter === 'scaduti') {
    list = list.filter(p => {
      if (!p.validoFino || p.stato === 'accettato' || p.stato === 'rifiutato') return false;
      return new Date(p.validoFino) < oggi;
    });
  } else if (prevStatusFilter !== 'tutti') {
    list = list.filter(p => p.stato === prevStatusFilter);
  }

  // Filtro ricerca testo
  if (_prevSearchQ) {
    const ql = _prevSearchQ.toLowerCase();
    list = list.filter(p => {
      const cl = clienti.find(c => c.id === p.clienteId);
      const name = cl ? `${cl.cognome} ${cl.nome}` : p.clienteNome || '';
      return name.toLowerCase().includes(ql) || (p.numero||'').toLowerCase().includes(ql);
    });
  }

  renderPreventiviTable(list);
}

function filtraMese(val) {
  _prevMeseFiltro = val;
  applicaFiltriPreventivi();
}

function filterPrevByStatus(status, btn) {
  prevStatusFilter = status;
  // Aggiorna stile bottoni
  document.querySelectorAll('[id^="fbtn-"]').forEach(b => {
    b.className = 'btn btn-sm btn-secondary';
    if (b.id === 'fbtn-scaduti') b.style.cssText = 'border-color:var(--danger);color:var(--danger)';
  });
  if (btn) {
    btn.className = 'btn btn-sm btn-primary';
    btn.style.cssText = '';
  }
  applicaFiltriPreventivi();
}

function filterPreventivi(q) {
  _prevSearchQ = q;
  applicaFiltriPreventivi();
}

// ── PREVENTIVO MODAL (editor) ──
async function openPreventivoModal(id = null, preselClienteId = null) {
  // Assicura che i prodotti siano sempre caricati prima di aprire
  if (!prodotti.length) await loadProdotti();
  const prev = id ? preventivi.find(x => x.id === id) : null;
  // Carica items e reiniezione foto dal catalogo prodotti
  // (le foto non vengono salvate su Firestore per rispettare il limite 1MB)
  if (prev && prev.items) {
    preventivoItems = prev.items.map(it => {
      const prodotto = prodotti.find(p => p.id === it.prodottoId);
      return { ...it, foto: prodotto?.foto || null };
    });
  } else {
    preventivoItems = [];
  }
  _prevSconto = prev ? { tipo: prev.scontoTipo||'nessuno', valore: prev.scontoValore||0 } : { tipo: 'nessuno', valore: 0 };

  const clienteOptions = clienti.map(c =>
    `<option value="${c.id}" ${(prev?.clienteId||preselClienteId)===c.id?'selected':''}>${c.cognome} ${c.nome}${c.azienda?' — '+c.azienda:''}</option>`
  ).join('');

  // data validità di default = oggi + 30 giorni
  const defaultValidita = (() => {
    const d = prev?.validoFino ? new Date(prev.validoFino) : new Date(Date.now() + 30*24*60*60*1000);
    return d.toISOString().split('T')[0];
  })();

  // prefisso numero personalizzato
  const annoCorrente = new Date().getFullYear();
  const defaultPrefisso = prev?.numeroPrefisso || String(annoCorrente);

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${id ? 'Modifica Preventivo' : 'Nuovo Preventivo'}</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cliente *</label>
          <div style="display:flex;gap:6px;align-items:flex-start">
            <select class="form-select" id="pv-cliente" style="flex:1">
              <option value="">— Seleziona cliente —</option>
              ${clienteOptions}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap;padding:9px 10px;flex-shrink:0" onclick="toggleNuovoClienteInline()" title="Crea nuovo cliente al volo">+ Nuovo</button>
          </div>
          <div id="nuovo-cliente-inline" style="display:none;margin-top:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text2);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">👤 Nuovo cliente rapido</div>
            <div class="form-row" style="margin-bottom:8px">
              <div><label class="form-label" style="font-size:0.72rem">Cognome *</label><input class="form-input" id="nc-cognome" placeholder="Rossi" style="font-size:0.85rem"></div>
              <div><label class="form-label" style="font-size:0.72rem">Nome</label><input class="form-input" id="nc-nome" placeholder="Mario" style="font-size:0.85rem"></div>
            </div>
            <div class="form-row" style="margin-bottom:8px">
              <div><label class="form-label" style="font-size:0.72rem">Telefono</label><input class="form-input" id="nc-tel" placeholder="+39 333 000000" style="font-size:0.85rem"></div>
              <div><label class="form-label" style="font-size:0.72rem">Email</label><input class="form-input" id="nc-email" placeholder="mario@email.it" type="email" style="font-size:0.85rem"></div>
            </div>
            <div style="margin-bottom:8px"><label class="form-label" style="font-size:0.72rem">Indirizzo</label><input class="form-input" id="nc-addr" placeholder="Via Roma 1, 80100 Napoli" style="font-size:0.85rem"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="toggleNuovoClienteInline()">Annulla</button>
              <button class="btn btn-primary btn-sm" onclick="salvaClienteRapido()">💾 Crea e seleziona</button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Stato</label>
          <select class="form-select" id="pv-stato">
            <option value="bozza" ${(prev?.stato||'bozza')==='bozza'?'selected':''}>Bozza</option>
            <option value="inviato" ${prev?.stato==='inviato'?'selected':''}>Inviato</option>
            <option value="accettato" ${prev?.stato==='accettato'?'selected':''}>Accettato</option>
            <option value="rifiutato" ${prev?.stato==='rifiutato'?'selected':''}>Rifiutato</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Prefisso numero</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input class="form-input" id="pv-prefisso" value="${defaultPrefisso}" placeholder="Es. 2025" style="width:90px;flex-shrink:0">
            <span style="color:var(--text3);font-size:0.85rem">/ ${prev?.numero || '<auto>'}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text3);margin-top:4px">Numero sul PDF: ${defaultPrefisso}/${prev?.numero||'XXXX'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Valido fino al</label>
          <input class="form-input" id="pv-validita" type="date" value="${defaultValidita}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Testo introduttivo <span style="font-size:0.72rem;color:var(--text3)">(appare nel PDF prima della tabella prodotti)</span></label>
        <textarea class="form-textarea" id="pv-note" placeholder="Es. RingranziandoLa per la Sua gentile richiesta, Le sottoponiamo la nostra migliore offerta per..." style="min-height:70px">${prev?.note||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">⏱ Tempi di consegna <span style="font-size:0.72rem;color:var(--text3)">(PDF)</span></label>
          <input class="form-input" id="pv-tempi" value="${prev?.tempiConsegna||'45/60 gg. lavorativi dall&apos;accettazione preventivo e pagamento dell&apos;acconto'}" placeholder="Es. 45/60 gg. lavorativi...">
        </div>
        <div class="form-group">
          <label class="form-label">💳 Condizioni di pagamento <span style="font-size:0.72rem;color:var(--text3)">(PDF)</span></label>
          <textarea class="form-textarea" id="pv-pagamenti" placeholder="Es. Acconto 40% all'accettazione, saldo a lavori ultimati..." style="min-height:60px">${prev?.pagamenti||'Acconto del 40% all&apos;accettazione su emissione fattura&#10;Saldo a lavori ultimati'}</textarea>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Note interne <span style="font-size:0.72rem;color:var(--text3)">(solo per voi — non nel PDF)</span></label>
        <textarea class="form-textarea" id="pv-note-interne" placeholder="Memo interni: es. cliente vuole sconto, installazione a maggio..." style="min-height:60px;background:var(--surface2)">${prev?.noteInterne||''}</textarea>
      </div>

      <hr class="divider">
      <div class="section-header">
        <strong>Voci del Preventivo</strong>
        <button class="btn btn-secondary btn-sm" onclick="openProductPicker()">+ Aggiungi Prodotto</button>
      </div>
      <div id="pv-items-list"></div>

      <hr class="divider">
      <div id="pv-totale-box"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
      <button class="btn btn-primary" id="btn-salva-preventivo" onclick="savePreventivo('${id||''}')">💾 Salva Preventivo</button>
    </div>`, true);

  renderPreventivoItems();
}

function calcMq(it) {
  // Se l'utente ha inserito manualmente i m², usa quello
  if (it.mqManuale !== null && it.mqManuale !== undefined && it.mqManuale > 0) return it.mqManuale;
  const largM = (parseInt(it.larghezza)||0) / 1000;
  const altM  = (parseInt(it.altezza)||0)  / 1000;
  const mqRaw = largM * altM;
  // Arrotonda al mezzo metro quadro superiore (0.50)
  // es: 2.10 → 2.50 | 2.51 → 3.00 | 2.75 → 3.00 | 3.00 → 3.00
  return Math.ceil(mqRaw * 2) / 2;
}

function calcLineTotal(it) {
  const um = it.um || 'pz';
  if (um === 'mq') {
    const mq = calcMq(it);
    return parseFloat((it.prezzo * mq * (it.qty||1)).toFixed(2));
  } else if (um === 'ml') {
    const lungM = (parseInt(it.larghezza)||0) / 1000;
    return parseFloat((it.prezzo * lungM * (it.qty||1)).toFixed(2));
  } else {
    return parseFloat((it.prezzo * (it.qty||1)).toFixed(2));
  }
}

function renderPreventivoItems() {
  const list = document.getElementById('pv-items-list');
  const totBox = document.getElementById('pv-totale-box');
  if (!list) return;

  if (!preventivoItems.length) {
    list.innerHTML = `<div class="empty-state" style="padding:24px"><p>Nessun prodotto aggiunto. Clicca "+ Aggiungi Prodotto"</p></div>`;
    if (totBox) totBox.innerHTML = '';
    return;
  }

  let subtot = 0;
  list.innerHTML = preventivoItems.map((it, i) => {
    const um = it.um || 'pz';
    const lineTotal = calcLineTotal(it);
    subtot += lineTotal;

    // Misure fields based on UM — input in mm, calcolo in m
    let misureHtml = '';
    if (um === 'mq') {
      const largMm = parseInt(it.larghezza)||0;
      const altMm  = parseInt(it.altezza)||0;
      const mqRaw = ((largMm/1000) * (altMm/1000));
      const mqArrot = Math.ceil(mqRaw * 2) / 2; // arrotonda al mezzo m² superiore
      const mqEff = (it.mqManuale !== null && it.mqManuale !== undefined && it.mqManuale > 0) ? it.mqManuale : mqArrot;
      const hasManualeOverride = (it.mqManuale !== null && it.mqManuale !== undefined && it.mqManuale > 0);
      misureHtml = `
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:10px">
            <div style="display:flex;align-items:center;gap:4px">
              <label style="font-size:0.72rem;color:var(--text2);white-space:nowrap">Larg. (mm)</label>
              <input class="form-input" type="number" min="0" step="1" style="width:80px;padding:6px 8px;font-size:0.82rem"
                value="${largMm||''}" placeholder="1300"
                oninput="updateItemDim(${i},'larghezza',this.value)">
            </div>
            <span style="color:var(--text3);font-size:0.9rem">×</span>
            <div style="display:flex;align-items:center;gap:4px">
              <label style="font-size:0.72rem;color:var(--text2);white-space:nowrap">Alt. (mm)</label>
              <input class="form-input" type="number" min="0" step="1" style="width:80px;padding:6px 8px;font-size:0.82rem"
                value="${altMm||''}" placeholder="1500"
                oninput="updateItemDim(${i},'altezza',this.value)">
            </div>
            <span id="mq-info-${i}" style="font-size:0.75rem;color:var(--text3)">= ${mqRaw.toFixed(2)} m² → arrot. ${mqArrot.toFixed(2)} m²</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <label style="font-size:0.72rem;color:var(--text2);white-space:nowrap;font-weight:600">m² da usare:</label>
            <input class="form-input" type="number" min="0" step="0.01" 
              id="mq-badge-${i}"
              style="width:80px;padding:6px 8px;font-size:0.85rem;font-weight:700;background:var(--gold-light);border-color:var(--gold);color:var(--gold-dark);text-align:center"
              value="${mqEff.toFixed(2)}"
              oninput="updateItemMqManuale(${i},this.value)"
              title="Modifica il valore m² — sovrascrive il calcolo automatico">
            <span style="font-size:0.75rem;color:var(--text3)">${hasManualeOverride ? '✏️ modificato manualmente' : '(arrotondato al superiore)'}</span>
            ${hasManualeOverride ? `<button class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:4px 8px;color:var(--text3)" onclick="resetMqManuale(${i})" title="Ripristina calcolo automatico">↺ auto</button>` : ''}
          </div>`;
    } else if (um === 'ml') {
      const lungMm = parseInt(it.larghezza)||0;
      misureHtml = `
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <label style="font-size:0.72rem;color:var(--text2);white-space:nowrap">Lungh. (mm)</label>
          <input class="form-input" type="number" min="0" step="1" style="width:90px;padding:6px 8px;font-size:0.82rem"
            value="${lungMm||''}" placeholder="1000"
            oninput="updateItemDim(${i},'larghezza',this.value)">
          <span id="mq-badge-${i}" style="background:var(--gold-light);color:var(--gold-dark);font-size:0.78rem;font-weight:700;padding:4px 10px;border-radius:4px">= ${(lungMm/1000).toFixed(2)} ml</span>
        </div>`;
    }

    // Build technical details string
    const techLines = [
      it.sistema ? `Sistema: ${it.sistema}` : '',
      it.coloreProfili ? `Colore profili: ${it.coloreProfili}` : '',
      it.coloreAccessori ? `Colore accessori: ${it.coloreAccessori}` : '',
      it.altezzaManiglia ? `Alt. maniglia: ${it.altezzaManiglia} mm` : '',
      it.tamponamento ? `Tamponamento: ${it.tamponamento}` : '',
    ].filter(Boolean);

    const umLabel = um === 'mq' ? 'N. finestre' : um === 'ml' ? 'N. pezzi' : 'Qtà';
    const umStr = um === 'mq' ? 'm²' : um === 'ml' ? 'ml' : 'pz';

    const isCopia = it._copia || false;
    return `
    <div style="background:var(--surface);border:1px solid ${isCopia ? 'var(--info)' : 'var(--border)'};border-radius:var(--radius);margin-bottom:10px;overflow:hidden">

      <!-- HEADER RIGA -->
      <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px 10px">
        ${it.foto ? `<img src="${it.foto}" style="width:54px;height:46px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid var(--border)">` : `<div style="width:54px;height:46px;border-radius:6px;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.4rem">📦</div>`}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:600;font-size:0.95rem">${it.nome}</span>
            ${isCopia ? `<span style="font-size:0.7rem;background:var(--info);color:white;padding:2px 8px;border-radius:20px">copia</span>` : ''}
          </div>
          <div style="font-size:0.78rem;color:var(--text2);margin-top:2px">${it.categoria||''} · <strong>${umStr}</strong> · ${fmt(it.prezzo)}/${umStr}</div>
        </div>
        <!-- QTÀ + TOTALE + AZIONI -->
        <div style="display:flex;align-items:flex-start;gap:10px;flex-shrink:0">
          <div style="text-align:center">
            <div style="font-size:0.7rem;color:var(--text3);margin-bottom:3px">${umLabel}</div>
            <input class="form-input" type="number" min="1" value="${it.qty||1}" onchange="updateItemQty(${i},this.value)" style="width:54px;text-align:center;padding:5px 4px;font-size:0.9rem;font-weight:600">
          </div>
          <div style="text-align:right;padding-top:2px">
            <div class="item-total" id="item-total-${i}" style="font-size:1rem;font-weight:700;color:var(--gold-dark);white-space:nowrap">${fmt(lineTotal)}</div>
            <div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="duplicaRiga(${i})" title="Duplica riga con misure diverse" style="width:28px;height:28px;padding:0;border-radius:50%;border:1px solid var(--info);color:var(--info);font-size:1rem;display:flex;align-items:center;justify-content:center">+</button>
              <button class="btn btn-danger btn-sm" onclick="removeItem(${i})" style="width:28px;height:28px;padding:0;border-radius:50%;font-size:0.8rem;display:flex;align-items:center;justify-content:center">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- DETTAGLI TECNICI (griglia 2 col) -->
      ${techLines.length ? `
      <div style="margin:0 14px 10px;background:var(--surface2);border-radius:6px;padding:8px 12px;display:grid;grid-template-columns:1fr 1fr;gap:3px 16px">
        ${techLines.map(l => `<div style="font-size:0.75rem;color:var(--text2);line-height:1.7">${l}</div>`).join('')}
      </div>` : ''}

      <!-- MISURE -->
      ${misureHtml ? `<div style="padding:0 14px 10px;border-top:1px solid var(--border)">${misureHtml}</div>` : ''}

      <!-- POSIZIONE / VANO -->
      <div style="padding:0 14px 12px${misureHtml ? '' : ';border-top:1px solid var(--border);padding-top:10px'}">
        <input class="form-input" style="font-size:0.82rem;color:var(--text2)" placeholder="Posizione / Vano (es. Camera da letto - finestra sx)" value="${it.descrizioneRiga||''}" oninput="updateItemDescRiga(${i},this.value)">
      </div>
    </div>`;
  }).join('');

  // Render totale box after items
  updateTotaleBox();
}

// ── Nuovo cliente rapido dal modal preventivo ──
function toggleNuovoClienteInline() {
  const box = document.getElementById('nuovo-cliente-inline');
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  setTimeout(() => document.getElementById('nc-cognome')?.focus(), 50);
}

async function salvaClienteRapido() {
  const cognome = document.getElementById('nc-cognome')?.value.trim();
  if (!cognome) { toast('Inserisci almeno il cognome', 'error'); return; }
  const data = {
    cognome,
    nome: document.getElementById('nc-nome')?.value || '',
    telefono: document.getElementById('nc-tel')?.value || '',
    email: document.getElementById('nc-email')?.value || '',
    indirizzo: document.getElementById('nc-addr')?.value || '',
    citta: '', azienda: '', note: '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = await db.collection('clienti').add(data);
  await loadClienti();
  // Aggiunge la nuova opzione nel select e la seleziona
  const sel = document.getElementById('pv-cliente');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = ref.id;
    opt.textContent = `${cognome} ${data.nome}`.trim();
    opt.selected = true;
    sel.appendChild(opt);
  }
  // Chiude il pannello
  const box = document.getElementById('nuovo-cliente-inline');
  if (box) box.style.display = 'none';
  toast(`Cliente "${cognome}" creato e selezionato!`, 'success');
}

function updateScontoTipo(v) { _prevSconto.tipo = v; if(v==='nessuno') _prevSconto.valore=0; renderPreventivoItems(); }
function updateScontoValore(v) { _prevSconto.valore = parseFloat(v)||0; renderPreventivoItems(); }

function updateItemQty(i, v) {
  preventivoItems[i].qty = parseInt(v) || 1;
  refreshItemTotals(i);
}
function updateItemDim(i, campo, v) {
  const valNum = parseInt(v);
  preventivoItems[i][campo] = isNaN(valNum) ? 0 : valNum;
  const um = preventivoItems[i].um || 'pz';
  if (um === 'mq') {
    const hasManualeOverride = preventivoItems[i].mqManuale > 0;
    if (!hasManualeOverride) {
      const largMm = preventivoItems[i].larghezza || 0;
      const altMm  = preventivoItems[i].altezza  || 0;
      const mqRaw  = (largMm / 1000) * (altMm / 1000);
      const mqArrot = Math.ceil(mqRaw * 2) / 2;
      const badge = document.getElementById('mq-badge-'+i);
      if (badge) badge.value = mqArrot.toFixed(2);
      // aggiorna anche il testo raw→arrot
      const info = document.getElementById('mq-info-'+i);
      if (info) info.textContent = mqRaw.toFixed(2) + ' m² → arrot. ' + mqArrot.toFixed(2) + ' m²';
    }
  } else if (um === 'ml') {
    const lungMm = preventivoItems[i].larghezza || 0;
    const badge = document.getElementById('mq-badge-'+i);
    if (badge) badge.value = (lungMm/1000).toFixed(2);
  }
  refreshItemTotals(i);
}
function updateItemMqManuale(i, v) {
  preventivoItems[i].mqManuale = parseFloat(v) || 0;
  refreshItemTotals(i);
}
function resetMqManuale(i) {
  preventivoItems[i].mqManuale = null;
  renderPreventivoItems(); // ricostruisce con calcolo auto
}
function duplicaRiga(i) {
  const orig = preventivoItems[i];
  const copia = JSON.parse(JSON.stringify(orig));
  copia.larghezza = null;
  copia.altezza = null;
  copia.mqManuale = null;
  copia.descrizioneRiga = '';
  copia._copia = true;
  preventivoItems.splice(i + 1, 0, copia);
  renderPreventivoItems();
  toast('Riga duplicata — inserisci le nuove misure', 'info');
}
function updateItemDescRiga(i, v) { preventivoItems[i].descrizioneRiga = v; }
function removeItem(i) { preventivoItems.splice(i, 1); renderPreventivoItems(); }

function refreshItemTotals(i) {
  // Aggiorna solo il totale della riga e il riepilogo finale, senza ricostruire il DOM
  const lineTotal = calcLineTotal(preventivoItems[i]);
  const el = document.getElementById('item-total-'+i);
  if (el) el.textContent = fmt(lineTotal);
  // Ricalcola totale generale
  updateTotaleBox();
}

function updateTotaleBox() {
  const totBox = document.getElementById('pv-totale-box');
  if (!totBox || !preventivoItems.length) return;
  const iva = companyData.iva || 22;
  const subtot = preventivoItems.reduce((s, it) => s + calcLineTotal(it), 0);
  let scontoAmt = 0;
  if (_prevSconto.tipo === 'perc' && _prevSconto.valore > 0) scontoAmt = subtot * _prevSconto.valore / 100;
  else if (_prevSconto.tipo === 'fisso' && _prevSconto.valore > 0) scontoAmt = Math.min(_prevSconto.valore, subtot);
  const imponibile = subtot - scontoAmt;
  const ivaAmt = imponibile * iva / 100;
  const totale = imponibile + ivaAmt;
  const scontoSelected = (v) => _prevSconto.tipo === v ? 'selected' : '';
  totBox.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:12px">
      <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:10px;letter-spacing:0.5px;text-transform:uppercase">🏷️ Sconto Cliente</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select class="form-select" style="width:160px" onchange="updateScontoTipo(this.value)">
          <option value="nessuno" ${scontoSelected('nessuno')}>Nessuno sconto</option>
          <option value="perc" ${scontoSelected('perc')}>Sconto %</option>
          <option value="fisso" ${scontoSelected('fisso')}>Sconto importo fisso €</option>
        </select>
        ${_prevSconto.tipo !== 'nessuno' ? `
        <input class="form-input" type="number" min="0" step="1" style="width:130px"
          placeholder="${_prevSconto.tipo === 'perc' ? 'Es. 10 (%)' : 'Es. 200 (€)'}"
          value="${_prevSconto.valore||''}"
          onchange="updateScontoValore(this.value)">
        <span style="color:var(--gold-dark);font-weight:700;font-size:0.95rem">
          − ${_prevSconto.tipo === 'perc' ? _prevSconto.valore+'%' : ''} ${fmt(scontoAmt)}
        </span>` : ''}
      </div>
    </div>
    <div class="totale-box">
      <div class="totale-row" style="margin-bottom:6px"><span style="color:rgba(255,255,255,0.6)">Subtotale</span><span>${fmt(subtot)}</span></div>
      ${scontoAmt > 0 ? `<div class="totale-row" style="margin-bottom:6px"><span style="color:#7DCEA0">Sconto</span><span style="color:#7DCEA0">− ${fmt(scontoAmt)}</span></div>` : ''}
      <div class="totale-row" style="margin-bottom:6px"><span style="color:rgba(255,255,255,0.6)">Imponibile</span><span>${fmt(imponibile)}</span></div>
      <div class="totale-row" style="margin-bottom:12px"><span style="color:rgba(255,255,255,0.6)">IVA ${iva}%</span><span>${fmt(ivaAmt)}</span></div>
      <div class="totale-row"><span style="font-size:0.9rem">TOTALE</span><span class="totale-final">${fmt(totale)}</span></div>
    </div>`;
}

// ── PRODUCT PICKER ──
function openProductPicker() {
  window._pickerSelected = {};
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">Aggiungi Prodotti</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center">
        <div class="search-box" style="flex:1">
          <span class="search-icon">🔍</span>
          <input class="form-input" placeholder="Cerca prodotto..." oninput="filterPickerProducts(this.value)" id="picker-search">
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openProdottoModal(null, true)" title="Crea nuovo prodotto al volo">
          ✚ Nuovo
        </button>
      </div>
      <div class="product-grid" id="picker-grid"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
      <button class="btn btn-primary" onclick="confirmProductPick()">Aggiungi Selezionati</button>
    </div>`);

  renderPickerGrid(prodotti);
}

function renderPickerGrid(list) {
  const grid = document.getElementById('picker-grid');
  if (!grid) return;
  if (!list.length) { grid.innerHTML = `<div class="empty-state"><p>Nessun prodotto trovato</p></div>`; return; }
  grid.innerHTML = list.map(p => `
    <div class="product-pick-card ${window._pickerSelected[p.id]?'selected':''}" onclick="togglePick('${p.id}')">
      ${p.foto ? `<div style="height:80px;border-radius:6px;overflow:hidden;margin-bottom:8px;background:var(--surface2)"><img src="${p.foto}" style="width:100%;height:100%;object-fit:cover"></div>` : ''}
      <div class="product-pick-name">${p.nome}</div>
      <div class="product-pick-cat">${p.categoria||''} · ${p.materiale||''}</div>
      <div class="product-pick-price">${fmt(p.prezzo)} / ${p.um||'pz'}</div>
      ${p.descrizione ? `<div style="font-size:0.72rem;color:var(--text3);margin-top:4px;line-height:1.4">${p.descrizione.substring(0,80)}${p.descrizione.length>80?'...':''}</div>` : ''}
    </div>`).join('');
}

function togglePick(id) {
  window._pickerSelected[id] = !window._pickerSelected[id];
  renderPickerGrid(prodotti);
}

function filterPickerProducts(q) {
  renderPickerGrid(prodotti.filter(p => (p.nome+p.categoria+p.materiale).toLowerCase().includes(q.toLowerCase())));
}

function confirmProductPick() {
  const picked = Object.keys(window._pickerSelected).filter(id => window._pickerSelected[id]);
  if (!picked.length) { toast('Seleziona almeno un prodotto', 'error'); return; }
  picked.forEach(id => {
    const p = prodotti.find(x => x.id === id);
    if (p) {
      // Permette lo stesso prodotto più volte (misure diverse)
      preventivoItems.push({
        prodottoId: id, nome: p.nome, categoria: p.categoria,
        materiale: p.materiale, prezzo: p.prezzo, um: p.um || 'pz',
        foto: p.foto || null, descrizione: p.descrizione || '',
        sistema: p.sistema || '', coloreProfili: p.coloreProfili || '',
        coloreAccessori: p.coloreAccessori || '', altezzaManiglia: p.altezzaManiglia || null,
        tamponamento: p.tamponamento || '',
        qty: 1, larghezza: null, altezza: null, mqManuale: null, descrizioneRiga: ''
      });
    }
  });
  closeModal(); // chiude solo il picker, la modal preventivo rimane aperta
  renderPreventivoItems(); // aggiorna la lista nella modal sotto
  toast(`${picked.length} prodotto${picked.length>1?'i':''} aggiunto${picked.length>1?'i':''}!`, 'success');
}

// WHATSAPP
async function sendWhatsApp(prevId) {
  if (!can('whatsapp')) return;
  await Promise.all([loadPreventivi(), loadClienti(), loadCompany()]);
  const prev = preventivi.find(p => p.id === prevId);
  const cl = clienti.find(c => c.id === prev?.clienteId);
  const num = prev?.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero}` : `#${prev?.numero||prevId.slice(-4)}`;

  const tel = (cl?.telefono||'').replace(/\s+/g,'').replace(/^00/,'+').replace(/^0/,'+39');
  const msg = encodeURIComponent(
`Gentile ${cl?.cognome||'Cliente'}, le inviamo il preventivo ${num} per la fornitura di infissi.

Totale: *${fmt(prev?.totaleFinale)}*${prev?.validoFino ? '\nValido fino al: ' + new Date(prev.validoFino).toLocaleDateString('it-IT') : ''}

Per info: ${companyData.telefono||''} — ${companyData.nome||''}`);

  const url = tel ? `https://wa.me/${tel.replace('+','')}?text=${msg}` : `https://wa.me/?text=${msg}`;
  window.open(url, '_blank');
  toast('WhatsApp aperto!', 'success');
}

// FIRMA DIGITALE
function openFirmaModal(prevId) {
  if (!can('firmaDigitale')) return;
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">✍️ Firma Digitale</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text2);font-size:0.85rem;margin-bottom:12px">Il cliente firma qui con il dito (o mouse). La firma verrà salvata nel PDF.</p>
      <div style="border:2px solid var(--border);border-radius:10px;background:white;position:relative">
        <canvas id="firma-canvas" style="width:100%;height:200px;touch-action:none;cursor:crosshair;display:block"></canvas>
        <div style="position:absolute;bottom:8px;right:8px">
          <button class="btn btn-ghost btn-sm" onclick="clearFirma()" style="font-size:0.75rem">✕ Cancella</button>
        </div>
        <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);color:var(--border);font-size:0.8rem;pointer-events:none">Firma qui</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
      <button class="btn btn-primary" onclick="salvaFirma('${prevId}')">💾 Salva Firma</button>
    </div>`);

  setTimeout(() => initFirmaCanvas(), 100);
}

function initFirmaCanvas() {
  const canvas = document.getElementById('firma-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.strokeStyle = '#1C1A17';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let drawing = false;

  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left), y: (src.clientY - r.top) };
  };
  canvas.addEventListener('mousedown', e => { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', e => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); }, {passive:false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }, {passive:false});
  canvas.addEventListener('touchend', () => drawing = false);
}

function clearFirma() {
  const canvas = document.getElementById('firma-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function salvaFirma(prevId) {
  const canvas = document.getElementById('firma-canvas');
  if (!canvas) return;
  const firmaBase64 = canvas.toDataURL('image/png');
  await db.collection('preventivi').doc(prevId).update({
    firmaBase64,
    firmatoIl: new Date().toISOString(),
    stato: 'accettato',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  invalidaCache('preventivi');
  const p = preventivi.find(x => x.id === prevId);
  if (p) { p.firmaBase64 = firmaBase64; p.stato = 'accettato'; }
  closeModal();
  toast('Firma salvata! Stato aggiornato ad Accettato', 'success');
  renderPreventivi();
}

// NOTIFICHE SCADENZE
async function checkNotifiche() {
  if (!can('notifiche')) return;
  await Promise.all([loadPreventivi(), loadClienti()]);
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const alerts = [];

  preventivi.forEach(p => {
    if (p.stato === 'rifiutato' || p.stato === 'accettato') return;
    const cl = clienti.find(c => c.id === p.clienteId);
    const nome = cl ? `${cl.cognome} ${cl.nome}` : p.clienteNome || '—';
    const num = p.numeroPrefisso ? `${p.numeroPrefisso}/${p.numero}` : `#${p.numero||p.id.slice(-4)}`;

    // Scadenza vicina (≤5 giorni)
    if (p.validoFino) {
      const scad = new Date(p.validoFino);
      const diff = Math.round((scad - oggi) / (1000*60*60*24));
      if (diff >= 0 && diff <= 5) alerts.push({ tipo: 'scadenza', msg: `${num} — ${nome}: scade in ${diff} giorn${diff===1?'o':'i'}`, id: p.id });
      else if (diff < 0) alerts.push({ tipo: 'scaduto', msg: `${num} — ${nome}: scaduto da ${Math.abs(diff)} giorn${Math.abs(diff)===1?'o':'i'}`, id: p.id });
    }

    // In attesa da troppo tempo (>7 giorni da invio)
    if (p.stato === 'inviato' && p.updatedAt) {
      const upd = p.updatedAt.toDate ? p.updatedAt.toDate() : new Date(p.updatedAt);
      const giorni = Math.round((oggi - upd) / (1000*60*60*24));
      if (giorni >= 7) alerts.push({ tipo: 'attesa', msg: `${num} — ${nome}: in attesa da ${giorni} giorni`, id: p.id });
    }
  });

  if (!alerts.length) return;

  // Mostra badge notifiche nella topbar
  const badge = document.createElement('button');
  badge.className = 'btn btn-ghost btn-icon';
  badge.title = `${alerts.length} notifica${alerts.length>1?'e':''}`;
  badge.style.cssText = 'position:relative;color:var(--danger)';
  badge.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    <span style="position:absolute;top:4px;right:4px;width:8px;height:8px;background:var(--danger);border-radius:50%;border:2px solid white"></span>`;
  badge.onclick = () => mostraNotifiche(alerts);
  const searchBtn = document.getElementById('global-search-btn');
  if (searchBtn) searchBtn.parentElement.insertBefore(badge, searchBtn);
}

function mostraNotifiche(alerts) {
  const icone = { scadenza: '⏰', scaduto: '⚠️', attesa: '📬' };
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🔔 Notifiche (${alerts.length})</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;flex-direction:column;gap:8px">
        ${alerts.map(a => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface2);border-radius:8px;border-left:3px solid ${a.tipo==='scaduto'?'var(--danger)':a.tipo==='scadenza'?'#E67E22':'var(--info)'}">
            <span style="font-size:1.2rem">${icone[a.tipo]}</span>
            <div style="flex:1;font-size:0.88rem">${a.msg}</div>
            <button class="btn btn-ghost btn-sm" onclick="closeModal();openPreventivoModal('${a.id}')">Apri</button>
          </div>`).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>
    </div>`);
}