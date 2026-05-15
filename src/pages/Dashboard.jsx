import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState({
    prevTot: 0, 
    prevMeseLen: 0,
    prevMeseVal: 0,
    accettatiLen: 0,
    accettatiVal: 0,
    inviatiLen: 0,
  });
  const [recentPrev, setRecentPrev] = useState([]);
  const [recentClienti, setRecentClienti] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [pSnap, cSnap] = await Promise.all([
          db.collection('preventivi').orderBy('createdAt', 'desc').get(),
          db.collection('clienti').orderBy('cognome').get()
        ]);
        
        const preventivi = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const clienti = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const mese = new Date();
        const prevMese = preventivi.filter(p => {
          const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
          return d.getMonth() === mese.getMonth() && d.getFullYear() === mese.getFullYear();
        });
        const totMese = prevMese.reduce((s, p) => s + (p.totaleFinale||0), 0);
        
        const accettati = preventivi.filter(p => p.stato === 'accettato');
        const inviati = preventivi.filter(p => p.stato === 'inviato');

        setStats({
          prevTot: preventivi.length,
          prevMeseLen: prevMese.length,
          prevMeseVal: totMese,
          accettatiLen: accettati.length,
          accettatiVal: accettati.reduce((s,p) => s + (p.totaleFinale||0), 0),
          inviatiLen: inviati.length
        });

        // Map recent preventivi to include client names
        const enrichedPrev = preventivi.slice(0, 6).map(p => {
          const cl = clienti.find(c => c.id === p.clienteId);
          return { ...p, nomeCliente: cl ? `${cl.cognome} ${cl.nome}` : p.clienteNome || '—' };
        });

        setRecentPrev(enrichedPrev);
        setRecentClienti(clienti.slice(0, 5));
      } catch (e) {
        console.warn('Errore stats:', e);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  function fmt(n) { return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(n||0); }

  function statusBadge(s) {
    const map = { bozza:'badge-draft', inviato:'badge-sent', accettato:'badge-accepted', rifiutato:'badge-rejected' };
    const label = { bozza:'Bozza', inviato:'Inviato', accettato:'Accettato', rifiutato:'Rifiutato' };
    return <span className={`badge ${map[s]||'badge-draft'}`}>{label[s]||s}</span>;
  }

  if (loading) {
    return <div className="content"><div className="empty-state"><p>Caricamento dashboard...</p></div></div>;
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('preventivi')}>
          <div className="stat-label">Preventivi totali</div>
          <div className="stat-value">{stats.prevTot}</div>
          <div className="stat-sub">in archivio</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('preventivi')}>
          <div className="stat-label">Questo mese</div>
          <div className="stat-value">{stats.prevMeseLen}</div>
          <div className="stat-sub">{fmt(stats.prevMeseVal)} di valore</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('preventivi')}>
          <div className="stat-label">Accettati</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.accettatiLen}</div>
          <div className="stat-sub">{fmt(stats.accettatiVal)}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('preventivi')}>
          <div className="stat-label">Da seguire</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.inviatiLen}</div>
          <div className="stat-sub">in attesa risposta</div>
        </div>
      </div>

      <div className="recent-grid">
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem' }}>Ultimi Preventivi</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab && setActiveTab('preventivi')}>Vedi tutti →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>N°</th><th>Cliente</th><th>Totale</th><th>Stato</th></tr></thead>
              <tbody>
                {recentPrev.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>Nessun preventivo ancora</td></tr>
                ) : (
                  recentPrev.map(p => (
                    <tr key={p.id}>
                      <td><strong>#{p.numero || p.id.slice(-4).toUpperCase()}</strong></td>
                      <td>{p.nomeCliente}</td>
                      <td>{fmt(p.totaleFinale)}</td>
                      <td>{statusBadge(p.stato || 'bozza')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Azioni rapide</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => setActiveTab && setActiveTab('preventivi')}>📋 Gestisci Preventivi</button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => setActiveTab && setActiveTab('clienti')}>👤 Gestisci Clienti</button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => setActiveTab && setActiveTab('prodotti')}>📦 Gestisci Database Prodotti</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Clienti recenti</h3>
            {recentClienti.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Nessun cliente ancora</p>
            ) : (
              recentClienti.map(c => (
                <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.cognome} {c.nome}</div>
                    {c.azienda && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{c.azienda}</div>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab && setActiveTab('preventivi')} title="Vai a Preventivi">Vedi</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
