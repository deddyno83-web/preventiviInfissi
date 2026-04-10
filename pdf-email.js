// ═══════════════════════════════════════════
//  pdf-email.js — generazione PDF, Gmail API
// ═══════════════════════════════════════════

// PDF GENERATION
async function generatePDF(prevId) {
  await Promise.all([loadPreventivi(), loadClienti(), loadCompany()]);
  const prev = preventivi.find(p => p.id === prevId);
  if (!prev) { toast('Preventivo non trovato', 'error'); return; }
  const cl = clienti.find(c => c.id === prev.clienteId) || {};

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const M = 15;
  let y = M;

  // ── Funzione helper: nuova pagina con header ripetuto ──
  function newPage() {
    doc.addPage();
    y = 15;
    // linea separatrice top
    doc.setDrawColor(220,220,220);
    doc.line(M, y+2, W-M, y+2);
    doc.setFont('helvetica','italic'); doc.setFontSize(7); doc.setTextColor(160,155,150);
    doc.text(companyData.nome||'', M, y+7);
    const numP = prev.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero||prevId.slice(-4)}` : (prev.numero||prevId.slice(-6));
    doc.text(`Preventivo N° ${numP}`, W-M, y+7, {align:'right'});
    y += 12;
  }

  // ════════════════════════
  // HEADER — Logo + dati azienda
  // ════════════════════════
  const headerH = 38;
  doc.setFillColor(255,255,255);

  // Logo a sinistra
  if (companyData.logoBase64) {
    try {
      const ext = companyData.logoBase64.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(companyData.logoBase64, ext, M, y, 55, 28, '', 'FAST');
    } catch(e) {}
  }

  // Dati azienda a destra del logo
  const ax = M + 60;
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(20,20,20);
  doc.text(companyData.nome||'', ax, y+6);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(60,60,60);
  const aLines = [
    companyData.indirizzo||'',
    companyData.telefono ? `Tel. ${companyData.telefono}` : '',
    companyData.piva ? `P. iva ${companyData.piva}` : '',
    companyData.email||'', companyData.sito||''
  ].filter(Boolean);
  aLines.forEach((l,i) => doc.text(l, ax, y+12+i*5));

  y += headerH;

  // Linea separatrice
  doc.setDrawColor(180,180,180); doc.setLineWidth(0.3);
  doc.line(M, y, W-M, y); y += 6;

  // ════════════════════════
  // INTESTAZIONE PREVENTIVO
  // ════════════════════════
  const numPDF = prev.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero||prevId.slice(-4)}` : (prev.numero||prevId.slice(-6).toUpperCase());
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(20,20,20);
  doc.text(`Preventivo n° ${numPDF} del ${fmtDate(prev.createdAt)}`, M, y+5);

  // Cliente sulla stessa riga, allineato a destra
  const nomeCliente = `${cl.cognome||''} ${cl.nome||''}`.trim() || prev.clienteNome || '';
  const cellTxt = cl.telefono ? ` – cell. ${cl.telefono}` : '';
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(`Cliente: ${nomeCliente}${cellTxt}`, M, y+12);
  if (cl.indirizzo || cl.citta) {
    doc.setFontSize(8); doc.setTextColor(80,80,80);
    doc.text([cl.indirizzo, cl.citta].filter(Boolean).join(', '), M, y+18);
  }

  // Validità offerta
  if (prev.validoFino) {
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(120,80,20);
    const vd = new Date(prev.validoFino).toLocaleDateString('it-IT');
    doc.text(`Validità offerta: fino al ${vd}`, W-M, y+5, {align:'right'});
  }

  y += 24;

  // ════════════════════════
  // TESTO INTRODUTTIVO (note per cliente)
  // ════════════════════════
  if (prev.note) {
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(30,30,30);
    const introLines = doc.splitTextToSize(prev.note, W-2*M);
    doc.text(introLines, M, y);
    y += introLines.length * 5 + 4;
  }

  // ════════════════════════
  // TABELLA PRODOTTI — layout Simeoli
  // ════════════════════════
  const colPos  = M;         // Pos.  width=10
  const colImg  = M+11;      // Immagine+misure  width=38
  const colDesc = M+51;      // Descrizione  width=100
  const colTot  = W-M-2;     // Totale (right-aligned)
  const tableW  = W-2*M;

  // Header tabella — bordo nero, sfondo bianco, testo nero
  doc.setFillColor(255,255,255);
  doc.setDrawColor(30,30,30); doc.setLineWidth(0.5);
  doc.rect(M, y, tableW, 7, 'FD');
  doc.setTextColor(20,20,20); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('Pos.', colPos+1, y+5);
  doc.text('Struttura', colImg+1, y+5);
  doc.text('Descrizione', colDesc+1, y+5);
  doc.text('Totale', colTot, y+5, {align:'right'});
  y += 7;

  let subtot = 0;
  (prev.items || []).forEach((it, idx) => {
    // Calcola totale riga
    const um = it.um || 'pz';
    let lineTotal = 0;
    let dimStr = '';
    let superfStr = '';
    let mqVal = 0;
    if (um === 'mq') {
      const largMm = parseInt(it.larghezza)||0;
      const altMm  = parseInt(it.altezza)||0;
      const mqRaw = (largMm/1000) * (altMm/1000);
      // Usa mqManuale se impostato, altrimenti arrotonda al centesimo superiore
      // Arrotonda al mezzo m² superiore (0.50)
      mqVal = (it.mqManuale > 0) ? it.mqManuale : Math.ceil(mqRaw * 2) / 2;
      lineTotal = parseFloat((it.prezzo * mqVal * (it.qty||1)).toFixed(2));
      dimStr = `L ${largMm} x h${altMm} mm`;
      superfStr = `mq ${mqVal.toFixed(2)} x ${fmt(it.prezzo).replace('€','').trim()} €/mq`;
    } else if (um === 'ml') {
      const lungMm = parseInt(it.larghezza)||0;
      lineTotal = parseFloat((it.prezzo * (lungMm/1000) * (it.qty||1)).toFixed(2));
      dimStr = `${lungMm} mm`;
    } else {
      lineTotal = parseFloat((it.prezzo * (it.qty||1)).toFixed(2));
    }
    subtot += lineTotal;

    // Costruisci le righe di testo descrizione
    const descLines = [];
    descLines.push(`Q.ta ${it.qty||1}`);
    descLines.push(''); // spazio
    // Nome prodotto in grassetto (lo facciamo dopo)
    if (it.descrizioneRiga) descLines.push(`(${it.descrizioneRiga})`);
    if (dimStr) descLines.push(`Misure: ${dimStr}.`);
    if (superfStr) descLines.push(superfStr);
    if (it.sistema) descLines.push(`Sistema: ${it.sistema}`);
    if (it.coloreProfili) descLines.push(`Colore struttura:`);
    if (it.coloreProfili) descLines.push(it.coloreProfili);
    if (it.coloreAccessori) descLines.push(`Apertura: ${it.coloreAccessori}`);
    if (it.altezzaManiglia) descLines.push(`Alt. maniglia: ${it.altezzaManiglia} mm`);
    if (it.tamponamento) {
      const tl = doc.splitTextToSize(it.tamponamento, 95);
      tl.forEach(t => descLines.push(t));
    }

    // Altezza riga: max tra immagine (40mm) e testo
    const textH = descLines.length * 4.5 + 14; // 14 per il nome prodotto bold + padding
    const imgH = 38; // area immagine
    const rowH = Math.max(textH, imgH) + 8;

    // Controllo page break
    if (y + rowH > 270) newPage();

    // Sfondo riga alternato
    if (idx % 2 === 0) { doc.setFillColor(252,252,252); } else { doc.setFillColor(245,245,245); }
    doc.rect(M, y, tableW, rowH, 'F');

    // Bordo riga
    doc.setDrawColor(210,210,210); doc.setLineWidth(0.2);
    doc.rect(M, y, tableW, rowH, 'S');

    // Colonna Pos.
    doc.setFillColor(220,220,220);
    doc.rect(colPos, y, 10, rowH, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(30,30,30);
    doc.text(String(idx+1), colPos+5, y+rowH/2+1, {align:'center'});

    // Colonna immagine
    doc.setDrawColor(200,200,200);
    doc.rect(colImg, y+2, 36, imgH, 'S');
    // Foto: prendi dall'item o dal catalogo prodotti (le foto non sono salvate su Firestore)
    const fotoSrc = it.foto || prodotti.find(p => p.id === it.prodottoId)?.foto || null;
    if (fotoSrc) {
      try {
        const ext2 = fotoSrc.includes('png')||fotoSrc.includes('PNG') ? 'PNG' : 'JPEG';
        doc.addImage(fotoSrc, ext2, colImg+1, y+3, 34, imgH-2, '', 'FAST');
      } catch(e) {
        doc.setFontSize(7); doc.setTextColor(160,160,160);
        doc.text('img', colImg+18, y+imgH/2+2, {align:'center'});
      }
    }

    // Misure sotto immagine
    if (dimStr) {
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(40,40,40);
      const largMm2 = parseInt(it.larghezza)||0;
      const altMm2 = parseInt(it.altezza)||0;
      if (largMm2) doc.text(`Larghezza: ${largMm2} mm`, colImg+1, y+imgH+6);
      if (altMm2)  doc.text(`Altezza: ${altMm2} mm`, colImg+1, y+imgH+11);
    }

    // Colonna descrizione
    let dy = y + 6;
    // Nome prodotto bold
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(20,20,20);
    const nomeLines = doc.splitTextToSize(it.nome, 92);
    nomeLines.forEach(nl => { doc.text(nl, colDesc+2, dy); dy += 5; });

    // Resto descrizione normale
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(50,50,50);
    descLines.forEach((dl, dli) => {
      if (!dl) { dy += 2; return; } // riga vuota = spazio
      if (dli === 0) return; // salta Q.ta già gestita dopo
      doc.text(dl, colDesc+2, dy);
      dy += 4.5;
    });

    // Q.ta in alto a destra della colonna descrizione
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(20,20,20);
    doc.text(`Q.ta ${it.qty||1}`, colTot-20, y+6, {align:'right'});

    // Totale riga
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(20,20,20);
    doc.text(fmt(lineTotal), colTot, y+rowH/2+1, {align:'right'});

    y += rowH;
  });

  // ════════════════════════
  // TOTALI
  // ════════════════════════
  if (y + 60 > 270) newPage();
  y += 4;

  const scontoAmt = prev.scontoAmt || 0;
  const imponibile = subtot - scontoAmt;
  const ivaAmt = imponibile * (prev.ivaPerc||22) / 100;
  const totale = imponibile + ivaAmt;

  const totLabelX = W - M - 65;
  const totValX = W - M - 2;

  // Linea totali
  doc.setDrawColor(30,30,30); doc.setLineWidth(0.5);
  doc.line(totLabelX-2, y, W-M, y); y += 2;

  if (scontoAmt > 0) {
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(60,60,60);
    doc.text('Subtotale:', totLabelX, y+6); doc.text(fmt(subtot), totValX, y+6, {align:'right'});
    doc.setTextColor(39,130,80);
    const sLab = prev.scontoTipo==='perc' ? `Sconto ${prev.scontoValore}%:` : 'Sconto:';
    doc.text(sLab, totLabelX, y+12); doc.text('- '+fmt(scontoAmt), totValX, y+12, {align:'right'});
    doc.setTextColor(60,60,60);
    doc.text('Imponibile:', totLabelX, y+18); doc.text(fmt(imponibile), totValX, y+18, {align:'right'});
    doc.text(`IVA ${prev.ivaPerc||22}%:`, totLabelX, y+24); doc.text(fmt(ivaAmt), totValX, y+24, {align:'right'});
    y += 28;
  } else {
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(60,60,60);
    doc.text('Imponibile:', totLabelX, y+6); doc.text(fmt(imponibile), totValX, y+6, {align:'right'});
    doc.text(`IVA ${prev.ivaPerc||22}%:`, totLabelX, y+12); doc.text(fmt(ivaAmt), totValX, y+12, {align:'right'});
    y += 16;
  }

  // Box TOTALE FINALE
  doc.setFillColor(20,20,20);
  doc.rect(totLabelX-2, y, W-M-totLabelX+4, 10, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('TOTALE', totLabelX+2, y+7);
  doc.text(fmt(totale), totValX, y+7, {align:'right'});
  y += 16;

  // ════════════════════════
  // CONDIZIONI (note azienda + pagamenti)
  // ════════════════════════
  if (companyData.note) {
    if (y + 20 > 260) newPage();
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(20,20,20);
    doc.text('Condizioni:', M, y+5);
    doc.setFont('helvetica','normal');
    const noteLines = doc.splitTextToSize(companyData.note, W-2*M);
    doc.text(noteLines, M, y+11);
    y += noteLines.length * 4.5 + 14;
  }

  // ════════════════════════
  // TEMPI DI CONSEGNA E PAGAMENTI
  // ════════════════════════
  if (prev.tempiConsegna || prev.pagamenti) {
    if (y + 30 > 260) newPage();
    y += 4;
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.2);
    doc.line(M, y, W-M, y); y += 5;

    if (prev.tempiConsegna) {
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(20,20,20);
      doc.text('Tempi di Consegna:', M, y);
      doc.setFont('helvetica','normal');
      const tLines = doc.splitTextToSize(prev.tempiConsegna, W-2*M-5);
      doc.text(tLines, M, y+5);
      y += tLines.length * 4.5 + 8;
    }

    if (prev.pagamenti) {
      if (y + 20 > 260) newPage();
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(20,20,20);
      doc.text('Pagamenti:', M, y);
      doc.setFont('helvetica','normal');
      const pLines = doc.splitTextToSize(prev.pagamenti, W-2*M-5);
      doc.text(pLines, M, y+5);
      y += pLines.length * 4.5 + 8;
    }
  }

  // ════════════════════════
  // FIRME
  // ════════════════════════
  if (y + 35 > 270) newPage();
  y += 6;

  doc.setDrawColor(150,150,150); doc.setLineWidth(0.3);

  // Firma impresa
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(30,30,30);
  doc.text("Firma dell'impresa", M, y);
  // Firma digitale se presente
  if (prev.firmaBase64) {
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(80,80,80);
    if (prev.firmatoIl) doc.text(`Firmato il: ${new Date(prev.firmatoIl).toLocaleDateString('it-IT')}`, M, y+5);
    try { doc.addImage(prev.firmaBase64, 'PNG', M, y+7, 50, 18, '', 'FAST'); } catch(e) {}
  }
  doc.line(M, y+28, M+60, y+28);
  doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(40,40,40);
  doc.text(companyData.nome||'', M, y+34);

  // Firma committente
  const fx2 = W - M - 65;
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(30,30,30);
  doc.text('Firma del committente', fx2, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(60,60,60);
  doc.text('per accettazione', fx2, y+5);
  doc.line(fx2, y+28, fx2+65, y+28);
  doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(40,40,40);
  const nomeClFirma = `${cl.cognome||''} ${cl.nome||''}`.trim() || prev.clienteNome || '';
  doc.text(nomeClFirma, fx2, y+34);

  y += 40;

  // ════════════════════════
  // FOOTER su ogni pagina
  // ════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    const pageH = 297;
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.2);
    doc.line(M, pageH-12, W-M, pageH-12);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(140,135,130);
    const footParts = [companyData.nome, companyData.indirizzo, companyData.telefono].filter(Boolean);
    doc.text(footParts.join('  –  '), W/2, pageH-7, {align:'center'});
    doc.text(`Pag. ${pg}/${totalPages}`, W-M, pageH-7, {align:'right'});
  }

  const filename = `Preventivo_${prev.numero||prevId.slice(-6).toUpperCase()}.pdf`;

  // Modalità base64 — usata da eseguiInvioEmail per allegare il PDF
  if (window._pdfOutputMode === 'base64') {
    window._pdfBase64Result = doc.output('datauristring');
    return;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS && navigator.share) {
    // iOS con Web Share API — condivide il vero file PDF (non il link blob)
    try {
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      
      // Verifica che il browser supporti la condivisione di file
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: filename,
          files: [pdfFile]
        });
        toast('PDF condiviso!', 'success');
      } else {
        // canShare non supporta file — fallback apertura nuova scheda
        throw new Error('canShare files not supported');
      }
    } catch(e) {
      if (e.name === 'AbortError') {
        // Utente ha annullato — nessun errore
        toast('Condivisione annullata', 'info');
      } else {
        // Fallback: apri in nuova scheda con iframe
        const pdfDataUri = doc.output('datauristring');
        const newTab = window.open('', '_blank');
        if (newTab) {
          newTab.document.write(
            '<!DOCTYPE html><html><head>'
            + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            + '<title>' + filename + '</title>'
            + '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#1C1A17;display:flex;flex-direction:column;height:100vh}.bar{background:#2D2B27;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0}.bar h1{color:#C9A84C;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.btn-dl{background:#C9A84C;color:#1C1A17;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}iframe{flex:1;width:100%;border:none}</style>'
            + '</head><body>'
            + '<div class="bar"><h1>' + filename + '</h1>'
            + '<a class="btn-dl" href="' + pdfDataUri + '" download="' + filename + '">⬇ Scarica</a></div>'
            + '<iframe src="' + pdfDataUri + '"></iframe>'
            + '</body></html>'
          );
          newTab.document.close();
          toast('Usa il bottone ⬇ Scarica per salvare il PDF', 'success');
        } else {
          doc.save(filename);
          toast('PDF generato!', 'success');
        }
      }
    }
  } else {
    // Desktop e Android — download diretto
    doc.save(filename);
    toast('PDF generato!', 'success');
  }
}

// GMAIL API
const GMAIL_CLIENT_ID = '53831286391-nu07c6u4acdch8qnso6n9ql842q5b1gf.apps.googleusercontent.com';
const GMAIL_SENDER   = 'simeoliinfissi@gmail.com';
let _gmailToken = null;
let _gmailTokenExpiry = 0;

// Richiede il token OAuth Gmail — apre popup Google solo se necessario
async function getGmailToken() {
  // Riusa token valido se presente
  if (_gmailToken && Date.now() < _gmailTokenExpiry) return _gmailToken;

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Libreria Google Identity Services non caricata. Ricarica la pagina.'));
      return;
    }
    // Vai direttamente al popup — niente prompt:none che causa GSI_LOGGER error
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GMAIL_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/gmail.send',
      hint: GMAIL_SENDER,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'Autorizzazione Gmail negata'));
          return;
        }
        _gmailToken = resp.access_token;
        _gmailTokenExpiry = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
        resolve(_gmailToken);
      },
      error_callback: (err) => {
        reject(new Error(err.type === 'popup_closed' ? 'Popup chiuso — autorizza Gmail per inviare' : err.message || 'Errore autorizzazione'));
      }
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

// Costruisce il messaggio MIME con PDF allegato
// Usa Uint8Array per evitare doppia codifica del PDF
function buildMimeMessage(to, subject, bodyText, pdfBase64, filename) {
  const boundary = 'InfissiPro_' + Date.now();

  // 1. Estrai base64 puro del PDF — rimuovi prefisso data:... e spazi
  const pdfB64Pure = pdfBase64.split(',').pop().replace(/\s/g, '');

  // 2. Spezza in righe da 76 char (RFC 2045 obbligatorio)
  const pdfLines = pdfB64Pure.match(/.{1,76}/g) || [];

  // 3. Subject con UTF-8
  const subjectB64 = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';

  // 4. Body in base64 UTF-8
  const bodyB64 = btoa(unescape(encodeURIComponent(bodyText)));

  // 5. Costruisci MIME — tutto ASCII, nessuna codifica aggiuntiva
  const lines = [
    'MIME-Version: 1.0',
    'From: ' + GMAIL_SENDER,
    'To: ' + to,
    'Subject: ' + subjectB64,
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
    '',
    '--' + boundary,
    'Content-Type: application/pdf; name="' + filename + '"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="' + filename + '"',
    '',
    ...pdfLines,
    '',
    '--' + boundary + '--',
    ''
  ];

  // 6. Unisci con CRLF — tutto il contenuto è già ASCII puro
  const mimeStr = lines.join('\r\n');

  // 7. Converti in base64url per Gmail API
  // usa btoa direttamente — mimeStr è ASCII puro, nessun problema
  return btoa(mimeStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Genera il PDF e restituisce il base64
async function generatePDFBase64(prevId) {
  await Promise.all([loadPreventivi(), loadClienti(), loadCompany()]);
  const prev = preventivi.find(p => p.id === prevId);
  if (!prev) throw new Error('Preventivo non trovato');

  // Chiama generatePDF ma intercetta l'output invece di salvarlo
  const { jsPDF } = window.jspdf;
  // Ri-esegue la generazione PDF e restituisce base64
  // (riuso la funzione esistente con un flag speciale)
  window._pdfOutputMode = 'base64';
  await generatePDF(prevId);
  const b64 = window._pdfBase64Result;
  window._pdfOutputMode = null;
  window._pdfBase64Result = null;
  return b64;
}

// Helper: costruisce il corpo email predefinito
function buildEmailBody(prev, cl, numPDF) {
  const nomeCliente = cl ? cl.cognome + ' ' + cl.nome : prev.clienteNome || 'Cliente';
  const validita = prev.validoFino ? '\nValidita\' offerta: ' + new Date(prev.validoFino).toLocaleDateString('it-IT') : '';
  return 'Gentile ' + nomeCliente + ',\n\nin allegato trovera\' il preventivo ' + numPDF + ' relativo alla fornitura e installazione infissi.\n\nTotale preventivo: ' + fmt(prev.totaleFinale) + validita + '\n\nPer qualsiasi informazione non esiti a contattarci.\n\nCordiali saluti,\n' + (companyData.nome||'') + (companyData.telefono ? '\nTel. ' + companyData.telefono : '') + (companyData.email ? '\n' + companyData.email : '');
}

async function sendEmail(prevId) {
  await Promise.all([loadPreventivi(), loadClienti(), loadCompany()]);
  const prev = preventivi.find(p => p.id === prevId);
  const cl = clienti.find(c => c.id === prev?.clienteId);

 const toEmail = cl?.email || '';
  // Mostra modal di conferma con anteprima
  const numPDF = prev.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero}` : `#${prev.numero||prevId.slice(-4)}`;
  const nomeCliente = cl ? `${cl.cognome} ${cl.nome}` : prev.clienteNome || '';

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📧 Invia Preventivo via Email</h2>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:0.88rem">
          <span style="color:var(--text3);font-weight:600">Da:</span>
          <span>${GMAIL_SENDER}</span>
          <span style="color:var(--text3);font-weight:600">A:</span>
          <span style="color:var(--info)">${toEmail 
  ? `<span style="color:var(--info)">${toEmail}</span>` 
  : `<input class="form-input" id="email-destinatario" placeholder="Inserisci email cliente..." style="font-size:0.88rem;padding:6px 10px" type="email">`
}</span>
          <span style="color:var(--text3);font-weight:600">Oggetto:</span>
          <span>Preventivo ${numPDF} – ${companyData.nome||'Simeoli Infissi'}</span>
          <span style="color:var(--text3);font-weight:600">Allegato:</span>
          <span style="color:var(--success)">📄 Preventivo_${prev.numero||prevId.slice(-4)}.pdf</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Testo email</label>
        <textarea class="form-textarea" id="email-body" style="min-height:160px">${buildEmailBody(prev, cl, numPDF)}</textarea>
      </div>
      <div id="email-status" style="display:none;padding:10px 14px;border-radius:var(--radius-sm);font-size:0.88rem;margin-top:8px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
      <button class="btn btn-primary" id="btn-invia-email" onclick="eseguiInvioEmail('${prevId}','${toEmail}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Invia con allegato PDF
      </button>
    </div>`);
}

async function eseguiInvioEmail(prevId, toEmail) {
  const emailInput = document.getElementById('email-destinatario');
  if (emailInput) {
    toEmail = emailInput.value.trim();
    if (!toEmail) { toast('Inserisci un indirizzo email', 'error'); return; }
  }
  const btn = document.getElementById('btn-invia-email');
  const status = document.getElementById('email-status');
  const bodyText = document.getElementById('email-body')?.value || '';

  if (btn) { btn.disabled = true; btn.textContent = '🔐 Autorizzazione Gmail...'; }
  if (status) { status.style.display='block'; status.style.background='var(--surface2)'; status.textContent = '🔐 Autorizzazione Gmail in corso...'; }

  try {
    // 1. PRIMA richiedi il token — deve avvenire subito dopo il click
    //    altrimenti il browser blocca il popup OAuth
    const token = await getGmailToken();

    // 2. Ora genera il PDF (il popup è già stato gestito)
    if (btn) btn.textContent = '⏳ Generazione PDF...';
    if (status) status.textContent = '📄 Generazione PDF in corso...';

    await Promise.all([loadPreventivi(), loadClienti(), loadCompany()]);
    const prev = preventivi.find(p => p.id === prevId);

    window._pdfOutputMode = 'base64';
    await generatePDF(prevId);
    const pdfB64 = window._pdfBase64Result;
    window._pdfOutputMode = null;
    window._pdfBase64Result = null;

    if (!pdfB64) throw new Error('Generazione PDF fallita');

    // 3. Costruisci messaggio MIME e invia
    if (btn) btn.textContent = '📤 Invio in corso...';
    if (status) status.textContent = '📤 Invio email con PDF allegato...';

    const numPDF = prev.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero}` : prev.numero || prevId.slice(-4);
    const subject = `Preventivo ${numPDF} – ${companyData.nome||'Simeoli Infissi'}`;
    const filename = `Preventivo_${prev.numero||prevId.slice(-4)}.pdf`;

    const mimeMsg = buildMimeMessage(toEmail, subject, bodyText, pdfB64, filename);

    // 4. Invia via Gmail API
    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: mimeMsg })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || 'Errore invio');
    }

    // 5. Aggiorna stato preventivo
    await db.collection('preventivi').doc(prevId).update({
      stato: 'inviato',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const pLocal = preventivi.find(x => x.id === prevId);
    if (pLocal) pLocal.stato = 'inviato';

    if (status) {
      status.style.background = '#EBF8F1';
      status.style.color = 'var(--success)';
      status.textContent = '✅ Email inviata con successo! Stato aggiornato a "Inviato".';
    }
    if (btn) { btn.textContent = '✅ Inviata!'; btn.style.background = 'var(--success)'; }
    toast('Email inviata con PDF allegato!', 'success');
    setTimeout(() => { closeModal(); renderPreventivi(); }, 1800);

  } catch(e) {
    console.error('Errore invio email:', e);
    if (status) {
      status.style.display = 'block';
      status.style.background = '#FDEDED';
      status.style.color = 'var(--danger)';
      status.textContent = '❌ Errore: ' + e.message;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Riprova'; }
    toast('Errore invio: ' + e.message, 'error');
  }
}