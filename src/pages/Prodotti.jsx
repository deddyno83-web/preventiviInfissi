import React, { useState, useEffect } from 'react';
import { db, firebase } from '../services/firebase';


export default function Prodotti() {
  const [prodotti, setProdotti] = useState([]);
  const [filteredProdotti, setFilteredProdotti] = useState([]);
  const [categorieDisp, setCategorieDisp] = useState(['Tutti']);
  const [catFilter, setCatFilter] = useState('Tutti');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProdotto, setCurrentProdotto] = useState(null);

  const [categorie, setCategorie] = useState([]);
  const [materiali, setMateriali] = useState([]);

  const [formData, setFormData] = useState({
    nome: '', sistema: '', categoria: 'Finestra', materiale: 'PVC', prezzo: '', um: 'cadauno',
    coloreProfili: '', coloreAccessori: '', altezzaManiglia: '', tamponamento: '', descrizione: '', foto: ''
  });

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatVal, setNewCatVal] = useState('');
  const [showNewMat, setShowNewMat] = useState(false);
  const [newMatVal, setNewMatVal] = useState('');

  useEffect(() => {
    loadCatMat();
    loadProdotti();
  }, []);

  async function loadCatMat() {
    try {
      const doc = await db.collection('settings').doc('catmat').get();
      if (doc.exists) {
        const d = doc.data();
        setCategorie(d.categorie || []);
        setMateriali(d.materiali || []);
      }
    } catch (e) {
      console.warn('Errore loading catmat', e);
    }
  }

  async function loadProdotti() {
    setLoading(true);
    const snap = await db.collection('prodotti').orderBy('nome').get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const catsUsed = [...new Set(data.map(p => p.categoria).filter(Boolean))];
    setCategorieDisp(['Tutti', ...catsUsed]);
    
    setProdotti(data);
    applyFilters(data, catFilter, searchQuery);
    setLoading(false);
  }

  function applyFilters(list, cat, q) {
    let filtered = cat === 'Tutti' ? list : list.filter(p => p.categoria === cat);
    if (q) {
      filtered = filtered.filter(p => (p.nome+p.categoria+p.materiale).toLowerCase().includes(q));
    }
    setFilteredProdotti(filtered);
  }

  function handleCatFilter(cat) {
    setCatFilter(cat);
    applyFilters(prodotti, cat, searchQuery);
  }

  function handleSearch(e) {
    const q = e.target.value.toLowerCase();
    setSearchQuery(q);
    applyFilters(prodotti, catFilter, q);
  }

  async function addCatAlVolo() {
    const val = newCatVal.trim();
    if (!val) return;
    try {
      const doc = await db.collection('settings').doc('catmat').get();
      const existing = doc.exists ? (doc.data().categorie || []) : [];
      if (existing.includes(val)) { alert('Categoria già esistente'); return; }
      const updated = [...existing, val];
      await db.collection('settings').doc('catmat').set({ categorie: updated }, { merge: true });
      setCategorie(updated);
      setFormData(prev => ({ ...prev, categoria: val }));
      setNewCatVal('');
      setShowNewCat(false);
    } catch (e) { alert('Errore: ' + e.message); }
  }

  async function addMatAlVolo() {
    const val = newMatVal.trim();
    if (!val) return;
    try {
      const doc = await db.collection('settings').doc('catmat').get();
      const existing = doc.exists ? (doc.data().materiali || []) : [];
      if (existing.includes(val)) { alert('Materiale già esistente'); return; }
      const updated = [...existing, val];
      await db.collection('settings').doc('catmat').set({ materiali: updated }, { merge: true });
      setMateriali(updated);
      setFormData(prev => ({ ...prev, materiale: val }));
      setNewMatVal('');
      setShowNewMat(false);
    } catch (e) { alert('Errore: ' + e.message); }
  }

  function openProdottoModal(idStr = null) {
    const p = idStr ? prodotti.find(x => x.id === idStr) : null;
    setCurrentProdotto(p);
    setShowNewCat(false); setNewCatVal('');
    setShowNewMat(false); setNewMatVal('');
    setFormData(p ? { ...p } : {
      nome: '',
      sistema: '',
      categoria: categorie[0] || 'Finestra',
      materiale: materiali[0] || 'PVC',
      prezzo: '',
      um: 'cadauno',
      coloreProfili: '', coloreAccessori: '', altezzaManiglia: '', tamponamento: '',
      descrizione: '',
      foto: ''
    });
    setIsModalOpen(true);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { 
      alert('Immagine troppo grande (max 2MB)'); 
      return; 
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setFormData(prev => ({ ...prev, foto: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  async function saveProdotto() {
    const prezzoNum = parseFloat(formData.prezzo);
    if (!formData.nome.trim() || isNaN(prezzoNum)) { 
      alert('Compila nome e prezzo corretti'); 
      return; 
    }

    const dataToSave = {
      nome: formData.nome.trim(),
      sistema: formData.sistema || '',
      categoria: formData.categoria,
      materiale: formData.materiale,
      prezzo: prezzoNum,
      um: formData.um,
      coloreProfili: formData.coloreProfili || '',
      coloreAccessori: formData.coloreAccessori || '',
      altezzaManiglia: formData.altezzaManiglia || '',
      tamponamento: formData.tamponamento || '',
      descrizione: formData.descrizione,
      foto: formData.foto || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (currentProdotto?.id) {
        await db.collection('prodotti').doc(currentProdotto.id).update(dataToSave);
      } else {
        dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('prodotti').add(dataToSave);
      }
      closeModal();
      loadProdotti();
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  async function deleteProdotto(id) {
    if (!window.confirm('Eliminare questo prodotto?')) return;
    try {
      await db.collection('prodotti').doc(id).delete();
      loadProdotti();
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  }

  function fmt(n) { return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(n||0); }

  return (
    <div className="content">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px', display: 'flex', alignItems: 'center' }}>
        <h2 className="topbar-title" style={{ marginRight: '16px' }}>Prodotti</h2>
        <div className="search-box" style={{ width: '280px' }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Cerca prodotto..." value={searchQuery} onChange={handleSearch} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Tutti', ...categorie].map(c => (
            <button 
              key={c} 
              className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => handleCatFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="topbar-actions" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={() => openProdottoModal()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="btn-text">Nuovo Prodotto</span>
          </button>
        </div>
      </div>
      
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prodotto</th><th>Categoria</th><th>Materiale</th>
                <th>Prezzo Base</th><th style={{ textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5"><div className="empty-state"><p>Caricamento in corso...</p></div></td></tr>
              ) : filteredProdotti.length === 0 ? (
                <tr><td colSpan="5"><div className="empty-state"><h3>Nessun prodotto</h3><p>Aggiungi il primo prodotto al catalogo</p></div></td></tr>
              ) : (
                filteredProdotti.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {p.foto ? (
                          <img src={p.foto} alt="prod" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text3)' }}>No img</div>
                        )}
                        <div>
                          <strong>{p.nome}</strong>
                          {p.sistema && <><br /><small style={{ color: 'var(--text2)' }}>Sistema: {p.sistema}</small></>}
                          {p.descrizione && <><br /><small style={{ color: 'var(--text3)' }}>{p.descrizione.substring(0, 60)}{p.descrizione.length > 60 ? '...' : ''}</small></>}
                        </div>
                      </div>
                    </td>
                    <td><span className="chip">{p.categoria || '—'}</span></td>
                    <td>{p.materiale || '—'}</td>
                    <td><strong>{fmt(p.prezzo)}</strong></td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openProdottoModal(p.id)} title="Modifica">✏️</button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteProdotto(p.id)} title="Elimina">🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay open" style={{ zIndex: 1000}}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{currentProdotto?.id ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</h2>
              <button className="btn-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Foto Prodotto (opzionale)</label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {formData.foto && <img src={formData.foto} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} alt="Preview" />}
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '0.85rem' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nome / Modello *</label>
                  <input className="form-input" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Es. Serie 70 Classic" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sistema</label>
                  <input className="form-input" value={formData.sistema} onChange={e => setFormData({...formData, sistema: e.target.value})} placeholder="Es. Veka - Softline 76" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Categoria *</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select className="form-select" style={{ flex: 1 }} value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})}>
                      {categorie.map(c => <option key={c} value={c}>{c}</option>)}
                      {categorie.length === 0 && <option value="">Nessuna categoria</option>}
                    </select>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowNewCat(v => !v)}>+ Cat.</button>
                  </div>
                  {showNewCat && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input className="form-input" style={{ flex: 1, fontSize: '0.85rem' }} placeholder="Nome nuova categoria..." value={newCatVal}
                        onChange={e => setNewCatVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCatAlVolo(); } }} />
                      <button className="btn btn-primary btn-sm" onClick={addCatAlVolo}>✓</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewCat(false); setNewCatVal(''); }}>✕</button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Materiale</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select className="form-select" style={{ flex: 1 }} value={formData.materiale} onChange={e => setFormData({...formData, materiale: e.target.value})}>
                      {materiali.map(m => <option key={m} value={m}>{m}</option>)}
                      {materiali.length === 0 && <option value="">Nessun materiale</option>}
                    </select>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowNewMat(v => !v)}>+ Mat.</button>
                  </div>
                  {showNewMat && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input className="form-input" style={{ flex: 1, fontSize: '0.85rem' }} placeholder="Nome nuovo materiale..." value={newMatVal}
                        onChange={e => setNewMatVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMatAlVolo(); } }} />
                      <button className="btn btn-primary btn-sm" onClick={addMatAlVolo}>✓</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewMat(false); setNewMatVal(''); }}>✕</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Colore Profili</label>
                  <input className="form-input" value={formData.coloreProfili} onChange={e => setFormData({...formData, coloreProfili: e.target.value})} placeholder="Es. RIVESTIMENTO 2L STD - MARRONE NOCE" />
                </div>
                <div className="form-group">
                  <label className="form-label">Colore Accessori</label>
                  <input className="form-input" value={formData.coloreAccessori} onChange={e => setFormData({...formData, coloreAccessori: e.target.value})} placeholder="Es. OxBrz (Ox Bronzo)" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Altezza Maniglia (mm)</label>
                  <input className="form-input" type="number" step="1" value={formData.altezzaManiglia} onChange={e => setFormData({...formData, altezzaManiglia: e.target.value})} placeholder="Es. 500" />
                </div>
                <div className="form-group">
                  <label className="form-label">Prezzo Base (€) *</label>
                  <input className="form-input" type="number" step="0.01" value={formData.prezzo} onChange={e => setFormData({...formData, prezzo: e.target.value})} placeholder="0.00" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Unità di misura</label>
                <select className="form-select" value={formData.um} onChange={e => setFormData({...formData, um: e.target.value})}>
                  <option value="cadauno">Cadauno (cad.)</option>
                  <option value="pz">A pezzo (pz)</option>
                  <option value="mq">Metro quadro (m²)</option>
                  <option value="ml">Metro lineare (ml)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tamponamento / Vetro</label>
                <textarea className="form-textarea" style={{ minHeight: '70px' }} value={formData.tamponamento} onChange={e => setFormData({...formData, tamponamento: e.target.value})} placeholder="Es. 33.1 BE--14 Ar WE Psi0.036--4ExtC--14 Ar WE..."></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">Descrizione / Note prodotto</label>
                <textarea className="form-textarea" value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} placeholder="Altre note tecniche sul prodotto..."></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Annulla</button>
              <button className="btn btn-primary" onClick={saveProdotto}>💾 Salva Prodotto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
