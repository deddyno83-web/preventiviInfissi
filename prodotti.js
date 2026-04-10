// ═══════════════════════════════════════════
//  prodotti.js — catalogo prodotti, picker, categorie al volo
// ═══════════════════════════════════════════

let prodotti = [];

async function loadProdotti(force = false) {
  if (!force && prodotti.length && _cacheValida('prodotti')) return;
  const snap = await db.collection('prodotti').orderBy('nome').get();
  prodotti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheDirty.prodotti = false;
  _cacheTs.prodotti = Date.now();
}

function renderProdotti() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary" onclick="openProdottoModal()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span class="btn-text">Nuovo Prodotto</span>
    </button>`;

  loadProdotti().then(() => {
    const cats = ['Tutti', ...new Set(prodotti.map(p => p.categoria).filter(Boolean))];
    document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div class="search-box" style="width:280px">
        <span class="search-icon">🔍</span>
        <input class="form-input" placeholder="Cerca prodotto..." oninput="filterProdotti(this.value)" id="search-prodotti">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="cat-filters">
        ${cats.map(c => `<button class="btn btn-sm ${c==='Tutti'?'btn-primary':'btn-secondary'}" onclick="filterByCat('${c}',this)">${c}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Prodotto</th><th>Categoria</th><th>Materiale</th>
            <th>Prezzo Base</th><th style="text-align:center">Azioni</th>
          </tr></thead>
          <tbody id="prodotti-tbody"></tbody>
        </table>
      </div>
    </div>`;
    renderProdottiTable(prodotti);
  });
}

function renderProdottiTable(list) {
  const tbody = document.getElementById('prodotti-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><h3>Nessun prodotto</h3><p>Aggiungi il primo prodotto al catalogo</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td style="display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:40px;border-radius:6px;overflow:hidden;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center">
          ${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:1.2rem">📦</span>`}
        </div>
        <div><strong>${p.nome}</strong>${p.descrizione?`<br><small style="color:var(--text3)">${p.descrizione.substring(0,60)}${p.descrizione.length>60?'...':''}</small>`:''}</div>
      </td>
      <td><span class="chip">${p.categoria||'—'}</span></td>
      <td>${p.materiale||'—'}</td>
      <td><strong>${fmt(p.prezzo)}</strong><br><small style="color:var(--text3)">${p.um||'pz'}</small></td>
      <td style="text-align:center">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openProdottoModal('${p.id}')" title="Modifica">✏️</button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteProdotto('${p.id}')" title="Elimina">🗑️</button>
      </td>
    </tr>`).join('');
}

let currentCatFilter = 'Tutti';
function filterProdotti(q) {
  const list = currentCatFilter === 'Tutti' ? prodotti : prodotti.filter(p => p.categoria === currentCatFilter);
  renderProdottiTable(list.filter(p => (p.nome+p.categoria+p.materiale).toLowerCase().includes(q.toLowerCase())));
}
function filterByCat(cat, btn) {
  currentCatFilter = cat;
  document.querySelectorAll('#cat-filters .btn').forEach(b => { b.className = 'btn btn-sm btn-secondary'; });
  btn.className = 'btn btn-sm btn-primary';
  const q = document.getElementById('search-prodotti')?.value || '';
  filterProdotti(q);
}

function openProdottoModal(id = null, fromPicker = false) {
  const p = id ? prodotti.find(x => x.id === id) : {};
  window._prodFotoBase64 = p.foto || null;
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${id ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nome / Modello *</label>
          <input class="form-input" id="p-nome" value="${p.nome||''}" placeholder="Es. Veka Softline 76">
        </div>
        <div class="form-group">
          <label class="form-label">Sistema</label>
          <input class="form-input" id="p-sistema" value="${p.sistema||''}" placeholder="Es. Veka - Softline 76 AD-MD">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Categoria *</label>
          <div style="display:flex;gap:6px;align-items:center">
            <select class="form-select" id="p-cat" style="flex:1">
              ${categorieList.map(c => `<option value="${c}" ${p.categoria===c?'selected':''}>${c}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap;padding:8px 10px" onclick="addCatAlVolo()" title="Aggiungi nuova categoria">+ Cat.</button>
          </div>
          <div id="nuova-cat-inline" style="display:none;margin-top:6px;display:none">
            <div style="display:flex;gap:6px">
              <input class="form-input" id="nuova-cat-val" placeholder="Nome nuova categoria..." style="flex:1;font-size:0.85rem"
                onkeydown="if(event.key==='Enter'){confermaCatAlVolo();event.preventDefault()}">
              <button class="btn btn-primary btn-sm" onclick="confermaCatAlVolo()">✓</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('nuova-cat-inline').style.display='none'">✕</button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Materiale</label>
          <div style="display:flex;gap:6px;align-items:center">
            <select class="form-select" id="p-mat" style="flex:1">
              ${materialiList.map(m => `<option value="${m}" ${p.materiale===m?'selected':''}>${m}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap;padding:8px 10px" onclick="addMatAlVolo()" title="Aggiungi nuovo materiale">+ Mat.</button>
          </div>
          <div id="nuova-mat-inline" style="display:none">
            <div style="display:flex;gap:6px;margin-top:6px">
              <input class="form-input" id="nuova-mat-val" placeholder="Nome nuovo materiale..." style="flex:1;font-size:0.85rem"
                onkeydown="if(event.key==='Enter'){confermaMatAlVolo();event.preventDefault()}">
              <button class="btn btn-primary btn-sm" onclick="confermaMatAlVolo()">✓</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('nuova-mat-inline').style.display='none'">✕</button>
            </div>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Colore Profili</label>
          <input class="form-input" id="p-coloreprofili" value="${p.coloreProfili||''}" placeholder="Es. RIVESTIMENTO 2L STD - MARRONE NOCE">
        </div>
        <div class="form-group">
          <label class="form-label">Colore Accessori</label>
          <input class="form-input" id="p-coloreaccess" value="${p.coloreAccessori||''}" placeholder="Es. OxBrz (Ox Bronzo)">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Altezza Maniglia (mm)</label>
          <input class="form-input" id="p-maniglia" type="number" step="1" value="${p.altezzaManiglia||''}" placeholder="Es. 500">
        </div>
        <div class="form-group">
          <label class="form-label">Prezzo Base (€) *</label>
          <input class="form-input" id="p-prezzo" type="number" step="1" value="${p.prezzo||''}" placeholder="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Unità di misura / Tipo vendita</label>
        <select class="form-select" id="p-um">
          <option value="pz" ${(p.um||'pz')==='pz'?'selected':''}>A pezzo (pz) — prezzo cadauno</option>
          <option value="mq" ${p.um==='mq'?'selected':''}>A metro quadro (m²) — prezzo per m² (dimensioni in mm)</option>
          <option value="ml" ${p.um==='ml'?'selected':''}>A metro lineare (ml) — prezzo per ml</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tamponamento / Vetro</label>
        <textarea class="form-textarea" id="p-tamponamento" placeholder="Es. 33.1 BE--14 Ar WE Psi0.036--4ExtC--14 Ar WE..." style="min-height:70px">${p.tamponamento||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Descrizione / Note prodotto</label>
        <textarea class="form-textarea" id="p-desc" placeholder="Altre note tecniche sul prodotto..." style="min-height:60px">${p.descrizione||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Foto prodotto</label>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div id="p-foto-preview" style="width:100px;height:80px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;cursor:pointer" onclick="document.getElementById('p-foto-file').click()">
            ${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:1.5rem;color:var(--text3)">📷</span>`}
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('p-foto-file').click()">📷 Carica foto</button>
            ${p.foto ? `<button class="btn btn-ghost btn-sm" onclick="removeProdFoto()" style="color:var(--danger)">✕ Rimuovi</button>` : ''}
            <div style="color:var(--text3);font-size:0.75rem;margin-top:6px">JPG, PNG — max 2MB</div>
          </div>
        </div>
        <input type="file" id="p-foto-file" accept="image/*" style="display:none" onchange="handleProdFoto(event)">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
      <button class="btn btn-primary" onclick="saveProdotto('${id||''}', ${fromPicker})">💾 Salva Prodotto</button>
    </div>`);
}


// ── Aggiungi categoria/materiale al volo dal modal prodotto ──
function addCatAlVolo() {
  const box = document.getElementById('nuova-cat-inline');
  if (box) { box.style.display = box.style.display === 'none' ? 'block' : 'none'; }
  setTimeout(() => document.getElementById('nuova-cat-val')?.focus(), 50);
}
async function confermaCatAlVolo() {
  const inp = document.getElementById('nuova-cat-val');
  const v = inp?.value.trim();
  if (!v) { toast('Inserisci il nome della categoria', 'error'); return; }
  if (categorieList.includes(v)) { toast('Categoria già presente', 'info'); return; }
  categorieList.push(v);
  await saveCatMat();
  // aggiorna il select
  const sel = document.getElementById('p-cat');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v; opt.selected = true;
    sel.appendChild(opt);
  }
  if (inp) inp.value = '';
  const box = document.getElementById('nuova-cat-inline');
  if (box) box.style.display = 'none';
  toast(`Categoria "${v}" aggiunta!`, 'success');
}

function addMatAlVolo() {
  const box = document.getElementById('nuova-mat-inline');
  if (box) { box.style.display = box.style.display === 'none' ? 'block' : 'none'; }
  setTimeout(() => document.getElementById('nuova-mat-val')?.focus(), 50);
}
async function confermaMatAlVolo() {
  const inp = document.getElementById('nuova-mat-val');
  const v = inp?.value.trim();
  if (!v) { toast('Inserisci il nome del materiale', 'error'); return; }
  if (materialiList.includes(v)) { toast('Materiale già presente', 'info'); return; }
  materialiList.push(v);
  await saveCatMat();
  const sel = document.getElementById('p-mat');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v; opt.selected = true;
    sel.appendChild(opt);
  }
  if (inp) inp.value = '';
  const box = document.getElementById('nuova-mat-inline');
  if (box) box.style.display = 'none';
  toast(`Materiale "${v}" aggiunto!`, 'success');
}

function handleProdFoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2*1024*1024) { toast('Foto troppo grande (max 2MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    window._prodFotoBase64 = ev.target.result;
    const prev = document.getElementById('p-foto-preview');
    if (prev) prev.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
    toast('Foto caricata — salva per confermare', 'info');
  };
  reader.readAsDataURL(file);
}
function removeProdFoto() {
  window._prodFotoBase64 = null;
  const prev = document.getElementById('p-foto-preview');
  if (prev) prev.innerHTML = `<span style="font-size:1.5rem;color:var(--text3)">📷</span>`;
}

async function saveProdotto(id, fromPicker = false) {
  const nome = document.getElementById('p-nome').value.trim();
  const prezzo = parseFloat(document.getElementById('p-prezzo').value);
  if (!nome || isNaN(prezzo)) { toast('Compila nome e prezzo', 'error'); return; }
  const data = {
    nome, prezzo,
    sistema: document.getElementById('p-sistema').value,
    categoria: document.getElementById('p-cat').value,
    materiale: document.getElementById('p-mat').value,
    coloreProfili: document.getElementById('p-coloreprofili').value,
    coloreAccessori: document.getElementById('p-coloreaccess').value,
    altezzaManiglia: parseInt(document.getElementById('p-maniglia').value)||null,
    tamponamento: document.getElementById('p-tamponamento').value,
    um: document.getElementById('p-um').value,
    descrizione: document.getElementById('p-desc').value,
    foto: window._prodFotoBase64 || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  let newDocId = id;
  if (id) {
    await db.collection('prodotti').doc(id).update(data);
    toast('Prodotto aggiornato!', 'success');
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('prodotti').add(data);
    newDocId = ref.id;
    toast('Prodotto aggiunto!', 'success');
  }
  // reload prodotti list
  invalidaCache('prodotti');
  await loadProdotti(true);
  closeModal();
  if (fromPicker) {
    // auto-select the new product and re-open picker
    const newProd = prodotti.find(p => p.id === newDocId);
    if (newProd) {
      preventivoItems.push({ prodottoId: newProd.id, nome: newProd.nome, categoria: newProd.categoria, materiale: newProd.materiale, prezzo: newProd.prezzo, um: newProd.um || 'pz', foto: newProd.foto || null, descrizione: newProd.descrizione || '', qty: 1, larghezza: null, altezza: null, mqManuale: null, descrizioneRiga: '' });
      renderPreventivoItems();
      toast('Prodotto creato e aggiunto al preventivo!', 'success');
    }
  } else {
    renderProdotti();
  }
}

async function deleteProdotto(id) {
  if (!confirm('Eliminare questo prodotto?')) return;
  await db.collection('prodotti').doc(id).delete();
  invalidaCache('prodotti');
  toast('Prodotto eliminato', 'info');
  renderProdotti();
}