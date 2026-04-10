// ═══════════════════════════════════════════
//  clienti.js — anagrafica clienti, storico
// ═══════════════════════════════════════════

let clienti = [];

async function loadClienti(force = false) {
  if (!force && clienti.length && _cacheValida('clienti')) return;
  const snap = await db.collection('clienti').orderBy('cognome').get();
  clienti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheDirty.clienti = false;
  _cacheTs.clienti = Date.now();
}

function renderClienti() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary" onclick="openClienteModal()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span class="btn-text">Nuovo Cliente</span>
    </button>`;

  loadClienti().then(() => {
    document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div class="search-box" style="width:280px">
        <span class="search-icon">🔍</span>
        <input class="form-input" placeholder="Cerca cliente..." oninput="filterClienti(this.value)">
      </div>
      <span class="text-muted" style="font-size:0.85rem">${clienti.length} cliente${clienti.length===1?'':'i'}</span>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Nome</th><th>Email</th><th>Telefono</th><th>Città</th><th style="text-align:center">Azioni</th>
          </tr></thead>
          <tbody id="clienti-tbody"></tbody>
        </table>
      </div>
    </div>`;
    renderClientiTable(clienti);
  });
}

function renderClientiTable(list) {
  const tbody = document.getElementById('clienti-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><h3>Nessun cliente</h3><p>Aggiungi il primo cliente all'anagrafica</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>
        <strong>${c.cognome} ${c.nome}</strong>
        ${c.azienda ? `<br><small style="color:var(--text3)">${c.azienda}</small>` : ''}
      </td>
      <td>${c.email||'—'}</td>
      <td>${c.telefono||'—'}</td>
      <td>${c.citta||'—'}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openClienteModal('${c.id}')" title="Modifica">✏️</button>
        ${can('storicoClienti') ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="openStoricoCliente('${c.id}')" title="Storico preventivi" style="color:var(--info)">📋</button>` : ''}
        <button class="btn btn-ghost btn-sm btn-icon" onclick="newPreventivoForCliente('${c.id}')" title="Nuovo preventivo" style="color:var(--gold-dark)">➕</button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteCliente('${c.id}')" title="Elimina" style="color:var(--text3)">🗑️</button>
      </td>
    </tr>`).join('');
}

function filterClienti(q) {
  renderClientiTable(clienti.filter(c => (c.cognome+c.nome+c.azienda+c.email).toLowerCase().includes(q.toLowerCase())));
}

function openClienteModal(id = null) {
  const c = id ? clienti.find(x => x.id === id) : {};
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${id ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cognome *</label>
          <input class="form-input" id="c-cognome" value="${c.cognome||''}" placeholder="Rossi">
        </div>
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-input" id="c-nome" value="${c.nome||''}" placeholder="Mario">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Azienda</label>
        <input class="form-input" id="c-azienda" value="${c.azienda||''}" placeholder="Rossi & Figli Srl (opzionale)">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="c-email" type="email" value="${c.email||''}" placeholder="mario.rossi@email.it">
        </div>
        <div class="form-group">
          <label class="form-label">Telefono</label>
          <input class="form-input" id="c-tel" value="${c.telefono||''}" placeholder="+39 333 000000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Indirizzo</label>
          <input class="form-input" id="c-addr" value="${c.indirizzo||''}" placeholder="Via Roma 1">
        </div>
        <div class="form-group">
          <label class="form-label">CAP / Città</label>
          <input class="form-input" id="c-citta" value="${c.citta||''}" placeholder="80100 Napoli">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Note</label>
        <textarea class="form-textarea" id="c-note" placeholder="Note interne sul cliente...">${c.note||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
      <button class="btn btn-primary" onclick="saveCliente('${id||''}')">💾 Salva Cliente</button>
    </div>`);
}

async function saveCliente(id) {
  const cognome = document.getElementById('c-cognome').value.trim();
  const nome = document.getElementById('c-nome').value.trim();
  if (!cognome) { toast('Inserisci almeno il cognome', 'error'); return; }
  const data = {
    cognome, nome,
    azienda: document.getElementById('c-azienda').value,
    email: document.getElementById('c-email').value,
    telefono: document.getElementById('c-tel').value,
    indirizzo: document.getElementById('c-addr').value,
    citta: document.getElementById('c-citta').value,
    note: document.getElementById('c-note').value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (id) {
    await db.collection('clienti').doc(id).update(data);
    toast('Cliente aggiornato!', 'success');
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('clienti').add(data);
    toast('Cliente aggiunto!', 'success');
  }
  invalidaCache('clienti');
  closeModal();
  renderClienti();
}

async function deleteCliente(id) {
  if (!confirm('Eliminare questo cliente?')) return;
  await db.collection('clienti').doc(id).delete();
  invalidaCache('clienti');
  toast('Cliente eliminato', 'info');
  renderClienti();
}

function newPreventivoForCliente(clienteId) {
  navigate('preventivi');
  setTimeout(() => openPreventivoModal(null, clienteId), 300);
}

// STORICO PREVENTIVI PER CLIENTE
async function openStoricoCliente(clienteId) {
  if (!can('storicoClienti')) return;
  await Promise.all([loadPreventivi(), loadClienti()]);
  const c = clienti.find(x => x.id === clienteId);
  const prevCliente = preventivi.filter(p => p.clienteId === clienteId);
  const totAccettati = prevCliente.filter(p => p.stato === 'accettato').reduce((s, p) => s + (p.totaleFinale||0), 0);

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📋 Storico — ${c?.cognome||''} ${c?.nome||''}</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
        <div style="background:var(--surface2);border-radius:10px;padding:12px 18px;flex:1;text-align:center">
          <div style="font-size:1.6rem;font-weight:700;font-family:'Playfair Display',serif">${prevCliente.length}</div>
          <div style="font-size:0.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Preventivi totali</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:12px 18px;flex:1;text-align:center">
          <div style="font-size:1.6rem;font-weight:700;font-family:'Playfair Display',serif;color:var(--success)">${prevCliente.filter(p=>p.stato==='accettato').length}</div>
          <div style="font-size:0.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Accettati</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:12px 18px;flex:1;text-align:center">
          <div style="font-size:1.3rem;font-weight:700;font-family:'Playfair Display',serif;color:var(--gold-dark)">${fmt(totAccettati)}</div>
          <div style="font-size:0.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Valore accettato</div>
        </div>
      </div>
      ${!prevCliente.length ? `<div class="empty-state"><p>Nessun preventivo per questo cliente</p></div>` : `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${prevCliente.map(p => {
          const num = p.numeroPrefisso ? `${p.numeroPrefisso}/${p.numero}` : `#${p.numero||p.id.slice(-4)}`;
          const badgeCol = {bozza:'var(--text3)',inviato:'var(--info)',accettato:'var(--success)',rifiutato:'var(--danger)'}[p.stato||'bozza'];
          return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--surface2);border-radius:8px;border-left:3px solid ${badgeCol}">
            <div>
              <div style="font-weight:700;font-size:0.9rem">${num}</div>
              <div style="color:var(--text3);font-size:0.75rem">${fmtDate(p.createdAt)}${p.validoFino?' · valido fino '+new Date(p.validoFino).toLocaleDateString('it-IT'):''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;color:var(--gold-dark)">${fmt(p.totaleFinale)}</div>
              <div style="font-size:0.75rem;color:${badgeCol};font-weight:600">${p.stato||'bozza'}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="closeModal();openPreventivoModal('${p.id}')" title="Apri">✏️</button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="generatePDF('${p.id}')" title="PDF" style="color:var(--danger)">📄</button>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>
      <button class="btn btn-primary" onclick="closeModal();newPreventivoForCliente('${clienteId}')">+ Nuovo Preventivo</button>
    </div>`, true);
}