import React, { useState, useEffect } from 'react';
import { db, firebase } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Impostazioni() {
  const { currentUser, isAdmin, features, setFeatures } = useAuth();
  const [localFeatures, setLocalFeatures] = useState(null);  // inizializza da features dopo primo render
  const [featSaving, setFeatSaving] = useState(false);
  
  // Sync locale quando features arrivano da Firestore (AuthContext)
  React.useEffect(() => {
    if (features) setLocalFeatures({ ...features });
  }, [features]);
  
  // Settings State
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    nome: '', piva: '', indirizzo: '', telefono: '', email: '', 
    sito: '', note: '', iva: 22, valuta: 'EUR', logoBase64: ''
  });

  // Backup State
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);

  useEffect(() => {
    loadCompany();
  }, []);

  async function loadCompany() {
    setLoading(true);
    try {
      const doc = await db.collection('settings').doc('company').get();
      if (doc.exists) {
        setFormData({ ...formData, ...doc.data() });
      }
    } catch (err) {
      console.warn('Errore loading company:', err);
    }
    setLoading(false);
  }

  // ==== SALVATAGGIO COMPANY ====
  async function saveSettings() {
    try {
      await db.collection('settings').doc('company').set({
        ...formData,
        iva: parseInt(formData.iva) || 22,
      }, { merge: true });
      alert('Impostazioni salvate con successo!');
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { 
      alert('File troppo grande (max 2MB)'); 
      return; 
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setFormData(prev => ({ ...prev, logoBase64: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  // ==== BACKUP LOGIC ====
  async function handleExport() {
    if (!isAdmin) return;
    try {
      setBackupLoading(true);
      const collections = ['preventivi', 'clienti', 'prodotti', 'settings'];
      const data = {};
      for (const c of collections) {
        const snap = await db.collection(c).get();
        data[c] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `infissipro_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Errore durante export: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleImport() {
    if (!isAdmin || !restoreFile) return;
    if (!window.confirm('ATTENZIONE: Questo sovrascriverà i dati esistenti! Sei sicuro?')) return;

    try {
      setBackupLoading(true);
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);

      // Validazione struttura base
      const collezioniValide = ['preventivi', 'clienti', 'prodotti', 'settings'];
      const chiavi = Object.keys(parsed);
      if (!chiavi.length || !chiavi.every(k => collezioniValide.includes(k))) {
        alert('File non valido: struttura JSON non riconosciuta.');
        return;
      }

      // Riconverte { seconds, nanoseconds } → Firestore Timestamp
      function ripristinaTimestamps(val) {
        if (val === null || val === undefined) return val;
        if (typeof val === 'object' && !Array.isArray(val)) {
          const k = Object.keys(val);
          if (k.length === 2 && typeof val.seconds === 'number' && typeof val.nanoseconds === 'number') {
            return new firebase.firestore.Timestamp(val.seconds, val.nanoseconds);
          }
          const out = {};
          for (const [key, v] of Object.entries(val)) out[key] = ripristinaTimestamps(v);
          return out;
        }
        if (Array.isArray(val)) return val.map(ripristinaTimestamps);
        return val;
      }

      // Costruisce lista piatta di operazioni { ref, data }
      const operazioni = [];
      for (const [colName, docs] of Object.entries(parsed)) {
        for (const record of docs) {
          const { id, ...rawData } = record;
          const data = ripristinaTimestamps(rawData);
          operazioni.push({ ref: db.collection(colName).doc(id), data });
        }
      }

      // Esegue in batch da max 499 operazioni ciascuno
      const CHUNK = 499;
      for (let i = 0; i < operazioni.length; i += CHUNK) {
        const batch = db.batch();
        operazioni.slice(i, i + CHUNK).forEach(({ ref, data }) => batch.set(ref, data));
        await batch.commit();
      }

      alert(`Ripristino completato! ${operazioni.length} documenti importati.`);
      loadCompany();
    } catch (err) {
      alert('Errore importazione: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  }

  if (loading) {
    return <div className="content"><div className="empty-state"><p>Caricamento...</p></div></div>;
  }

  return (
    <div className="content">
      <h2 className="topbar-title" style={{ marginBottom: '24px' }}>Impostazioni e Amministrazione</h2>

      {/* AZIENDA */}
      <div className="settings-section">
        <h3>🏢 Dati Aziendali (Studio)</h3>
        <div className="card">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome Azienda</label>
              <input className="form-input" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Es. Infissi Rossi Srl" />
            </div>
            <div className="form-group">
              <label className="form-label">P.IVA / C.F.</label>
              <input className="form-input" value={formData.piva} onChange={e => setFormData({...formData, piva: e.target.value})} placeholder="IT00000000000" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Indirizzo</label>
              <input className="form-input" value={formData.indirizzo} onChange={e => setFormData({...formData, indirizzo: e.target.value})} placeholder="Via Roma 1, Napoli" />
            </div>
            <div className="form-group">
              <label className="form-label">Telefono</label>
              <input className="form-input" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} placeholder="+39 ..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="info@azienda.it" />
            </div>
            <div className="form-group">
              <label className="form-label">Sito Web</label>
              <input className="form-input" value={formData.sito} onChange={e => setFormData({...formData, sito: e.target.value})} placeholder="www.azienda.it" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Note / Condizioni PDF (pie' di pagina)</label>
            <textarea className="form-textarea" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Validità preventivo 30 giorni..."></textarea>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>🖼️ Logo Aziendale</h3>
        <div className="card">
          <p style={{ color:'var(--text2)', fontSize:'0.85rem', marginBottom:'16px' }}>
            Il logo apparirà nell'intestazione dei PDF dei preventivi. Formato consigliato: PNG trasparente.
          </p>
          {formData.logoBase64 && <img src={formData.logoBase64} className="logo-preview" style={{ maxHeight: '80px', marginBottom: '12px', display: 'block' }} alt="Logo" />}
          
          <div className="logo-upload-area" onClick={() => document.getElementById('logo-file').click()} style={{ cursor: 'pointer', textAlign: 'center', padding: '24px', border: '2px dashed var(--border)', borderRadius: '8px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <div style={{ color:'var(--text2)', fontSize:'0.85rem' }}>Clicca per caricare il logo</div>
          </div>
          <input type="file" id="logo-file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>
      </div>

      <div className="settings-section">
        <h3>📊 IVA Predefinita</h3>
        <div className="card">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Aliquota IVA (%)</label>
              <select className="form-select" value={formData.iva} onChange={e => setFormData({...formData, iva: e.target.value})}>
                <option value="0">0% (Esente)</option>
                <option value="4">4%</option>
                <option value="10">10%</option>
                <option value="22">22%</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valuta del preventivo</label>
              <select className="form-select" value={formData.valuta} onChange={e => setFormData({...formData, valuta: e.target.value})}>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '40px' }}>
        <button className="btn btn-primary" onClick={saveSettings}>💾 Salva Impostazioni</button>
      </div>

      {/* FUNZIONALITÀ AVANZATE — solo admin */}
      {isAdmin && localFeatures && (
        <>
          <hr className="divider" style={{ margin: '8px 0 32px' }} />
          <div className="settings-section">
            <h3>🔧 Funzionalità Avanzate <span style={{ fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 400, fontFamily: 'inherit' }}>(solo admin — le modifiche si applicano a tutti gli utenti)</span></h3>
            <div className="card">
              <p style={{ color: 'var(--text2)', fontSize: '0.83rem', marginBottom: '20px' }}>Attiva o disattiva le funzionalità extra. Quando le abiliti tu, diventano visibili anche agli altri utenti.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {[  
                  { key: 'storicoClienti',  label: '📋 Storico preventivi per cliente', desc: 'Mostra tutti i preventivi passati nella scheda cliente' },
                  { key: 'firmaDigitale',   label: '✍️ Firma digitale', desc: 'Il cliente firma il preventivo sul telefono con il dito' },
                  { key: 'whatsapp',        label: '💬 WhatsApp diretto', desc: 'Bottone accanto all’email che apre WhatsApp con messaggio pre-compilato' },
                  { key: 'notifiche',       label: '🔔 Notifiche scadenze', desc: 'Avviso per preventivi in scadenza o rimasti "inviati" da >7 giorni' },
                ].map(({ key, label, desc }) => {
                  const on = localFeatures[key];
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
                        <div style={{ color: 'var(--text3)', fontSize: '0.78rem', marginTop: '2px' }}>{desc}</div>
                      </div>
                      <button
                        onClick={() => setLocalFeatures(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{ width: '46px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, background: on ? 'var(--gold)' : 'var(--border)' }}
                      >
                        <span style={{ position: 'absolute', top: '3px', left: on ? '23px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" disabled={featSaving} onClick={async () => {
                  setFeatSaving(true);
                  try {
                    await db.collection('settings').doc('features').set(localFeatures);
                    setFeatures(localFeatures);
                    alert('Funzionalità aggiornate per tutti gli utenti!');
                  } catch(e) { alert('Errore: ' + e.message); }
                  setFeatSaving(false);
                }}>{featSaving ? 'Salvataggio...' : '💾 Salva funzionalità'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <hr className="divider" style={{ margin: '32px 0' }} />
          <div className="settings-section">
            <h3>🗄 Area Amministratore: Backup e Ripristino</h3>
            <p style={{ color:'var(--text2)', fontSize:'0.9rem', marginBottom:'16px' }}>Area riservata all'admin ({currentUser.email}). I dati sono esportati in JSON formato Firebase Locale.</p>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong>1. Esporta tutti i dati in locale</strong><br/>
                <button className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={handleExport} disabled={backupLoading}>📥 Scarica Backup JSON</button>
              </div>
              <hr className="divider" />
              <div>
                <strong>2. Ripristina da locale</strong><br/>
                <input type="file" accept=".json" onChange={e => setRestoreFile(e.target.files[0])} style={{ display: 'block', marginTop: '8px', marginBottom: '8px' }} />
                <button className="btn btn-danger" disabled={!restoreFile || backupLoading} onClick={handleImport}>⚠ Avvia Ripristino</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
