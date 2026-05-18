import React, { useState, useEffect } from 'react';
import { db, firebase } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generatePDF } from '../utils/actions';
import PreventivoModal from './PreventivoModal';

const STATO_STYLE = {
  bozza:          { color: '#6B6560', background: '#F0EDE8' },
  inviato:        { color: '#2980B9', background: '#EBF5FB' },
  accettato:      { color: '#27AE60', background: '#EBF8F1' },
  in_lavorazione: { color: '#8E44AD', background: '#F5EEF8' },
  consegnato:     { color: '#1A5276', background: '#D6EAF8' },
  rifiutato:      { color: '#C0392B', background: '#FDEDED' },
};

const STATO_LEFT_BORDER = {
  bozza:          '#B0A89E',
  inviato:        '#2980B9',
  accettato:      '#27AE60',
  in_lavorazione: '#8E44AD',
  consegnato:     '#1A5276',
  rifiutato:      '#C0392B',
};

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtCurrency(val) {
  return '€ ' + (parseFloat(val) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Clienti({ onNuovoPreventivo }) {
  const { features } = useAuth();
  const [clienti, setClienti] = useState([]);
  const [filteredClienti, setFilteredClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCliente, setCurrentCliente] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    cognome: '', nome: '', azienda: '', email: '', telefono: '', indirizzo: '', citta: '', note: ''
  });

  // Storico state
  const [showStorico, setShowStorico] = useState(false);
  const [storicoCliente, setStoricoCliente] = useState(null);
  const [storicoPreventivi, setStoricoPreventivi] = useState([]);
  const [storicoLoading, setStoricoLoading] = useState(false);

  // Edit preventivo dall'interno dello storico
  const [editPreventivo, setEditPreventivo] = useState(null);
  const [showEditPreventivo, setShowEditPreventivo] = useState(false);

  useEffect(() => {
    loadClienti();
  }, []);

  async function loadClienti() {
    setLoading(true);
    const snap = await db.collection('clienti').orderBy('cognome').get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setClienti(data);
    setFilteredClienti(data);
    setLoading(false);
  }

  function handleSearch(e) {
    const q = e.target.value.toLowerCase();
    setSearchQuery(q);
    setFilteredClienti(
      clienti.filter(c => ((c.cognome || '')+(c.nome || '')+(c.azienda || '')+(c.email || '')+(c.telefono || '')).toLowerCase().includes(q))
    );
  }

  function openClienteModal(clienteStr = null) {
    const c = clienteStr ? clienti.find(x => x.id === clienteStr) : null;
    setCurrentCliente(c);
    setFormData(c ? { ...c } : { cognome: '', nome: '', azienda: '', email: '', telefono: '', indirizzo: '', citta: '', note: '' });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  async function saveCliente() {
    const { cognome, nome, azienda, email, telefono, indirizzo, citta, note } = formData;
    if (!cognome.trim()) { alert('Inserisci almeno il cognome'); return; }

    const dataToSave = {
      cognome: cognome.trim(),
      nome: nome.trim(),
      azienda, email, telefono, indirizzo, citta, note,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (currentCliente?.id) {
        await db.collection('clienti').doc(currentCliente.id).update(dataToSave);
      } else {
        dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('clienti').add(dataToSave);
      }
      closeModal();
      loadClienti();
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  async function deleteCliente(id) {
    if (!window.confirm('Eliminare questo cliente?')) return;
    try {
      await db.collection('clienti').doc(id).delete();
      loadClienti();
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  async function openStoricoCliente(clienteId) {
    const cliente = clienti.find(c => c.id === clienteId);
    if (!cliente) return;
    setStoricoCliente(cliente);
    setShowStorico(true);
    setStoricoLoading(true);
    try {
      const snap = await db.collection('preventivi')
        .where('clienteId', '==', clienteId)
        .get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setStoricoPreventivi(docs);
    } catch (e) {
      console.warn('Errore storico:', e);
      setStoricoPreventivi([]);
    }
    setStoricoLoading(false);
  }

  function closeStorico() {
    setShowStorico(false);
    setStoricoCliente(null);
    setStoricoPreventivi([]);
  }

  function openEditPreventivo(preventivo) {
    setEditPreventivo(preventivo);
    setShowEditPreventivo(true);
  }

  async function saveEditPreventivo(dataToSave) {
    try {
      if (editPreventivo?.id) {
        await db.collection('preventivi').doc(editPreventivo.id).update(dataToSave);
      }
      setShowEditPreventivo(false);
      setEditPreventivo(null);
      // Ricarica lo storico per mostrare i dati aggiornati
      if (storicoCliente) {
        const snap = await db.collection('preventivi').where('clienteId', '==', storicoCliente.id).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setStoricoPreventivi(docs);
      }
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  const storicoAccettati = storicoPreventivi.filter(p => p.stato === 'accettato' || p.stato === 'in_lavorazione' || p.stato === 'consegnato');
  const valoreAccettato = storicoAccettati.reduce((s, p) => s + (parseFloat(p.totaleFinale) || parseFloat(p.totaleIvaInclusa) || 0), 0);

  return (
    <div className="content">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px', display: 'flex', alignItems: 'center' }}>
        <h2 className="topbar-title" style={{ marginRight: '16px' }}>Clienti</h2>
        <div className="search-box" style={{ width: '280px' }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Cerca cliente..." value={searchQuery} onChange={handleSearch} />
        </div>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
          {filteredClienti.length} cliente{filteredClienti.length === 1 ? '' : 'i'}
        </span>
        <div className="topbar-actions" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={() => openClienteModal()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="btn-text">Nuovo Cliente</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Email</th><th>Telefono</th><th>Città</th><th style={{ textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5"><div className="empty-state"><p>Caricamento in corso...</p></div></td></tr>
              ) : filteredClienti.length === 0 ? (
                <tr><td colSpan="5"><div className="empty-state"><h3>Nessun cliente</h3><p>Aggiungi il primo cliente all'anagrafica</p></div></td></tr>
              ) : (
                filteredClienti.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.cognome} {c.nome}</strong>
                      {c.azienda && <><br /><small style={{ color: 'var(--text3)' }}>{c.azienda}</small></>}
                    </td>
                    <td>{c.email || '—'}</td>
                    <td>{c.telefono || '—'}</td>
                    <td>{c.citta || '—'}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openClienteModal(c.id)} title="Modifica">✏️</button>
                      {features?.storicoClienti && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openStoricoCliente(c.id)} title="Storico preventivi">📋</button>
                      )}
                      {onNuovoPreventivo && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onNuovoPreventivo(c.id)} title="Nuovo preventivo">➕</button>
                      )}
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteCliente(c.id)} title="Elimina">🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDIT CLIENTE */}
      {isModalOpen && (
        <div className="modal-overlay open" style={{ zIndex: 1000}}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{currentCliente?.id ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
              <button className="btn-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Cognome *</label>
                  <input className="form-input" value={formData.cognome} onChange={e => setFormData({...formData, cognome: e.target.value})} placeholder="Rossi" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input className="form-input" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Mario" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Azienda</label>
                <input className="form-input" value={formData.azienda} onChange={e => setFormData({...formData, azienda: e.target.value})} placeholder="Rossi & Figli Srl (opzionale)" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="mario.rossi@email.it" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefono</label>
                  <input className="form-input" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} placeholder="+39 333 000000" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Indirizzo</label>
                  <input className="form-input" value={formData.indirizzo} onChange={e => setFormData({...formData, indirizzo: e.target.value})} placeholder="Via Roma 1" />
                </div>
                <div className="form-group">
                  <label className="form-label">CAP / Città</label>
                  <input className="form-input" value={formData.citta} onChange={e => setFormData({...formData, citta: e.target.value})} placeholder="80100 Napoli" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <textarea className="form-textarea" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Note interne sul cliente..."></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Annulla</button>
              <button className="btn btn-primary" onClick={saveCliente}>💾 Salva Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STORICO CLIENTE */}
      {showStorico && storicoCliente && (
        <div className="modal-overlay open" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '700px', width: '95vw' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>📋</span>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text1)' }}>
                  Storico —{' '}
                  <span style={{ textTransform: 'uppercase' }}>
                    {storicoCliente.azienda || `${storicoCliente.cognome} ${storicoCliente.nome}`}
                  </span>
                </h2>
              </div>
              <button className="btn-close" onClick={closeStorico} style={{ fontSize: '1.1rem', color: 'var(--text3)' }}>✕</button>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: '#F3F0EB', borderRadius: '14px', padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text1)', lineHeight: 1.1 }}>{storicoPreventivi.length}</div>
                  <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 600, color: 'var(--text3)', marginTop: '6px', textTransform: 'uppercase' }}>Preventivi totali</div>
                </div>
                <div style={{ background: '#F3F0EB', borderRadius: '14px', padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#27AE60', lineHeight: 1.1 }}>{storicoAccettati.length}</div>
                  <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 600, color: '#27AE60', marginTop: '6px', textTransform: 'uppercase' }}>Accettati</div>
                </div>
                <div style={{ background: '#F3F0EB', borderRadius: '14px', padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1.2 }}>{fmtCurrency(valoreAccettato)}</div>
                  <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 600, color: 'var(--gold)', marginTop: '6px', textTransform: 'uppercase' }}>Valore accettato</div>
                </div>
              </div>

              {/* Lista preventivi */}
              {storicoLoading ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)' }}>Caricamento...</div>
              ) : storicoPreventivi.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)' }}>Nessun preventivo trovato per questo cliente.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '2px' }}>
                  {storicoPreventivi.map(p => {
                    const borderColor = STATO_LEFT_BORDER[p.stato] || '#B0A89E';
                    const statoStyle = STATO_STYLE[p.stato] || STATO_STYLE.bozza;
                    const dateParts = [];
                    if (p.createdAt) dateParts.push(fmtDate(p.createdAt));
                    if (p.validoFino) dateParts.push('valido fino ' + fmtDate(p.validoFino));
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#FAF8F5', borderRadius: '10px', padding: '14px 16px', borderLeft: `4px solid ${borderColor}` }}>
                        {/* Numero + date */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text1)' }}>{p.numeroPrefisso ? `${p.numeroPrefisso}/${p.numero}` : p.numero || '—'}</div>
                          {dateParts.length > 0 && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '3px' }}>{dateParts.join(' · ')}</div>
                          )}
                        </div>
                        {/* Importo + stato */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gold)' }}>{fmtCurrency(p.totaleFinale || p.totaleIvaInclusa)}</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: statoStyle.color, marginTop: '3px' }}>
                            {(p.stato || 'bozza').replace('_', ' ')}
                          </div>
                        </div>
                        {/* Azioni */}
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '1rem', color: '#E07B4A' }}
                            title="Modifica"
                            onClick={() => openEditPreventivo(p)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '1rem', color: '#B0A89E' }}
                            title="Genera PDF"
                            onClick={async () => { try { await generatePDF(p); } catch(e) { alert('Errore PDF: ' + e.message); } }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 28px 24px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={closeStorico}>Chiudi</button>
              {onNuovoPreventivo && (
                <button className="btn btn-primary" onClick={() => { closeStorico(); onNuovoPreventivo(storicoCliente.id); }}>
                  + Nuovo Preventivo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT PREVENTIVO dallo storico */}
      {showEditPreventivo && editPreventivo && (
        <PreventivoModal
          preventivo={editPreventivo}
          clienti={clienti}
          onClose={() => { setShowEditPreventivo(false); setEditPreventivo(null); }}
          onSave={saveEditPreventivo}
        />
      )}
    </div>
  );
}
