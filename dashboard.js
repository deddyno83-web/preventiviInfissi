// ═══════════════════════════════════════════
//  dashboard.js — pagina home
// ═══════════════════════════════════════════

async function renderDashboard() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary" onclick="openPreventivoModal()">
      + Nuovo Preventivo
    </button>`;

  await Promise.all([loadPreventivi(), loadClienti(), loadCompany()]);

  const mese = new Date();
  const prevMese = preventivi.filter(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
    return d.getMonth() === mese.getMonth() && d.getFullYear() === mese.getFullYear();
  });
  const totMese = prevMese.reduce((s, p) => s + (p.totaleFinale||0), 0);
  const accettati = preventivi.filter(p => p.stato === 'accettato');
  const inviati = preventivi.filter(p => p.stato === 'inviato');

  document.getElementById('page-content').innerHTML = `
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Preventivi totali</div>
      <div class="stat-value">${preventivi.length}</div>
      <div class="stat-sub">in archivio</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Questo mese</div>
      <div class="stat-value">${prevMese.length}</div>
      <div class="stat-sub">${fmt(totMese)} di valore</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Accettati</div>
      <div class="stat-value">${accettati.length}</div>
      <div class="stat-sub">${fmt(accettati.reduce((s,p)=>s+(p.totaleFinale||0),0))}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Da seguire</div>
      <div class="stat-value">${inviati.length}</div>
      <div class="stat-sub">in attesa risposta</div>
    </div>
  </div>

  <div class="recent-grid">
    <div class="card" style="padding:0">
      <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <h3 style="font-size:1rem">Ultimi Preventivi</h3>
        <button class="btn btn-ghost btn-sm" onclick="navigate('preventivi')">Vedi tutti →</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Cliente</th><th>Totale</th><th>Stato</th></tr></thead>
          <tbody>
            ${preventivi.slice(0,6).map(p => {
              const cl = clienti.find(c => c.id === p.clienteId);
              return `<tr>
                <td><strong>#${p.numero||p.id.slice(-4)}</strong></td>
                <td>${cl?`${cl.cognome} ${cl.nome}`:p.clienteNome||'—'}</td>
                <td>${fmt(p.totaleFinale)}</td>
                <td>${statusBadge(p.stato||'bozza')}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text3)">Nessun preventivo ancora</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card">
        <h3 style="font-size:1rem;margin-bottom:16px">Azioni rapide</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary" style="justify-content:center" onclick="openPreventivoModal()">📋 Nuovo Preventivo</button>
          <button class="btn btn-secondary" style="justify-content:center" onclick="navigate('clienti');setTimeout(openClienteModal,300)">👤 Nuovo Cliente</button>
          <button class="btn btn-secondary" style="justify-content:center" onclick="navigate('prodotti');setTimeout(openProdottoModal,300)">📦 Nuovo Prodotto</button>
        </div>
      </div>
      <div class="card">
        <h3 style="font-size:1rem;margin-bottom:12px">Clienti recenti</h3>
        ${clienti.slice(0,5).map(c => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:0.88rem">${c.cognome} ${c.nome}</div>
              ${c.azienda?`<div style="font-size:0.75rem;color:var(--text3)">${c.azienda}</div>`:''}
            </div>
            <button class="btn btn-ghost btn-sm" onclick="newPreventivoForCliente('${c.id}')">+</button>
          </div>`).join('') || `<p style="color:var(--text3);font-size:0.85rem">Nessun cliente ancora</p>`}
      </div>
    </div>
  </div>`;
}