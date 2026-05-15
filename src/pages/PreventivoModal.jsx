import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function PreventivoModal({ preventivo, clienti, onClose, onSave }) {
  const [formData, setFormData] = useState({
    clienteId: '', 
    stato: 'bozza', 
    note: '',
    numeroPrefisso: new Date().getFullYear().toString(),
    validoFino: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tempiConsegna: '45/60 gg. lavorativi dall\'accettazione preventivo e pagamento dell\'acconto',
    pagamenti: 'Acconto del 40% all\'accettazione su emissione fattura\nSaldo a lavori ultimati',
    noteInterne: '',
    scontoTipo: 'nessuno',
    scontoValore: 0,
    ivaEsclusa: false,
    anticipoPerc: 40,
    anticipoRicevuto: false,
    anticipoDataRicevuto: null
  });
  // Nuovo cliente inline
  const [showNuovoCliente, setShowNuovoCliente] = useState(false);
  const [nuovoClienteForm, setNuovoClienteForm] = useState({ cognome: '', nome: '', telefono: '', email: '', indirizzo: '' });
  const { features } = useAuth();
  // Firma digitale
  const [showFirma, setShowFirma] = useState(false);
  const firmaCanvasRef = useRef(null);
  const firmaDrawing = useRef(false);
  const [items, setItems] = useState([]);
  const [companyIva, setCompanyIva] = useState(22);
  
  // Product picker state
  const [showPicker, setShowPicker] = useState(false);
  const [prodotti, setProdotti] = useState([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState({});

  useEffect(() => {
    // Load company IVA
    db.collection('settings').doc('company').get().then(doc => {
      if (doc.exists) setCompanyIva(doc.data().iva ?? 22);
    });

    if (preventivo) {
      setFormData({
        clienteId: preventivo.clienteId || '',
        stato: preventivo.stato || 'bozza',
        note: preventivo.note || '',
        numeroPrefisso: preventivo.numeroPrefisso || new Date().getFullYear().toString(),
        validoFino: preventivo.validoFino || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tempiConsegna: preventivo.tempiConsegna || '45/60 gg. lavorativi dall\'accettazione',
        pagamenti: preventivo.pagamenti || 'Acconto del 40%',
        noteInterne: preventivo.noteInterne || '',
        scontoTipo: preventivo.scontoTipo || 'nessuno',
        scontoValore: preventivo.scontoValore || 0,
        ivaEsclusa: preventivo.ivaEsclusa || false,
        anticipoPerc: preventivo.anticipoPerc ?? 40,
        anticipoRicevuto: preventivo.anticipoRicevuto === true,
        anticipoDataRicevuto: preventivo.anticipoDataRicevuto || null
      });
      
      const loadedItems = preventivo.items ? JSON.parse(JSON.stringify(preventivo.items)) : [];
      setItems(loadedItems);
      
      // Reinject photos
      if (loadedItems.length > 0) {
        db.collection('prodotti').get().then(snap => {
           let prods = [];
           snap.forEach(d => prods.push({id: d.id, ...d.data()}));
           setItems(prevItems => prevItems.map(it => {
              const matchingProd = prods.find(p => p.id === it.prodottoId);
              return { ...it, foto: matchingProd?.foto || '' };
           }));
        });
      }
    }
  }, [preventivo]);

  async function loadProdotti() {
    if (prodotti.length) return;
    const snap = await db.collection('prodotti').orderBy('nome').get();
    setProdotti(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // ── DUPLICA RIGA ─────────────────────────────────────────────
  function duplicaRiga(i) {
    const newItems = [...items];
    const copia = JSON.parse(JSON.stringify(newItems[i]));
    copia.larghezza = ''; copia.altezza = ''; copia.mqManuale = ''; copia.descrizioneRiga = '';
    copia._isCopy = true;
    newItems.splice(i + 1, 0, copia);
    setItems(newItems);
  }

  // ── NUOVO CLIENTE INLINE ──────────────────────────────────────
  async function salvaClienteRapido() {
    if (!nuovoClienteForm.cognome.trim()) { alert('Inserisci almeno il cognome'); return; }
    try {
      const data = {
        ...nuovoClienteForm,
        citta: '', azienda: '', note: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      const ref = await db.collection('clienti').add(data);
      setFormData(prev => ({ ...prev, clienteId: ref.id }));
      setShowNuovoCliente(false);
      setNuovoClienteForm({ cognome: '', nome: '', telefono: '', email: '', indirizzo: '' });
      alert('Cliente creato e selezionato!');
    } catch (e) { alert('Errore: ' + e.message); }
  }

  // ── FIRMA DIGITALE ────────────────────────────────────────────
  const initFirmaCanvas = useCallback(() => {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#1C1A17'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const getPos = (e) => { const r = canvas.getBoundingClientRect(); const src = e.touches ? e.touches[0] : e; return { x: src.clientX - r.left, y: src.clientY - r.top }; };
    canvas.onmousedown = e => { firmaDrawing.current = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    canvas.onmousemove = e => { if (!firmaDrawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    canvas.onmouseup = () => firmaDrawing.current = false;
    canvas.ontouchstart = e => { e.preventDefault(); firmaDrawing.current = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    canvas.ontouchmove = e => { e.preventDefault(); if (!firmaDrawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    canvas.ontouchend = () => firmaDrawing.current = false;
  }, []);

  useEffect(() => { if (showFirma) setTimeout(initFirmaCanvas, 100); }, [showFirma, initFirmaCanvas]);

  function clearFirma() {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  async function salvaFirma() {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    const firmaBase64 = canvas.toDataURL('image/png');
    if (preventivo?.id) {
      await db.collection('preventivi').doc(preventivo.id).update({
        firmaBase64, firmatoIl: new Date().toISOString(), stato: 'accettato',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    setFormData(prev => ({ ...prev, firmaBase64, stato: 'accettato' }));
    setShowFirma(false);
    alert('Firma salvata! Stato aggiornato ad Accettato');
  }

  function getCalculatedQty(it) {
    if (it.um === 'mq') {
      if (it.mqManuale > 0) return it.mqManuale;
      const largM = (parseFloat(it.larghezza) || 0) / 1000;
      const altM = (parseFloat(it.altezza) || 0) / 1000;
      const mqRaw = largM * altM;
      return Math.ceil(mqRaw * 2) / 2; // Arrotonda al mezzo mq superiore
    }
    if (it.um === 'ml') {
      return (parseFloat(it.larghezza) || 0) / 1000;
    }
    return it.qty || 1;
  }

  function handleSave() {
    if (!formData.clienteId) { alert('Seleziona un cliente'); return; }
    if (!items.length) { alert('Aggiungi almeno un prodotto'); return; }

    const subtotale = items.reduce((s, it) => s + ((it.prezzo || 0) * getCalculatedQty(it) * (it.qty || 1)), 0);
    
    let scontoAmt = 0;
    if (formData.scontoTipo === 'perc' && formData.scontoValore > 0) {
      scontoAmt = subtotale * formData.scontoValore / 100;
    } else if (formData.scontoTipo === 'fisso' && formData.scontoValore > 0) {
      scontoAmt = Math.min(formData.scontoValore, subtotale);
    }
    const imponibile = subtotale - scontoAmt;
    const ivaAmt = formData.ivaEsclusa ? 0 : (imponibile * companyIva / 100);
    const totaleFinale = imponibile + ivaAmt;
    const cl = clienti.find(c => c.id === formData.clienteId);

    const dataToSave = {
      ...formData,
      clienteNome: cl ? `${cl.cognome} ${cl.nome}` : '',
      items: items.map(({foto, ...rest}) => rest), // Remove base64 images BEFORE saving tracking logic for index.backup
      subtotale,
      scontoAmt,
      imponibile,
      ivaAmt,
      totaleFinale,
      ivaPerc: companyIva,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    onSave(dataToSave);
  }

  function updateItemField(index, field, val) {
    const newItems = [...items];
    newItems[index][field] = val;
    setItems(newItems);
  }

  function removeItem(index) {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  }

  function openPicker() {
    loadProdotti();
    setPickerSelected({});
    setShowPicker(true);
  }

  function togglePick(id) {
    setPickerSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function confirmPicker() {
    const newItems = [...items];
    Object.keys(pickerSelected).forEach(id => {
      if (pickerSelected[id]) {
        const p = prodotti.find(x => x.id === id);
        if (p && !newItems.find(it => it.prodottoId === id)) {
          newItems.push({ 
            prodottoId: id, 
            nome: p.nome, 
            categoria: p.categoria, 
            materiale: p.materiale, 
            prezzo: p.prezzo, 
            um: p.um, 
            qty: 1, 
            larghezza: '',
            altezza: '',
            mqManuale: '',
            descrizioneRiga: '',
            note: '',
            foto: p.foto || '',
            sistema: p.sistema || ''
          });
        }
      }
    });
    setItems(newItems);
    setShowPicker(false);
  }

  function fmt(n) { return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(n||0); }

  const subtot = items.reduce((s, it) => s + ((it.prezzo || 0) * getCalculatedQty(it) * (it.qty || 1)), 0);
  let scontoCalc = 0;
  if (formData.scontoTipo === 'perc' && formData.scontoValore > 0) scontoCalc = subtot * formData.scontoValore / 100;
  else if (formData.scontoTipo === 'fisso' && formData.scontoValore > 0) scontoCalc = Math.min(formData.scontoValore, subtot);
  
  const imponibileTot = subtot - scontoCalc;
  const ivaCalc = formData.ivaEsclusa ? 0 : imponibileTot * companyIva / 100;
  const totCalc = imponibileTot + ivaCalc;

  const filteredProdotti = prodotti.filter(p => (p.nome+p.categoria+p.materiale).toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <>
      <div className="modal-overlay open" style={{ zIndex: 1000}}>
        <div className="modal modal-lg">
          <div className="modal-header">
            <h2 className="modal-title">{preventivo?.id ? 'Modifica Preventivo' : 'Nuovo Preventivo'}</h2>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select className="form-select" value={formData.clienteId} onChange={e => setFormData({...formData, clienteId: e.target.value})}>
                    <option value="">— Seleziona cliente —</option>
                    {clienti.map(c => <option key={c.id} value={c.id}>{c.cognome} {c.nome}{c.azienda ? ' — '+c.azienda : ''}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNuovoCliente(v => !v)} title="Nuovo cliente rapido">+</button>
                </div>
                {showNuovoCliente && (
                  <div style={{ marginTop: '10px', padding: '14px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ fontSize: '0.82rem' }}>Nuovo Cliente Rapido</strong>
                    <div className="form-row" style={{ marginTop: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Cognome *</label>
                        <input className="form-input" value={nuovoClienteForm.cognome} onChange={e => setNuovoClienteForm(p => ({...p, cognome: e.target.value}))} placeholder="Cognome" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Nome</label>
                        <input className="form-input" value={nuovoClienteForm.nome} onChange={e => setNuovoClienteForm(p => ({...p, nome: e.target.value}))} placeholder="Nome" />
                      </div>
                    </div>
                    <div className="form-row" style={{ marginTop: '8px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Telefono</label>
                        <input className="form-input" value={nuovoClienteForm.telefono} onChange={e => setNuovoClienteForm(p => ({...p, telefono: e.target.value}))} placeholder="Telefono" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={nuovoClienteForm.email} onChange={e => setNuovoClienteForm(p => ({...p, email: e.target.value}))} placeholder="Email" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowNuovoCliente(false)}>Annulla</button>
                      <button className="btn btn-primary btn-sm" onClick={salvaClienteRapido}>✓ Crea e Seleziona</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Stato</label>
                <select className="form-select" value={formData.stato} onChange={e => setFormData({...formData, stato: e.target.value})}>
                  <option value="bozza">Bozza</option>
                  <option value="inviato">Inviato</option>
                  <option value="accettato">Accettato</option>
                  <option value="in_lavorazione">In lavorazione</option>
                  <option value="consegnato">Consegnato</option>
                  <option value="rifiutato">Rifiutato</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prefisso numero</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input className="form-input" value={formData.numeroPrefisso} onChange={e => setFormData({...formData, numeroPrefisso: e.target.value})} placeholder="Es. 2025" style={{ width: '90px' }} />
                  <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>/ {preventivo?.numero || '<auto>'}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Valido fino al</label>
                <input className="form-input" type="date" value={formData.validoFino} onChange={e => setFormData({...formData, validoFino: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Testo introduttivo <span style={{ fontSize: '0.72rem', color: 'var(--text3)'}}>(appare nel PDF prima della tabella prodotti)</span></label>
              <textarea className="form-textarea" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Es. RingranziandoLa per la Sua gentile richiesta..." style={{ minHeight: '60px' }}></textarea>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">⏱ Tempi di consegna (PDF)</label>
                <input className="form-input" value={formData.tempiConsegna} onChange={e => setFormData({...formData, tempiConsegna: e.target.value})} placeholder="Es. 45/60 gg. lavorativi..." />
              </div>
              <div className="form-group">
                <label className="form-label">💳 Condizioni di pagamento (PDF)</label>
                <textarea className="form-textarea" value={formData.pagamenti} onChange={e => setFormData({...formData, pagamenti: e.target.value})} style={{ minHeight: '60px' }}></textarea>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Note interne <span style={{ fontSize: '0.72rem', color: 'var(--text3)'}}>(solo per voi — non nel PDF)</span></label>
              <textarea className="form-textarea" value={formData.noteInterne} onChange={e => setFormData({...formData, noteInterne: e.target.value})} placeholder="Memo interni: es. cliente vuole sconto, installazione a maggio..." style={{ minHeight: '60px', background: 'var(--surface2)' }}></textarea>
            </div>

            <hr className="divider" />
            <div className="section-header" style={{ marginBottom: '12px' }}>
              <strong>Voci del Preventivo</strong>
              <button className="btn btn-secondary btn-sm" onClick={openPicker}>+ Aggiungi Prodotto</button>
            </div>

            <div id="pv-items-list">
              {items.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <p>Nessun prodotto aggiunto. Clicca "+ Aggiungi Prodotto"</p>
                </div>
              ) : (
                items.map((it, i) => {
                  const itemDimQty = getCalculatedQty(it);
                  const lineTotal = (it.prezzo || 0) * itemDimQty * (it.qty || 1);
                  const isCopy = it._isCopy || false;
                  
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        background: '#fff',
                        border: isCopy ? '1px solid #3498db' : '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '48px', height: '48px', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
                            {it.foto ? (
                              <img src={it.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ color: '#ccc', fontSize: '0.8rem' }}>No img</span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '1.05rem', color: '#1C1A17', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {it.nome} 
                              {isCopy && <span style={{ background: '#3498db', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>copia</span>}
                            </div>
                            <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>
                              {it.categoria || 'Varie'} · {it.um || 'cad.'} · {fmt(it.prezzo)}/{it.um || 'cad.'}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '2px' }}>N. elementi</div>
                            <input 
                              type="number" 
                              min="1" 
                              value={it.qty || 1} 
                              onChange={e => updateItemField(i, 'qty', parseInt(e.target.value)||1)} 
                              style={{ width: '60px', textAlign: 'center', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                            />
                          </div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#E67E22', minWidth: '80px', textAlign: 'right' }}>
                            {fmt(lineTotal)}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              onClick={() => duplicaRiga(i)} 
                              title="Duplica riga" 
                              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #3498db', background: 'transparent', color: '#3498db', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                            >
                              +
                            </button>
                            <button 
                              onClick={() => removeItem(i)} 
                              title="Rimuovi" 
                              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #e74c3c', background: '#ffebee', color: '#e74c3c', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />
                      
                      {it.um === 'mq' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--text3)' }}>Larg. (mm)</span>
                            <input 
                              type="number" 
                              value={it.larghezza || ''} 
                              onChange={e => updateItemField(i, 'larghezza', e.target.value)} 
                              style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                            />
                          </div>
                          <span style={{ color: 'var(--text3)' }}>×</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--text3)' }}>Alt. (mm)</span>
                            <input 
                              type="number" 
                              value={it.altezza || ''} 
                              onChange={e => updateItemField(i, 'altezza', e.target.value)} 
                              style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                            />
                          </div>
                          
                          <span style={{ color: 'var(--text3)' }}>= {((parseFloat(it.larghezza)||0)/1000 * (parseFloat(it.altezza)||0)/1000).toFixed(2)} m² → arrot. {(Math.ceil(((parseFloat(it.larghezza)||0)/1000 * (parseFloat(it.altezza)||0)/1000) * 2) / 2).toFixed(2)} m²</span>
                        </div>
                      )}
                      
                      {it.um === 'ml' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--text3)' }}>Lunghezza (mm)</span>
                            <input 
                              type="number" 
                              value={it.larghezza || ''} 
                              onChange={e => updateItemField(i, 'larghezza', e.target.value)} 
                              style={{ width: '80px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                            />
                          </div>
                          <span style={{ color: 'var(--text3)' }}>= {((parseFloat(it.larghezza)||0)/1000).toFixed(2)} ml</span>
                        </div>
                      )}

                      {(it.um === 'mq' || it.um === 'ml') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8f9fa', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{it.um} da usare:</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={it.mqManuale || itemDimQty} 
                            onChange={e => updateItemField(i, 'mqManuale', parseFloat(e.target.value) || 0)} 
                            style={{ width: '80px', padding: '6px 8px', border: '1px solid #E67E22', borderRadius: '6px', background: '#FFF8E1', fontWeight: 'bold' }}
                          />
                          <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>(puoi forzare il valore finale)</span>
                        </div>
                      )}

                      <div style={{ width: '100%' }}>
                        <input 
                          type="text" 
                          placeholder="Posizione / Vano (es. Camera da letto - finestra sx)" 
                          value={it.descrizioneRiga || ''} 
                          onChange={e => updateItemField(i, 'descrizioneRiga', e.target.value)} 
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem' }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <>
                <hr className="divider" />

                {/* Sconto cliente */}
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>🏷️ Sconto Cliente</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="form-select" style={{ width: '180px' }} value={formData.scontoTipo} onChange={e => setFormData({...formData, scontoTipo: e.target.value})}>
                      <option value="nessuno">Nessuno sconto</option>
                      <option value="perc">Sconto %</option>
                      <option value="fisso">Sconto importo fisso €</option>
                    </select>
                    {formData.scontoTipo !== 'nessuno' && (
                      <>
                        <input type="number" className="form-input" min="0" step="1" style={{ width: '130px' }}
                          placeholder={formData.scontoTipo === 'perc' ? 'Es. 10 (%)' : 'Es. 200 (€)'}
                          value={formData.scontoValore || ''}
                          onChange={e => setFormData({...formData, scontoValore: parseFloat(e.target.value)||0})} />
                        {scontoCalc > 0 && (
                          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.95rem' }}>
                            − {formData.scontoTipo === 'perc' ? formData.scontoValore + '% ' : ''}{fmt(scontoCalc)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="totale-box">
                  <div className="totale-row" style={{ marginBottom: '8px' }}><span>Subtotale</span><span>{fmt(subtot)}</span></div>
                  {scontoCalc > 0 && (
                    <div className="totale-row" style={{ marginBottom: '8px', color: 'var(--success)' }}><span>Sconto</span><span>− {fmt(scontoCalc)}</span></div>
                  )}
                  <div className="totale-row" style={{ marginBottom: '8px' }}><span>Imponibile</span><span>{fmt(imponibileTot)}</span></div>
                  <div className="totale-row" style={{ marginBottom: '12px' }}>
                    <span style={formData.ivaEsclusa ? { textDecoration: 'line-through', opacity: 0.45 } : {}}>{`IVA ${companyIva}%`}</span>
                    <span style={formData.ivaEsclusa ? { textDecoration: 'line-through', opacity: 0.3 } : {}}>{fmt(imponibileTot * companyIva / 100)}</span>
                  </div>
                  <div className="totale-row"><span style={{ fontSize: '0.9rem' }}>TOTALE</span><span className="totale-final">{fmt(totCalc)}</span></div>
                  {formData.anticipoPerc > 0 && (
                    <div className="totale-row" style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text3)' }}>
                      <span>Anticipo richiesto ({formData.anticipoPerc}%)</span><span>{fmt(totCalc * formData.anticipoPerc / 100)}</span>
                    </div>
                  )}
                </div>

                {/* IVA esclusa + Anticipo % */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', color: 'var(--text2)' }}>
                    <input type="checkbox" checked={formData.ivaEsclusa} onChange={e => setFormData({...formData, ivaEsclusa: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--gold)' }} />
                    <span>Escludi IVA dal totale</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Anticipo richiesto (%):</label>
                    <input type="number" className="form-input" min="0" max="100" style={{ width: '70px', padding: '5px 8px' }}
                      value={formData.anticipoPerc}
                      onChange={e => setFormData({...formData, anticipoPerc: parseFloat(e.target.value)||0})} />
                  </div>
                </div>

                {['accettato','in_lavorazione','consegnato'].includes(formData.stato) && (formData.anticipoPerc ?? 0) > 0 && (() => {
                  const ant = totCalc * (formData.anticipoPerc / 100);
                  const sal = totCalc - ant;
                  return (
                    <div style={{ marginTop: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--surface2)', padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>
                        💰 Pagamenti (preventivo accettato)
                      </div>
                      <div style={{ padding: '14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ background: formData.anticipoRicevuto ? '#EBF8F1' : '#FFF8E1', border: `1px solid ${formData.anticipoRicevuto ? '#A8DFBE' : '#FFD54F'}`, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: formData.anticipoRicevuto ? 'var(--success)' : '#E67E22', marginBottom: '4px' }}>
                              {formData.anticipoRicevuto ? '✓ ANTICIPO INCASSATO' : '⏳ ANTICIPO IN ATTESA'}
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: formData.anticipoRicevuto ? 'var(--success)' : '#E67E22' }}>{fmt(ant)}</div>
                            {formData.anticipoRicevuto && formData.anticipoDataRicevuto && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '2px' }}>il {new Date(formData.anticipoDataRicevuto).toLocaleDateString('it-IT')}</div>
                            )}
                          </div>
                          <div style={{ background: '#FDEDED', border: '1px solid #F5C6C6', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>DA SALDARE</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>{fmt(sal)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '2px' }}>a lavori ultimati</div>
                          </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text2)' }}>
                          <input type="checkbox" checked={formData.anticipoRicevuto}
                            onChange={e => setFormData(prev => ({
                              ...prev,
                              anticipoRicevuto: e.target.checked,
                              anticipoDataRicevuto: e.target.checked ? new Date().toISOString().split('T')[0] : null
                            }))}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--success)' }} />
                          <span>Anticipo ricevuto dal cliente</span>
                        </label>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
            {preventivo?.id && features?.firmaDigitale && <button className="btn btn-secondary" onClick={() => setShowFirma(true)}>✍️ Firma Digitale</button>}
            <button className="btn btn-primary" onClick={handleSave}>💾 Salva Preventivo</button>
          </div>
        </div>
      </div>

      {showPicker && (
        <div className="modal-overlay open" style={{ zIndex: 1100}}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Aggiungi Prodotti</h2>
              <button className="btn-close" onClick={() => setShowPicker(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="search-box" style={{ marginBottom: '16px' }}>
                <span className="search-icon">🔍</span>
                <input className="form-input" placeholder="Cerca catalogo..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
              </div>
              <div className="product-grid" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredProdotti.length === 0 ? (
                  <div className="empty-state"><p>Nessun prodotto trovato</p></div>
                ) : (
                  filteredProdotti.map(p => (
                    <div key={p.id} className={`product-pick-card ${pickerSelected[p.id] ? 'selected' : ''}`} onClick={() => togglePick(p.id)} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {p.foto && (
                        <img src={p.foto} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                      )}
                      <div>
                        <div className="product-pick-name">{p.nome}</div>
                        <div className="product-pick-cat">{p.categoria || ''} · {p.materiale || ''}</div>
                        <div className="product-pick-price">{fmt(p.prezzo)} / {p.um || 'cad.'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPicker(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={confirmPicker}>Aggiungi Selezionati</button>
            </div>
          </div>
        </div>
      )}
      {showFirma && (
        <div className="modal-overlay open" style={{ zIndex: 1200 }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">✍️ Firma Digitale</h2>
              <button className="btn-close" onClick={() => setShowFirma(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: '12px' }}>Il cliente firma qui con il dito o il mouse. La firma verrà salvata nel preventivo.</p>
              <div style={{ border: '2px solid var(--border)', borderRadius: '10px', background: 'white', position: 'relative' }}>
                <canvas ref={firmaCanvasRef} style={{ width: '100%', height: '200px', touchAction: 'none', cursor: 'crosshair', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', color: 'var(--border)', fontSize: '0.8rem', pointerEvents: 'none' }}>Firma qui</div>
                <div style={{ position: 'absolute', bottom: '8px', right: '8px' }}>
                  <button className="btn btn-ghost btn-sm" onClick={clearFirma} style={{ fontSize: '0.75rem' }}>✕ Cancella</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFirma(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={salvaFirma}>💾 Salva Firma</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
