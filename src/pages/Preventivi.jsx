import React, { useState, useEffect } from 'react';
import { db, firebase } from '../services/firebase';
import PreventivoModal from './PreventivoModal';
import { generatePDF, sendWhatsApp, eseguiInvioEmail, sendEmail, buildEmailBody, getGmailToken, GMAIL_SENDER } from '../utils/actions';

const STATO_STYLE = {
  bozza:         { color: '#6B6560', background: '#F0EDE8' },
  inviato:       { color: '#2980B9', background: '#EBF5FB' },
  accettato:     { color: '#27AE60', background: '#EBF8F1' },
  in_lavorazione:{ color: '#8E44AD', background: '#F5EEF8' },
  consegnato:    { color: '#1A5276', background: '#D6EAF8' },
  rifiutato:     { color: '#C0392B', background: '#FDEDED' },
};

const PAGE_SIZE = 25;

export default function Preventivi({ initialClienteId, onClearInitialCliente, openNewPrev, onClearOpenNewPrev }) {
  const [preventivi, setPreventivi] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [statusFilter, setStatusFilter] = useState('tutti');
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('corrente');
  const [loading, setLoading] = useState(true);

  // Paginazione
  const [pageCursors, setPageCursors] = useState([]); // cursori Firestore per ogni pagina
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPreventivo, setCurrentPreventivo] = useState(null);
  // Email modal
  const [emailModal, setEmailModal] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    loadClienti();
  }, []);

  useEffect(() => {
    if (!isSearchMode) {
      resetAndLoad(monthFilter, statusFilter);
    }
  }, [monthFilter, statusFilter]);

  useEffect(() => {
    if (openNewPrev) {
      setCurrentPreventivo(null);
      setIsModalOpen(true);
      if (onClearOpenNewPrev) onClearOpenNewPrev();
    }
  }, [openNewPrev]);

  const scadutiCount = (() => {
    const oggi = new Date(); oggi.setHours(0,0,0,0);
    return preventivi.filter(p => p.validoFino && new Date(p.validoFino) < oggi && !['rifiutato','consegnato'].includes(p.stato)).length;
  })();

  useEffect(() => {
    if (initialClienteId) {
      setCurrentPreventivo({ clienteId: initialClienteId });
      setIsModalOpen(true);
      if (onClearInitialCliente) onClearInitialCliente();
    }
  }, [initialClienteId]);

  async function loadClienti() {
    const cSnap = await db.collection('clienti').get();
    setClienti(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  function buildQuery(mFilter, stFilter) {
    const oggi = new Date();
    let query = db.collection('preventivi');
    if (mFilter && mFilter !== 'tutti' && stFilter !== 'scaduti') {
      let startDate, endDate;
      if (mFilter === 'corrente') {
        startDate = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
        endDate   = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1);
      } else if (mFilter === 'scorso') {
        startDate = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
        endDate   = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
      } else if (mFilter === '3mesi') {
        startDate = new Date(oggi.getFullYear(), oggi.getMonth() - 3, 1);
        endDate   = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1);
      } else if (mFilter === 'anno') {
        startDate = new Date(oggi.getFullYear(), 0, 1);
        endDate   = new Date(oggi.getFullYear() + 1, 0, 1);
      }
      if (startDate && endDate) {
        query = query
          .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(startDate))
          .where('createdAt', '<',  firebase.firestore.Timestamp.fromDate(endDate));
      }
    }
    return query.orderBy('createdAt', 'desc');
  }

  function resetAndLoad(mFilter, stFilter) {
    setCurrentPage(0);
    setPageCursors([]);
    loadPage(mFilter, stFilter, null);
  }

  async function loadPage(mFilter, stFilter, cursor) {
    setLoading(true);
    try {
      let query = buildQuery(mFilter, stFilter).limit(PAGE_SIZE + 1);
      if (cursor) query = query.startAfter(cursor);
      const pSnap = await query.get();
      const allDocs = pSnap.docs;
      const hasNext = allDocs.length > PAGE_SIZE;
      const pData = allDocs.slice(0, PAGE_SIZE).map(d => ({ id: d.id, ...d.data() }));
      setHasNextPage(hasNext);
      setPreventivi(pData);
      applyFilters(pData, clienti, stFilter, '');
    } finally {
      setLoading(false);
    }
  }

  // Carica TUTTI i preventivi del periodo solo per la ricerca
  async function loadAllForSearch(mFilter, stFilter, q) {
    setLoading(true);
    try {
      const pSnap = await buildQuery(mFilter, stFilter).get();
      const pData = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPreventivi(pData);
      applyFilters(pData, clienti, stFilter, q);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(pList, cList, status, q) {
    let list = pList;
    if (status === 'scaduti') {
      const oggi = new Date(); oggi.setHours(0,0,0,0);
      list = list.filter(p => p.validoFino && new Date(p.validoFino) < oggi && !['rifiutato','consegnato'].includes(p.stato));
    } else if (status !== 'tutti') {
      list = list.filter(p => p.stato === status);
    }
    if (q) {
      list = list.filter(p => {
        const cl = cList.find(c => c.id === p.clienteId);
        const name = cl ? `${cl.cognome} ${cl.nome}` : (p.clienteNome || '');
        return name.toLowerCase().includes(q) || (p.numero || '').toLowerCase().includes(q);
      });
    }
    setFilteredList(list);
  }

  function handleFilterStatus(st) {
    setStatusFilter(st);
  }

  function handleSearch(e) {
    const q = e.target.value.toLowerCase();
    setSearchQuery(q);
    if (q.length >= 2) {
      setIsSearchMode(true);
      loadAllForSearch(monthFilter, statusFilter, q);
    } else {
      setIsSearchMode(false);
      resetAndLoad(monthFilter, statusFilter);
    }
  }

  function handleMonthFilter(e) {
    setMonthFilter(e.target.value);
  }

  function goToNextPage() {
    const lastDoc = preventivi.length > 0
      ? db.collection('preventivi').doc(preventivi[preventivi.length - 1].id)
      : null;
    // Salva il cursore della pagina corrente
    const newCursors = [...pageCursors];
    newCursors[currentPage] = preventivi[preventivi.length - 1];
    setPageCursors(newCursors);
    setCurrentPage(p => p + 1);
    // Usa il documento Firestore come cursore
    const cursorDoc = db.collection('preventivi').doc(preventivi[preventivi.length - 1].id);
    loadPageWithDoc(monthFilter, statusFilter, preventivi[preventivi.length - 1]);
  }

  function goToPrevPage() {
    const prevPage = currentPage - 1;
    setCurrentPage(prevPage);
    const cursor = prevPage > 0 ? pageCursors[prevPage - 1] : null;
    loadPageWithDoc(monthFilter, statusFilter, cursor);
  }

  async function loadPageWithDoc(mFilter, stFilter, cursorData) {
    setLoading(true);
    try {
      let query = buildQuery(mFilter, stFilter).limit(PAGE_SIZE + 1);
      if (cursorData) {
        const cursorSnap = await db.collection('preventivi').doc(cursorData.id).get();
        query = query.startAfter(cursorSnap);
      }
      const pSnap = await query.get();
      const allDocs = pSnap.docs;
      const hasNext = allDocs.length > PAGE_SIZE;
      const pData = allDocs.slice(0, PAGE_SIZE).map(d => ({ id: d.id, ...d.data() }));
      setHasNextPage(hasNext);
      setPreventivi(pData);
      applyFilters(pData, clienti, stFilter, '');
    } finally {
      setLoading(false);
    }
  }

  // Ricarica la pagina corrente dopo modifiche
  async function loadData(mFilter, stFilter) {
    if (isSearchMode && searchQuery.length >= 2) {
      loadAllForSearch(mFilter, stFilter, searchQuery);
    } else {
      resetAndLoad(mFilter, stFilter);
    }
  }

  async function deletePreventivo(id) {
    if (!window.confirm('Eliminare questo preventivo?')) return;
    try {
      await db.collection('preventivi').doc(id).delete();
      loadData(monthFilter, statusFilter);
    } catch (e) { alert('Errore: ' + e.message); }
  }

  async function cambiaStato(id, nuovoStato) {
    try {
      await db.collection('preventivi').doc(id).update({ stato: nuovoStato });
      setPreventivi(prev => prev.map(p => p.id === id ? { ...p, stato: nuovoStato } : p));
      // Need to also update filteredList since applyFilters isn't run again automatically here
      setFilteredList(prev => prev.map(p => p.id === id ? { ...p, stato: nuovoStato } : p));
    } catch (err) {
      console.error(err);
      alert('Errore aggiornamento stato');
    }
  }

  async function duplicaPreventivo(id) {
    if (!window.confirm('Duplicare questo preventivo come nuova bozza?')) return;
    try {
      const orig = preventivi.find(p => p.id === id);
      if (!orig) { alert('Preventivo non trovato'); return; }
      const lastSnap = await db.collection('preventivi').orderBy('numero', 'desc').limit(1).get();
      const lastNum = lastSnap.empty ? 0 : parseInt(lastSnap.docs[0].data().numero || '0');
      const nuovoNumero = String(lastNum + 1).padStart(4, '0');
      const data = {
        clienteId: orig.clienteId, clienteNome: orig.clienteNome,
        stato: 'bozza', note: orig.note || '', noteInterne: orig.noteInterne || '',
        items: JSON.parse(JSON.stringify(orig.items || [])),
        subtotale: orig.subtotale || 0, scontoAmt: orig.scontoAmt || 0,
        scontoTipo: orig.scontoTipo || 'nessuno', scontoValore: orig.scontoValore || 0,
        imponibile: orig.imponibile || 0, ivaAmt: orig.ivaAmt || 0,
        totaleFinale: orig.totaleFinale || 0, ivaPerc: orig.ivaPerc || 22,
        ivaEsclusa: orig.ivaEsclusa || false, anticipoPerc: orig.anticipoPerc ?? 40,
        anticipoRicevuto: false, anticipoDataRicevuto: null,
        numero: nuovoNumero, numeroPrefisso: orig.numeroPrefisso || '',
        validoFino: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('preventivi').add(data);
      alert(`Preventivo duplicato come #${nuovoNumero} — Bozza!`);
      loadData(monthFilter, statusFilter);
    } catch (e) { alert('Errore duplica: ' + e.message); }
  }

  async function openEmailModal(prevId) {
    const info = await sendEmail(prevId);
    if (!info) return;
    setEmailStatus(null);
    setEmailSending(false);
    setEmailModal({ prevId, ...info, body: info.defaultBody });
  }

  async function handleInviaEmail() {
    if (!emailModal) return;
    setEmailSending(true);
    try {
      await eseguiInvioEmail(
        emailModal.prevId,
        emailModal.toEmail,
        emailModal.body,
        (type, msg) => setEmailStatus({ type, msg }),
        emailModal.prev,
        emailModal.companyData
      );
      setTimeout(() => { setEmailModal(null); loadData(monthFilter, statusFilter); }, 1800);
    } catch (e) {
      setEmailSending(false);
    }
  }

  async function marcaAccontoRicevuto(id, ricevuto) {
    try {
      await db.collection('preventivi').doc(id).update({
        anticipoRicevuto: ricevuto,
        anticipoDataRicevuto: ricevuto ? new Date().toISOString().split('T')[0] : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      loadData(monthFilter, statusFilter);
    } catch(e) { alert('Errore: ' + e.message); }
  }

  function openPreventivoModal(idStr = null) {
    const p = idStr ? preventivi.find(x => x.id === idStr) : null;
    setCurrentPreventivo(p);
    setIsModalOpen(true);
  }

  async function savePreventivo(dataToSave) {
    try {
      if (currentPreventivo?.id) {
        await db.collection('preventivi').doc(currentPreventivo.id).update(dataToSave);
      } else {
        const lastSnap = await db.collection('preventivi').orderBy('numero', 'desc').limit(1).get();
        const lastNum = lastSnap.empty ? 0 : parseInt(lastSnap.docs[0].data().numero || '0');
        dataToSave.numero = String(lastNum + 1).padStart(4, '0');
        dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('preventivi').add(dataToSave);
      }
      setIsModalOpen(false);
      loadData(monthFilter, statusFilter);
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  function fmt(n) { return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(n||0); }
  function fmtDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('it-IT');
  }

  return (
    <div className="content">
      <div style={{ flexWrap: 'wrap', gap: '10px', display: 'flex', alignItems: 'center', marginBottom: '16px', justifyContent: 'flex-start' }}>
        <div className="search-box" style={{ width: '220px' }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Cerca preventivo..." value={searchQuery} onChange={handleSearch} />
        </div>
        <select className="form-input" value={monthFilter} onChange={handleMonthFilter} style={{ width: 'auto', padding: '6px 12px' }}>
          <option value="tutti">Tutti i mesi</option>
          <option value="corrente">Mese corrente</option>
          <option value="scorso">Mese scorso</option>
          <option value="3mesi">Ultimi 3 mesi</option>
          <option value="anno">Quest'anno</option>
        </select>
        <button className={`btn btn-sm ${statusFilter === 'tutti' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleFilterStatus('tutti')}>Tutti</button>
        <button className={`btn btn-sm ${statusFilter === 'bozza' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleFilterStatus('bozza')}>📝 Bozze</button>
        <button className={`btn btn-sm ${statusFilter === 'inviato' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleFilterStatus('inviato')}>📤 Inviati</button>
        <button className={`btn btn-sm ${statusFilter === 'accettato' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleFilterStatus('accettato')}>✅ Accettati</button>
        <button className={`btn btn-sm ${statusFilter === 'in_lavorazione' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleFilterStatus('in_lavorazione')}>🔧 In lavorazione</button>
        <button className={`btn btn-sm ${statusFilter === 'consegnato' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleFilterStatus('consegnato')}>📦 Consegnati</button>
        {scadutiCount > 0 && (
          <button className={`btn btn-sm ${statusFilter === 'scaduti' ? 'btn-primary' : 'btn-secondary'}`}
            style={statusFilter !== 'scaduti' ? { color: 'var(--danger)', borderColor: 'var(--danger)', background: '#FDEDED' } : {}}
            onClick={() => handleFilterStatus('scaduti')}>
            ⚠️ Scaduti ({scadutiCount})
          </button>
        )}
      </div>
      
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N° Prev.</th><th>Cliente</th><th>Data</th>
                <th>Totale</th><th>Stato</th><th style={{ textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6"><div className="empty-state"><p>Caricamento in corso...</p></div></td></tr>
              ) : filteredList.length === 0 ? (
                <tr><td colSpan="6"><div className="empty-state"><h3>Nessun preventivo</h3><p>Crea il primo preventivo</p></div></td></tr>
              ) : (
                filteredList.map(p => {
                  const cl = clienti.find(c => c.id === p.clienteId);
                  const nomeCliente = cl ? `${cl.cognome} ${cl.nome}` : p.clienteNome || '—';
                  const st = p.stato || 'bozza';

                  const oggi = new Date(); oggi.setHours(0,0,0,0);
                  const isScaduto = p.validoFino && new Date(p.validoFino) < oggi && !['rifiutato','consegnato'].includes(st);
                  const giorniScaduto = isScaduto ? Math.round((oggi - new Date(p.validoFino)) / (1000*60*60*24)) : 0;

                  return (
                    <tr key={p.id} style={isScaduto ? { borderLeft: '3px solid #E74C3C' } : {}}>
                      <td>
                        <strong>{p.numeroPrefisso ? `${p.numeroPrefisso}/${p.numero}` : p.numero || p.id.slice(-6).toUpperCase()}</strong>
                        {isScaduto && <div style={{ fontSize: '0.72rem', color: '#E74C3C', marginTop: '2px', fontWeight: 600 }}>⚠ Scaduto da {giorniScaduto}gg</div>}
                      </td>
                      <td>
                        {nomeCliente}
                        {cl?.azienda && <><br /><small style={{ color: 'var(--text3)' }}>{cl.azienda}</small></>}
                      </td>
                      <td>{fmtDate(p.createdAt)}</td>
                      <td>
                        <strong>{fmt(p.totaleFinale)}</strong>
                        {/* Badge acconto */}
                        {['accettato','in_lavorazione','consegnato'].includes(p.stato) && (p.anticipoPerc ?? 0) > 0 && (() => {
                          const ant = p.totaleFinale * ((p.anticipoPerc ?? 40) / 100);
                          const sal = p.totaleFinale - ant;
                          if (p.anticipoRicevuto) {
                            return (<>
                              <br/><span style={{ display:'inline-flex',alignItems:'center',gap:'3px',marginTop:'3px',fontSize:'0.68rem',background:'#EBF8F1',color:'var(--success)',borderRadius:'4px',padding:'1px 6px',fontWeight:600 }}>✓ acconto incassato</span>
                              <br/><span style={{ fontSize:'0.72rem',color:'var(--danger)',fontWeight:600 }}>saldo: {fmt(sal)}</span>
                            </>);
                          } else {
                            return (<>
                              <br/><span style={{ display:'inline-flex',alignItems:'center',gap:'3px',marginTop:'3px',fontSize:'0.68rem',background:'#FFF8E1',color:'#E67E22',borderRadius:'4px',padding:'1px 6px',fontWeight:600 }}>⏳ acconto atteso {fmt(ant)}</span>
                            </>);
                          }
                        })()}
                      </td>
                      <td>
                        <select
                          className="stato-select"
                          value={p.stato || 'bozza'}
                          onChange={(e) => cambiaStato(p.id, e.target.value)}
                          style={{ ...(STATO_STYLE[p.stato] || STATO_STYLE.bozza) }}
                        >
                          <option value="bozza">📝 Bozza</option>
                          <option value="inviato">📤 Inviato</option>
                          <option value="accettato">✅ Accettato</option>
                          <option value="in_lavorazione">🔧 In lavorazione</option>
                          <option value="consegnato">📦 Consegnato</option>
                          <option value="rifiutato">❌ Rifiutato</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openPreventivoModal(p.id)} title="Modifica preventivo" style={{ color: 'var(--info)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => duplicaPreventivo(p.id)} title="Duplica preventivo" style={{ color: 'var(--text2)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => generatePDF(p.id)} title="PDF" style={{ color: 'var(--danger)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEmailModal(p.id)} title="Email" style={{ color: 'var(--warning)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => sendWhatsApp(p.id)} title="WhatsApp" style={{ color: '#25D366' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M11.956 0C5.354 0 0 5.343 0 11.932c0 2.103.554 4.114 1.606 5.892L.062 24l6.34-1.61A12.04 12.04 0 0 0 11.956 24c6.603 0 11.956-5.343 11.956-11.932C23.912 5.354 18.559 0 11.956 0zm0 21.818a9.87 9.87 0 0 1-5.018-1.367l-.36-.213-3.732.949.979-3.629-.235-.373a9.718 9.718 0 0 1-1.507-5.253c0-5.39 4.42-9.778 9.873-9.778 5.452 0 9.872 4.388 9.872 9.778 0 5.39-4.42 9.886-9.872 9.886z"/></svg>
                        </button>
                        {['accettato','in_lavorazione','consegnato'].includes(p.stato) && (p.anticipoPerc ?? 0) > 0 && (
                          <button
                            className={`btn btn-ghost btn-sm btn-icon`}
                            title={p.anticipoRicevuto ? 'Annulla acconto ricevuto' : 'Marca acconto come ricevuto'}
                            style={{ color: p.anticipoRicevuto ? 'var(--success)' : '#E67E22' }}
                            onClick={() => marcaAccontoRicevuto(p.id, !p.anticipoRicevuto)}
                          >
                            {p.anticipoRicevuto ? '✔️' : '💰'}
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deletePreventivo(p.id)} title="Elimina" style={{ color: 'var(--text2)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAZIONE — nascosta in modalità ricerca */}
        {!isSearchMode && !loading && (currentPage > 0 || hasNextPage) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px 0' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
            >← Precedenti</button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>
              Pagina {currentPage + 1}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={goToNextPage}
              disabled={!hasNextPage}
            >Successivi →</button>
          </div>
        )}
        {isSearchMode && (
          <div style={{ textAlign: 'center', padding: '8px 0', fontSize: '0.8rem', color: 'var(--text3)' }}>
            Ricerca attiva — mostrati tutti i risultati del periodo
          </div>
        )}
      </div>

      {isModalOpen && (
        <PreventivoModal 
          preventivo={currentPreventivo} 
          clienti={clienti} 
          onClose={() => setIsModalOpen(false)} 
          onSave={savePreventivo} 
        />
      )}

      {emailModal && (
        <div className="modal-overlay open" style={{ zIndex: 1000 }}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">📧 Invia Preventivo via Email</h2>
              <button className="btn-close" onClick={() => setEmailModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Da:</span><span>{GMAIL_SENDER}</span>
                  <span style={{ color: 'var(--text3)', fontWeight: 600 }}>A:</span>
                  <span>
                    {emailModal.toEmail
                      ? <span style={{ color: 'var(--info)' }}>{emailModal.toEmail}</span>
                      : <input className="form-input" placeholder="Inserisci email cliente..." style={{ fontSize: '0.88rem', padding: '6px 10px' }} type="email"
                          value={emailModal.toEmail || ''} onChange={e => setEmailModal(m => ({...m, toEmail: e.target.value}))} />
                    }
                  </span>
                  <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Oggetto:</span>
                  <span>Preventivo {emailModal.numPDF} – {emailModal.companyData?.nome || 'InfissiPro'}</span>
                  <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Allegato:</span>
                  <span style={{ color: 'var(--success)' }}>📄 Preventivo_{emailModal.prev?.numero || ''}.pdf</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Testo email</label>
                <textarea className="form-textarea" style={{ minHeight: '160px' }} value={emailModal.body}
                  onChange={e => setEmailModal(m => ({...m, body: e.target.value}))} />
              </div>
              {emailStatus && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', marginTop: '8px',
                  background: emailStatus.type === 'done' ? '#EBF8F1' : emailStatus.type === 'error' ? '#FDEDED' : 'var(--surface2)',
                  color: emailStatus.type === 'done' ? 'var(--success)' : emailStatus.type === 'error' ? 'var(--danger)' : 'var(--text2)'
                }}>{emailStatus.msg}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEmailModal(null)}>Annulla</button>
              <button className="btn btn-primary" disabled={emailSending} onClick={handleInviaEmail}>
                {emailSending ? '⏳ Invio...' : '📤 Invia con PDF allegato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
