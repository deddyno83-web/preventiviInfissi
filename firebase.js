// ═══════════════════════════════════════════
//  firebase.js — config, auth, cache, bozze
// ═══════════════════════════════════════════

// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDK2qpsavt2oDKD8T8MxeLz-hXRhAtL-Pc",
  authDomain: "infissipro-747ac.firebaseapp.com",
  projectId: "infissipro-747ac",
  storageBucket: "infissipro-747ac.firebasestorage.app",
  messagingSenderId: "53831286391",
  appId: "1:53831286391:web:d12b78cc0cb50b37b59072",
  measurementId: "G-E100WWF3JQ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Cache ibrida: dirty flag + TTL 3 minuti
const CACHE_TTL_MS = 3 * 60 * 1000;
const _cacheDirty = { preventivi: true, clienti: true, prodotti: true, company: true };
const _cacheTs    = { preventivi: 0,    clienti: 0,    prodotti: 0,    company: 0    };

function _cacheValida(key) {
  if (_cacheDirty[key]) return false;
  if (Date.now() - _cacheTs[key] > CACHE_TTL_MS) return false;
  return true;
}
function invalidaCache(key) {
  if (key) { _cacheDirty[key] = true; }
  else { Object.keys(_cacheDirty).forEach(k => _cacheDirty[k] = true); }
}

// AUTH
let currentUser = null;
const ADMIN_EMAIL = 'deddyno83@gmail.com';

const ALLOWED_EMAILS = ['deddyno83@gmail.com','gennarosimeoli1@gmail.com','lglsimeoli@gmail.com','simeoliinfissi@gmail.com']; // aggiungi altre mail qui

// Permessi default — vengono sovrascritti da Firestore
let features = {
  storicoClienti:  true,
  firmaDigitale:   false,
  whatsapp:        false,
  notifiche:       false,
};

function isAdmin() { return currentUser?.email === ADMIN_EMAIL; }
function can(feature) { return !!features[feature]; }

async function loadFeatures() {
  try {
    const doc = await db.collection('settings').doc('features').get();
    if (doc.exists) features = { ...features, ...doc.data() };
  } catch(e) { console.warn('loadFeatures error', e); }
}

async function saveFeatures() {
  await db.collection('settings').doc('features').set(features);
}

function signInGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => toast(e.message, 'error'));
}
function signOut() {
  if(confirm('Sei sicuro di voler uscire?')) auth.signOut();
}

auth.onAuthStateChanged(user => {
  if (user) {
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
      auth.signOut();
      toast('Accesso non autorizzato per questo account.', 'error');
      return;
    }
    currentUser = user;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    const initial = user.displayName ? user.displayName[0].toUpperCase() : user.email[0].toUpperCase();
    document.getElementById('sidebar-initial').textContent = initial;
    document.getElementById('sidebar-name').textContent = user.displayName || user.email;
    if (user.photoURL) {
      document.getElementById('sidebar-avatar').innerHTML = `<img src="${user.photoURL}" alt="">`;
    }
    // Carica features poi naviga — usa .then() per evitare await in callback non-async
    loadFeatures().then(() => {
      navigate('dashboard');
      if (can('notifiche')) checkNotifiche();
    });
  } else {
    currentUser = null;
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

// BOZZE LOCALI
const BOZZE_KEY = 'infissipro_bozze';

function salvaBozzaLocale(id, data) {
  try {
    const bozze = JSON.parse(localStorage.getItem(BOZZE_KEY) || '{}');
    const chiave = id || ('new_' + Date.now());
    bozze[chiave] = { id, data, ts: Date.now(), _chiave: chiave };
    localStorage.setItem(BOZZE_KEY, JSON.stringify(bozze));
    return chiave;
  } catch(e) { console.warn('Impossibile salvare bozza locale:', e); return null; }
}

function rimuoviBozzaLocale(chiave) {
  try {
    const bozze = JSON.parse(localStorage.getItem(BOZZE_KEY) || '{}');
    delete bozze[chiave];
    localStorage.setItem(BOZZE_KEY, JSON.stringify(bozze));
  } catch(e) {}
}

function getBozzeLocali() {
  try {
    return Object.values(JSON.parse(localStorage.getItem(BOZZE_KEY) || '{}'));
  } catch(e) { return []; }
}

async function sincronizzaBozzeInSospeso() {
  const bozze = getBozzeLocali();
  if (!bozze.length) return;
  let sincronizzate = 0;
  for (const bozza of bozze) {
    try {
      const d = { ...bozza.data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (bozza.id) {
        await db.collection('preventivi').doc(bozza.id).update(d);
      } else {
        const countSnap = await db.collection('preventivi').get();
        d.numero = String(countSnap.size + 1).padStart(4, '0');
        d.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('preventivi').add(d);
      }
      rimuoviBozzaLocale(bozza._chiave);
      sincronizzate++;
    } catch(e) { /* lascia la bozza per dopo */ }
  }
  if (sincronizzate > 0) {
    aggiornaBadgeBozze();
    toast(`✅ ${sincronizzate} preventivo${sincronizzate>1?'i':''} recuperato${sincronizzate>1?'i':''} dalla bozza locale!`, 'success');
    renderPreventivi();
  }
}

function mostraPannelloBozze() {
  const bozze = getBozzeLocali();
  if (!bozze.length) { toast('Nessuna bozza locale trovata', 'info'); return; }
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📋 Bozze non salvate (${bozze.length})</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text2);font-size:0.88rem;margin-bottom:16px">
        Questi preventivi erano in attesa di sincronizzazione. Clicca "Recupera tutto" per salvarli su Firebase.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${bozze.map(b => {
          const minFa = Math.round((Date.now() - b.ts) / 60000);
          const cl = clienti.find(c => c.id === b.data?.clienteId);
          const nomeCliente = cl ? cl.cognome + ' ' + cl.nome : b.data?.clienteNome || '—';
          return `<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;border-left:3px solid var(--gold)">
            <div style="font-weight:600;font-size:0.9rem">${nomeCliente}</div>
            <div style="font-size:0.75rem;color:var(--text3);margin-top:2px">
              Salvato localmente ${minFa < 60 ? minFa + ' minuti fa' : Math.round(minFa/60) + ' ore fa'} 
              · ${b.data?.items?.length || 0} prodotti
              · ${b.id ? 'Modifica' : 'Nuovo preventivo'}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>
      <button class="btn btn-primary" onclick="closeModal();sincronizzaBozzeInSospeso()">
        ☁️ Recupera tutto su Firebase
      </button>
    </div>`);
}

async function savePreventivo(id) {
  const clienteId = document.getElementById('pv-cliente').value;
  if (!clienteId) { toast('Seleziona un cliente', 'error'); return; }
  if (!preventivoItems.length) { toast('Aggiungi almeno un prodotto', 'error'); return; }

  const iva = companyData.iva || 22;
  const subtotale = preventivoItems.reduce((s, it) => s + calcLineTotal(it), 0);
  let scontoAmt = 0;
  if (_prevSconto.tipo === 'perc' && _prevSconto.valore > 0) scontoAmt = subtotale * _prevSconto.valore / 100;
  else if (_prevSconto.tipo === 'fisso' && _prevSconto.valore > 0) scontoAmt = Math.min(_prevSconto.valore, subtotale);
  const imponibile = subtotale - scontoAmt;
  const ivaAmt = imponibile * iva / 100;
  const totaleFinale = imponibile + ivaAmt;
  const cl = clienti.find(c => c.id === clienteId);

  const prefisso = document.getElementById('pv-prefisso')?.value.trim() || String(new Date().getFullYear());
  const validoFino = document.getElementById('pv-validita')?.value || null;
  const noteInterne = document.getElementById('pv-note-interne')?.value || '';
  const tempiConsegna = document.getElementById('pv-tempi')?.value || '';
  const pagamenti = document.getElementById('pv-pagamenti')?.value || '';

  // Rimuovi foto base64 dagli items (Firestore limite 1MB)
  const itemsPerSalvataggio = preventivoItems.map(it => {
    const { foto, ...itemSenzaFoto } = it;
    return itemSenzaFoto;
  });

  // Controllo dimensione
  if (JSON.stringify(itemsPerSalvataggio).length > 900000) {
    toast('⚠ Preventivo troppo grande. Riduci il numero di prodotti.', 'error');
    return;
  }

  const data = {
    clienteId,
    clienteNome: cl ? `${cl.cognome} ${cl.nome}` : '',
    stato: document.getElementById('pv-stato').value,
    note: document.getElementById('pv-note').value,
    noteInterne, tempiConsegna, pagamenti,
    numeroPrefisso: prefisso, validoFino,
    items: itemsPerSalvataggio,
    subtotale, scontoAmt, scontoTipo: _prevSconto.tipo, scontoValore: _prevSconto.valore,
    imponibile, ivaAmt, totaleFinale, ivaPerc: iva,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // ── LIVELLO 1: salva subito in localStorage ──
  const chiaveBozza = salvaBozzaLocale(id, data);

  // Feedback sul bottone
  const saveBtn = document.getElementById('btn-salva-preventivo');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Salvataggio...'; }

  // ── LIVELLO 2: salva su Firebase con 3 tentativi ──
  const MAX_TENTATIVI = 3;
  let ultimoErrore = null;

  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    try {
      if (tentativo > 1) {
        if (saveBtn) saveBtn.textContent = `⏳ Tentativo ${tentativo}/${MAX_TENTATIVI}...`;
        await firebase.firestore().enableNetwork();
        await new Promise(r => setTimeout(r, tentativo * 1000));
      }

      if (id) {
        await db.collection('preventivi').doc(id).update(data);
      } else {
        const countSnap = await db.collection('preventivi').get();
        data.numero = String(countSnap.size + 1).padStart(4, '0');
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('preventivi').add(data);
      }

      // ✅ Successo — rimuovi bozza locale e chiudi
      rimuoviBozzaLocale(chiaveBozza);
      aggiornaBadgeBozze();
      invalidaCache('preventivi');
      toast(id ? 'Preventivo aggiornato!' : 'Preventivo salvato!', 'success');
      closeModal();
      renderPreventivi();
      return;

    } catch(err) {
      ultimoErrore = err;
      console.warn(`Tentativo ${tentativo} fallito:`, err.code, err.message);
    }
  }

  // ── LIVELLO 3: tutti i tentativi falliti — dati al sicuro in locale ──
  console.error('Salvataggio Firebase fallito dopo 3 tentativi:', ultimoErrore);
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Salva Preventivo'; }

  // Mostra avviso con opzione di recupero
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title" style="color:var(--danger)">⚠️ Problema di connessione</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-weight:700;margin-bottom:6px">✅ I tuoi dati sono al sicuro</div>
        <div style="font-size:0.88rem;color:var(--text2)">
          Il preventivo è stato salvato localmente su questo dispositivo. 
          Non hai perso nulla.
        </div>
      </div>
      <div style="font-size:0.88rem;color:var(--text2);margin-bottom:12px">
        <strong>Errore:</strong> ${ultimoErrore?.message || ultimoErrore?.code || 'Connessione a Firebase non disponibile'}
      </div>
      <div style="font-size:0.88rem;color:var(--text2)">
        Quando la connessione torna, clicca <strong>"Riprova sincronizzazione"</strong> per salvare su Firebase.
      </div>
    </div>
    <div class="modal-footer" style="flex-wrap:wrap;gap:8px">
      <button class="btn btn-secondary" onclick="closeModal()">Chiudi — riprovo dopo</button>
      <button class="btn btn-primary" onclick="closeModal();sincronizzaBozzeInSospeso()">
        ☁️ Riprova sincronizzazione
      </button>
    </div>`);
}

// ── DUPLICA PREVENTIVO ──
async function duplicaPreventivo(id) {
  if (!confirm('Duplicare questo preventivo come nuova bozza?')) return;
  toast('Duplicazione in corso...', 'info');
  await Promise.all([loadPreventivi(), loadClienti()]);
  const orig = preventivi.find(p => p.id === id);
  if (!orig) { toast('Preventivo non trovato', 'error'); return; }

  const countSnap = await db.collection('preventivi').get();
  const nuovoNumero = String(countSnap.size + 1).padStart(4, '0');

  const data = {
    clienteId: orig.clienteId,
    clienteNome: orig.clienteNome,
    stato: 'bozza',
    note: orig.note || '',
    noteInterne: orig.noteInterne || '',
    items: JSON.parse(JSON.stringify(orig.items || [])),
    subtotale: orig.subtotale || 0,
    scontoAmt: orig.scontoAmt || 0,
    scontoTipo: orig.scontoTipo || 'nessuno',
    scontoValore: orig.scontoValore || 0,
    imponibile: orig.imponibile || 0,
    ivaAmt: orig.ivaAmt || 0,
    totaleFinale: orig.totaleFinale || 0,
    ivaPerc: orig.ivaPerc || 22,
    numero: nuovoNumero,
    numeroPrefisso: orig.numeroPrefisso || '',
    validoFino: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('preventivi').add(data);
  invalidaCache('preventivi');
  toast(`Preventivo duplicato come #${nuovoNumero} — Bozza!`, 'success');
  renderPreventivi();
}

async function deletePreventivo(id) {
  if (!confirm('Eliminare questo preventivo?')) return;
  await db.collection('preventivi').doc(id).delete();
  invalidaCache('preventivi');
  toast('Preventivo eliminato', 'info');
  renderPreventivi();
}