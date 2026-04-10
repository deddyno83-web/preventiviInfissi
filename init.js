// ══════════════════════════════════════════════════════
//  onAuthStateChanged — qui perché init.js è l'ULTIMO
//  file caricato: tutte le funzioni degli altri moduli
//  (navigate, renderDashboard, checkNotifiche...) 
//  sono già disponibili quando questo codice gira.
// ══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════
//  init.js — avvio app, rilevamento standby
// ═══════════════════════════════════════════

loadCompany();
loadCatMat();
loadFeatures();

// ── Controlla bozze in sospeso all'avvio e al ritorno online ──
window.addEventListener('online', () => {
  const bozze = getBozzeLocali();
  if (bozze.length > 0) {
    toast(`🔄 Connessione ripristinata — ${bozze.length} preventivo${bozze.length>1?'i':''} in attesa di sincronizzazione`, 'info');
    setTimeout(() => sincronizzaBozzeInSospeso(), 2000);
  }
});

function aggiornaBadgeBozze() {
  const bozze = getBozzeLocali();
  const esistente = document.getElementById('badge-bozze-btn');
  if (bozze.length === 0) {
    if (esistente) esistente.remove();
    return;
  }
  if (esistente) {
    esistente.title = `${bozze.length} preventivo${bozze.length>1?'i':''} non sincronizzato${bozze.length>1?'i':''}`;
    const span = esistente.querySelector('span');
    if (span) span.textContent = bozze.length;
    return;
  }
  const btn = document.createElement('button');
  btn.id = 'badge-bozze-btn';
  btn.className = 'btn btn-ghost btn-icon';
  btn.title = `${bozze.length} preventivo${bozze.length>1?'i':''} non sincronizzato${bozze.length>1?'i':''}`;
  btn.style.cssText = 'position:relative;color:#E67E22';
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    <span style="position:absolute;top:2px;right:2px;background:#E67E22;color:white;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700">${bozze.length}</span>`;
  btn.onclick = () => mostraPannelloBozze();
  const searchBtn = document.getElementById('global-search-btn');
  if (searchBtn) searchBtn.parentElement.insertBefore(btn, searchBtn);
}

// ── Rilevamento standby/risveglio ──
// Quando il PC esce dallo standby, il browser può aver perso la connessione Firebase
let _lastActivityTs = Date.now();
let _connWarningShown = false;

// Aggiorna timestamp ogni volta che l'utente interagisce
document.addEventListener('click', () => { _lastActivityTs = Date.now(); });
document.addEventListener('keydown', () => { _lastActivityTs = Date.now(); });

// Controlla ogni 30 secondi se la pagina era inattiva (standby)
setInterval(() => {
  const now = Date.now();
  const inattivita = now - _lastActivityTs;
  // Se la pagina era inattiva per più di 5 minuti, probabilmente c'è stato standby
  if (inattivita > 5 * 60 * 1000 && !_connWarningShown) {
    // Non fare nulla di visivo, ma riabilita la rete Firebase silenziosamente
    firebase.firestore().enableNetwork().catch(() => {});
  }
}, 30000);

// Riconnetti Firebase quando la pagina torna in primo piano (visibilitychange)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const inattivita = Date.now() - _lastActivityTs;
    // Se era inattivo da più di 2 minuti, riconnetti e ricarica i dati
    if (inattivita > 2 * 60 * 1000) {
      firebase.firestore().enableNetwork().then(() => {
        // Ricarica dati silenziosamente
        loadPreventivi().catch(() => {});
        loadClienti().catch(() => {});
        // Se siamo sulla pagina preventivi, aggiorna la tabella
        if (currentPage === 'preventivi') {
          Promise.all([loadPreventivi(), loadClienti()]).then(() => {
            applicaFiltriPreventivi();
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    _lastActivityTs = Date.now();
  }
});

// Controlla bozze in sospeso all'avvio
setTimeout(() => {
  const bozze = getBozzeLocali();
  if (bozze.length > 0) {
    aggiornaBadgeBozze();
    const oldest = Math.round((Date.now() - Math.min(...bozze.map(b => b.ts))) / 60000);
    toast(`⚠ ${bozze.length} preventivo${bozze.length>1?'i':''} non sincronizzato${bozze.length>1?'i':''} (${oldest < 60 ? oldest + ' min fa' : Math.round(oldest/60) + ' ore fa'}) — clicca 📤 per recuperare`, 'info');
  }
}, 3000);