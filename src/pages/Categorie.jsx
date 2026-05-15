import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';

export default function Categorie() {
  const [categorie, setCategorie] = useState([]);
  const [materiali, setMateriali] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [newMat, setNewMat] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCatMat();
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
    setLoading(false);
  }

  async function saveCatMat(newC, newM) {
    try {
      await db.collection('settings').doc('catmat').set({
        categorie: newC,
        materiali: newM
      }, { merge: true });
    } catch(e) {
      alert('Errore: ' + e.message);
    }
  }

  function addCat() {
    const v = newCat.trim();
    if (v && !categorie.includes(v)) {
      const arr = [...categorie, v];
      setCategorie(arr);
      setNewCat('');
      saveCatMat(arr, materiali);
    }
  }

  function removeCat(idx) {
    const arr = [...categorie];
    arr.splice(idx, 1);
    setCategorie(arr);
    saveCatMat(arr, materiali);
  }

  function addMat() {
    const v = newMat.trim();
    if (v && !materiali.includes(v)) {
      const arr = [...materiali, v];
      setMateriali(arr);
      setNewMat('');
      saveCatMat(categorie, arr);
    }
  }

  function removeMat(idx) {
    const arr = [...materiali];
    arr.splice(idx, 1);
    setMateriali(arr);
    saveCatMat(categorie, arr);
  }

  if (loading) return <div className="content"><div className="empty-state"><p>Caricamento...</p></div></div>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>🏷️ Categorie prodotto</h3>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginBottom: '16px' }}>Appaiono nel selettore categoria quando crei o modifichi un prodotto.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', minHeight: '32px' }}>
            {categorie.length === 0 ? (
               <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Nessuna categoria — aggiungine una</span>
            ) : (
              categorie.map((c, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--gold-light)', color: 'var(--gold-dark)', borderRadius: '20px', padding: '5px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                  {c}
                  <button onClick={() => removeCat(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold-dark)', fontSize: '1rem', lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                </span>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="form-input" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nuova categoria..." style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addCat()} />
            <button className="btn btn-primary" onClick={addCat}>+ Aggiungi</button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>🔩 Materiali</h3>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginBottom: '16px' }}>Appaiono nel selettore materiale del prodotto.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', minHeight: '32px' }}>
            {materiali.length === 0 ? (
               <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Nessun materiale — aggiungine uno</span>
            ) : (
              materiali.map((m, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--surface2)', color: 'var(--text)', borderRadius: '20px', padding: '5px 12px', fontSize: '0.82rem', fontWeight: 600, border: '1px solid var(--border)' }}>
                  {m}
                  <button onClick={() => removeMat(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: '1rem', lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                </span>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="form-input" value={newMat} onChange={e => setNewMat(e.target.value)} placeholder="Nuovo materiale..." style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addMat()} />
            <button className="btn btn-primary" onClick={addMat}>+ Aggiungi</button>
          </div>
        </div>
      </div>
    </>
  );
}
