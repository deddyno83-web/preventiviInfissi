import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Impostazioni from './pages/Impostazioni';
import Clienti from './pages/Clienti';
import Preventivi from './pages/Preventivi';
import Prodotti from './pages/Prodotti';
import Categorie from './pages/Categorie';
import Dashboard from './pages/Dashboard';
import { getBozzeLocali, sincronizzaBozzeInSospeso } from './utils/actions';
import { db } from './services/firebase';
import './index.css';

// Componente Auth Screen
function AuthScreen() {
  const { signInGoogle } = useAuth();
  
  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">InfissiPro</div>
        <div className="auth-sub">Gestione Preventivi</div>
        <p className="auth-tagline">Il tuo studio digitale per preventivi professionali su infissi, porte e finestre.</p>
        <button className="btn-google" onClick={signInGoogle}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.3 30.2 0 24 0 14.6 0 6.6 5.5 2.7 13.4l7.9 6.1C12.5 13.1 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
            <path fill="#FBBC05" d="M10.6 28.5c-.5-1.5-.8-3.2-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C.9 15.9 0 19.8 0 24s.9 8.1 2.7 11.3l7.9-5.8z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.5-2.1 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.2 0-11.5-3.6-13.4-8.8l-7.9 5.8C6.6 42.5 14.6 48 24 48z"/>
          </svg>
          Accedi con Google
        </button>
        <div className="auth-note">Accesso riservato agli utenti autorizzati</div>
      </div>
    </div>
  );
}

// Layout Principale
function MainLayout() {
  const { currentUser, signOut, features } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [newPrevClientId, setNewPrevClientId] = useState(null);
  const [openNewPrev, setOpenNewPrev] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [notifiche, setNotifiche] = useState([]);
  const [showNotifiche, setShowNotifiche] = useState(false);
  const [bozzeCount, setBozzeCount] = useState(0);
  const searchRef = useRef(null);

  // Controlla bozze locali e sincronizza
  useEffect(() => {
    setBozzeCount(getBozzeLocali().length);
    sincronizzaBozzeInSospeso((n) => {
      alert(`✅ ${n} preventivo${n > 1 ? 'i' : ''} recuperato${n > 1 ? 'i' : ''} dalla memoria locale!`);
      setBozzeCount(0);
    });
  }, []);

  // Notifiche scadenze — solo se la funzionalità è abilitata
  useEffect(() => {
    if (!features?.notifiche) { setNotifiche([]); return; }
    async function checkNotifiche() {
      try {
        const [pSnap, cSnap] = await Promise.all([
          db.collection('preventivi').get(),
          db.collection('clienti').get()
        ]);
        const preventivi = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const clienti = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const oggi = new Date(); oggi.setHours(0,0,0,0);
        const alerts = [];
        preventivi.forEach(p => {
          if (p.stato === 'rifiutato' || p.stato === 'accettato') return;
          const cl = clienti.find(c => c.id === p.clienteId);
          const nome = cl ? `${cl.cognome} ${cl.nome}` : p.clienteNome || '—';
          const num = p.numeroPrefisso ? `${p.numeroPrefisso}/${p.numero}` : `#${p.numero || p.id.slice(-4)}`;
          if (p.validoFino) {
            const diff = Math.round((new Date(p.validoFino) - oggi) / 86400000);
            if (diff >= 0 && diff <= 5) alerts.push({ tipo: 'scadenza', msg: `${num} — ${nome}: scade in ${diff} giorn${diff === 1 ? 'o' : 'i'}`, id: p.id });
            else if (diff < 0) alerts.push({ tipo: 'scaduto', msg: `${num} — ${nome}: scaduto da ${Math.abs(diff)} giorni`, id: p.id });
          }
          if (p.stato === 'inviato' && p.updatedAt) {
            const upd = p.updatedAt.toDate ? p.updatedAt.toDate() : new Date(p.updatedAt);
            const giorni = Math.round((oggi - upd) / 86400000);
            if (giorni >= 7) alerts.push({ tipo: 'attesa', msg: `${num} — ${nome}: in attesa da ${giorni} giorni`, id: p.id });
          }
        });
        setNotifiche(alerts);
      } catch (e) { console.warn('checkNotifiche error', e); }
    }
    checkNotifiche();
  }, [features?.notifiche]);

  // Chiudi ricerca cliccando fuori
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  
  return (
    <div id="app" style={{ display: 'block' }}>
      <div className="sidebar-overlay" id="sidebar-overlay"></div>
      
      {/* SIDEBAR */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-logo">
           <div className="sidebar-logo-name">InfissiPro</div>
           <div className="sidebar-logo-sub">Gestione Preventivi</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-label">Menu</div>
            <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><span className="icon">⊞</span> Dashboard</button>
            <button className={`nav-item ${activeTab === 'preventivi' ? 'active' : ''}`} onClick={() => setActiveTab('preventivi')}><span className="icon">📋</span> Preventivi</button>
            <button className={`nav-item ${activeTab === 'prodotti' ? 'active' : ''}`} onClick={() => setActiveTab('prodotti')}><span className="icon">📦</span> Prodotti</button>
            <button className={`nav-item ${activeTab === 'categorie' ? 'active' : ''}`} style={{ paddingLeft: '28px', fontSize: '0.82rem', opacity: 0.85 }} onClick={() => setActiveTab('categorie')}><span className="icon">🏷️</span> Categorie & Materiali</button>
            <button className={`nav-item ${activeTab === 'clienti' ? 'active' : ''}`} onClick={() => setActiveTab('clienti')}><span className="icon">👥</span> Clienti</button>
          </div>
          <div className="nav-section">
            <div className="nav-label">Sistema</div>
            <button className={`nav-item ${activeTab === 'impostazioni' ? 'active' : ''}`} onClick={() => setActiveTab('impostazioni')}><span className="icon">⚙</span> Impostazioni</button>
          </div>
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar" id="sidebar-avatar">
            {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" /> : <span id="sidebar-initial">{currentUser?.email?.[0].toUpperCase() || '?'}</span>}
          </div>
          <div className="user-name" id="sidebar-name">{currentUser?.displayName || currentUser?.email}</div>
          <button className="btn-logout" onClick={signOut} title="Esci">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            {activeTab === 'dashboard' && <h1 className="topbar-title">Dashboard</h1>}
            {activeTab === 'clienti' && <h1 className="topbar-title">Clienti</h1>}
            {activeTab === 'preventivi' && <h1 className="topbar-title">Preventivi</h1>}
            {activeTab === 'prodotti' && <h1 className="topbar-title">Catalogo Prodotti</h1>}
            {activeTab === 'categorie' && <h1 className="topbar-title">Categorie e Materiali</h1>}
          </div>
          <div className="topbar-actions" style={{ gap: '6px' }}>
            {/* Nuovo Preventivo (solo su tab preventivi) */}
            {activeTab === 'preventivi' && (
              <button className="btn btn-primary btn-sm" onClick={() => setOpenNewPrev(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nuovo Preventivo
              </button>
            )}
            {/* Badge bozze */}
            {bozzeCount > 0 && (
              <button className="btn btn-ghost btn-icon" title={`${bozzeCount} bozza${bozzeCount > 1 ? 'e' : ''} locale${bozzeCount > 1 ? 'i' : ''}`}
                style={{ position: 'relative', color: '#E67E22' }}
                onClick={() => sincronizzaBozzeInSospeso((n) => { alert(`✅ ${n} preventivo${n > 1 ? 'i' : ''} recuperati!`); setBozzeCount(0); })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#E67E22', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{bozzeCount}</span>
              </button>
            )}
            {/* Badge notifiche */}
            {notifiche.length > 0 && (
              <button className="btn btn-ghost btn-icon" style={{ position: 'relative', color: 'var(--danger)' }}
                title={`${notifiche.length} notifica${notifiche.length > 1 ? 'e' : ''}`}
                onClick={() => setShowNotifiche(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', border: '2px solid white' }}></span>
              </button>
            )}
            {/* Ricerca globale */}
            <div ref={searchRef} style={{ position: 'relative' }}>
              <button id="global-search-btn" className="btn btn-ghost btn-icon" onClick={() => setShowSearch(v => !v)} title="Ricerca globale">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              {showSearch && (
                <div style={{ position: 'absolute', right: 0, top: '40px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', width: '340px', zIndex: 500, padding: '12px' }}>
                  <input autoFocus className="form-input" placeholder="Cerca preventivi, clienti, prodotti..." value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} />
                  {searchQuery.length >= 2 && (
                    <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text3)', padding: '8px' }}>
                      Premi invio o usa i filtri nella sezione specifica.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        
        {activeTab === 'dashboard' && <main className="content"><Dashboard setActiveTab={setActiveTab} /></main>}
        {activeTab === 'preventivi' && <main className="content"><Preventivi initialClienteId={newPrevClientId} onClearInitialCliente={() => setNewPrevClientId(null)} openNewPrev={openNewPrev} onClearOpenNewPrev={() => setOpenNewPrev(false)} /></main>}
        {activeTab === 'prodotti' && <main className="content"><Prodotti /></main>}
        {activeTab === 'categorie' && <main className="content"><Categorie /></main>}
        {activeTab === 'clienti' && <main className="content"><Clienti onNuovoPreventivo={(cid) => { setNewPrevClientId(cid); setActiveTab('preventivi'); }} /></main>}
        {activeTab === 'impostazioni' && <main className="content"><Impostazioni /></main>}
      </div>

      {/* NOTIFICHE MODAL */}
      {showNotifiche && (
        <div className="modal-overlay open" style={{ zIndex: 1000 }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">🔔 Notifiche ({notifiche.length})</h2>
              <button className="btn-close" onClick={() => setShowNotifiche(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifiche.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--surface2)', borderRadius: '8px',
                    borderLeft: `3px solid ${a.tipo === 'scaduto' ? 'var(--danger)' : a.tipo === 'scadenza' ? '#E67E22' : 'var(--info)'}` }}>
                    <span style={{ fontSize: '1.2rem' }}>{a.tipo === 'scaduto' ? '⚠️' : a.tipo === 'scadenza' ? '⏰' : '📬'}</span>
                    <div style={{ flex: 1, fontSize: '0.88rem' }}>{a.msg}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowNotifiche(false); setActiveTab('preventivi'); }}>Apri</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNotifiche(false)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          <button className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Home
          </button>
          <button className={`bottom-nav-item ${activeTab === 'preventivi' ? 'active' : ''}`} onClick={() => setActiveTab('preventivi')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Preventivi
          </button>
          <button className={`bottom-nav-item ${activeTab === 'prodotti' ? 'active' : ''}`} onClick={() => setActiveTab('prodotti')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Prodotti
          </button>
          <button className={`bottom-nav-item ${activeTab === 'clienti' ? 'active' : ''}`} onClick={() => setActiveTab('clienti')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Clienti
          </button>
          <button className={`bottom-nav-item ${activeTab === 'impostazioni' ? 'active' : ''}`} onClick={() => setActiveTab('impostazioni')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Impostazioni
          </button>
        </div>
      </nav>
    </div>
  );
}

// Router Manager
function AppRouter() {
  const { currentUser, loading } = useAuth();
  
  if (loading) return null; // or a spinner
  
  return currentUser ? <MainLayout /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
