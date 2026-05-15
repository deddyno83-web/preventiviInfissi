import { jsPDF } from 'jspdf';
import { db, firebase } from '../services/firebase';

// ─── COSTANTI GMAIL ──────────────────────────────────────────────────────────
export const GMAIL_CLIENT_ID = '53831286391-nu07c6u4acdch8qnso6n9ql842q5b1gf.apps.googleusercontent.com';
export const GMAIL_SENDER = 'simeoliinfissi@gmail.com';
let _gmailToken = null;
let _gmailTokenExpiry = 0;

// ─── BOZZE LOCALI ────────────────────────────────────────────────────────────
const BOZZE_KEY = 'infissipro_bozze_v1';

export function salvaBozzaLocale(id, data) {
  try {
    const bozze = JSON.parse(localStorage.getItem(BOZZE_KEY) || '{}');
    const chiave = id || ('new_' + Date.now());
    bozze[chiave] = { id, data, ts: Date.now(), _chiave: chiave };
    localStorage.setItem(BOZZE_KEY, JSON.stringify(bozze));
    return chiave;
  } catch (e) { console.warn('Impossibile salvare bozza locale:', e); return null; }
}

export function rimuoviBozzaLocale(chiave) {
  try {
    const bozze = JSON.parse(localStorage.getItem(BOZZE_KEY) || '{}');
    delete bozze[chiave];
    localStorage.setItem(BOZZE_KEY, JSON.stringify(bozze));
  } catch (e) { }
}

export function getBozzeLocali() {
  try {
    return Object.values(JSON.parse(localStorage.getItem(BOZZE_KEY) || '{}'));
  } catch (e) { return []; }
}

export async function sincronizzaBozzeInSospeso(onDone) {
  const bozze = getBozzeLocali();
  if (!bozze.length) return 0;
  let sincronizzate = 0;
  for (const bozza of bozze) {
    try {
      const d = { ...bozza.data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (bozza.id) {
        await db.collection('preventivi').doc(bozza.id).update(d);
      } else {
        const lastSnap = await db.collection('preventivi').orderBy('numero', 'desc').limit(1).get();
        const lastNum = lastSnap.empty ? 0 : parseInt(lastSnap.docs[0].data().numero || '0');
        d.numero = String(lastNum + 1).padStart(4, '0');
        d.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('preventivi').add(d);
      }
      rimuoviBozzaLocale(bozza._chiave);
      sincronizzate++;
    } catch (e) { /* lascia la bozza per dopo */ }
  }
  if (sincronizzate > 0 && onDone) onDone(sincronizzate);
  return sincronizzate;
}

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0); }
function fmtDate(ts) {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleDateString('it-IT');
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('it-IT');
}

// ─── PDF GENERATION ──────────────────────────────────────────────────────────
export async function generatePDF(preventivoInput, outputMode = 'save') {
  try {
    let prev, companyData, prodotti = [], cl = {};

    if (typeof preventivoInput === 'string') {
      const [pSnap, companySnap] = await Promise.all([
        db.collection('preventivi').doc(preventivoInput).get(),
        db.collection('settings').doc('company').get(),
      ]);
      if (!pSnap.exists) { alert('Preventivo non trovato'); return null; }
      prev = { id: preventivoInput, ...pSnap.data() };
      companyData = companySnap.exists ? companySnap.data() : {};
    } else {
      prev = preventivoInput;
      const companySnap = await db.collection('settings').doc('company').get();
      companyData = companySnap.exists ? companySnap.data() : {};
    }

    // Legge solo il cliente specifico e solo i prodotti usati (senza foto propria)
    const prodottoIds = [...new Set(
      (prev.items || []).filter(it => !it.foto && it.prodottoId).map(it => it.prodottoId)
    )];
    const reads = [
      prev.clienteId ? db.collection('clienti').doc(prev.clienteId).get() : Promise.resolve(null),
      ...prodottoIds.map(id => db.collection('prodotti').doc(id).get())
    ];
    const results = await Promise.all(reads);
    cl = results[0]?.exists ? results[0].data() : {};
    prodotti = results.slice(1).map((snap, i) => snap?.exists ? { id: prodottoIds[i], ...snap.data() } : null).filter(Boolean);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 15, pageH = 297;
    const contentBottom = pageH - 22;
    let y = M;
    let pageNum = 1;

    const numStr = prev.numeroPrefisso
      ? `${prev.numeroPrefisso}/${prev.numero}`
      : (prev.numero || (prev.id || '').slice(-6).toUpperCase());

    function drawFooter() {
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
      doc.line(M, pageH - 16, W - M, pageH - 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 100);
      const fp = [companyData.nome, companyData.indirizzo, companyData.telefono].filter(Boolean).join(' – ');
      doc.text(fp, M, pageH - 10);
      doc.text(`Pag. ${pageNum}`, W - M, pageH - 10, { align: 'right' });
    }

    function newPage() {
      drawFooter();
      doc.addPage();
      pageNum++;
      y = M;
      // mini header pagine 2+
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 80);
      doc.text(companyData.nome || '', M, y + 5);
      doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 100);
      doc.text(`Preventivo N° ${numStr}`, W - M, y + 5, { align: 'right' });
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
      doc.line(M, y + 8, W - M, y + 8);
      y += 15;
    }

    // ── HEADER PAGINA 1 ─────────────────────────────────────────────────────
    // Logo (sinistra)
    if (companyData.logoBase64) {
      try {
        const ext = companyData.logoBase64.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(companyData.logoBase64, ext, M, y, 36, 36, '', 'FAST');
      } catch (e) { /* logo fallback sotto */ }
    }

    // Dati azienda (destra del logo)
    const hx = M + 42;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text(companyData.nome || '', hx, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    let hy = y + 13;
    if (companyData.indirizzo) { doc.text(companyData.indirizzo, hx, hy); hy += 5; }
    if (companyData.telefono)  { doc.text(`Tel. ${companyData.telefono}`, hx, hy); hy += 5; }
    if (companyData.piva)      { doc.text(`P. iva ${companyData.piva}`, hx, hy); hy += 5; }
    if (companyData.email)     { doc.text(companyData.email, hx, hy); hy += 5; }
    if (companyData.sito)      { doc.text(companyData.sito, hx, hy); }

    y = M + 40;

    // Linea separatrice
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 8;

    // Numero preventivo + data  |  validità (destra)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text(`Preventivo n° ${numStr} del ${fmtDate(prev.createdAt)}`, M, y);
    if (prev.validoFino) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(160, 120, 40);
      doc.text(`Validità offerta: fino al ${fmtDate(prev.validoFino)}`, W - M, y, { align: 'right' });
    }
    y += 7;

    // Info cliente
    const clName = cl.azienda || `${cl.cognome || ''} ${cl.nome || ''}`.trim();
    const clCell = cl.telefono ? ` – cell. ${cl.telefono}` : '';
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    doc.text(`Cliente: ${clName}${clCell}`, M, y);
    y += 5;
    const clAddr = [cl.indirizzo, cl.citta].filter(Boolean).join(', ');
    if (clAddr) { doc.text(clAddr, M, y); y += 5; }
    y += 4;

    // Testo introduttivo
    if (prev.note) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
      const nl = doc.splitTextToSize(prev.note, W - 2 * M);
      doc.text(nl, M, y); y += nl.length * 5 + 4;
    }

    // ── TABELLA ─────────────────────────────────────────────────────────────
    const colPos  = M;       // larghezza 10
    const colStr  = M + 10;  // larghezza 46 (immagine + misure)
    const colDesc = M + 56;  // larghezza ~100
    const colTot  = W - M;   // bordo destro
    const tableW  = W - 2 * M;

    // Header tabella
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.4);
    doc.rect(M, y, tableW, 7, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
    doc.text('Pos.', colPos + 2, y + 5);
    doc.text('Struttura', colStr + 2, y + 5);
    doc.text('Descrizione', colDesc + 2, y + 5);
    doc.text('Totale', colTot, y + 5, { align: 'right' });
    y += 7;

    function getDimQty(it) {
      if (it.um === 'mq') {
        if (it.mqManuale > 0) return parseFloat(it.mqManuale);
        const lm = (parseInt(it.larghezza) || 0) / 1000;
        const am = (parseInt(it.altezza) || 0) / 1000;
        return Math.ceil(lm * am * 2) / 2;
      }
      if (it.um === 'ml') return (parseInt(it.larghezza) || 0) / 1000;
      return it.qty || 1;
    }

    (prev.items || []).forEach((it, idx) => {
      const um = it.um || 'pz';
      const lMm = parseInt(it.larghezza) || 0;
      const aMm = parseInt(it.altezza) || 0;
      let dimStr = '', superfStr = '';

      if (um === 'mq') {
        const mqVal = it.mqManuale > 0 ? it.mqManuale : Math.ceil((lMm/1000)*(aMm/1000)*2)/2;
        dimStr = `L ${lMm} x h${aMm} mm.`;
        superfStr = `mq ${mqVal.toFixed(2)} x ${(it.prezzo||0).toFixed(2).replace('.',',')} €/mq`;
      } else if (um === 'ml') {
        dimStr = `${lMm} mm`;
      }

      const qDim = getDimQty(it);
      const lineTotal = parseFloat(((it.prezzo || 0) * qDim * (it.qty || 1)).toFixed(2));

      // Righe descrizione
      const descLines = [];
      if (it.descrizioneRiga) descLines.push(it.descrizioneRiga);
      if (dimStr) descLines.push(`Misure: ${dimStr}`);
      if (superfStr) descLines.push(superfStr);
      if (it.coloreProfili) { descLines.push('Colore struttura:'); descLines.push(it.coloreProfili); }
      if (it.coloreAccessori) descLines.push(`Colore accessori: ${it.coloreAccessori}`);
      if (it.altezzaManiglia) descLines.push(`Alt. maniglia: ${it.altezzaManiglia} mm`);
      if (it.tamponamento) doc.splitTextToSize(it.tamponamento, 95).forEach(t => descLines.push(t));

      const imgH = 36;
      const strutH = imgH + (lMm || aMm ? 14 : 2);
      const nomeW = doc.splitTextToSize(it.nome || '', 95).length;
      const descH = nomeW * 5 + descLines.length * 4.5 + 10;
      const rowH = Math.max(strutH, descH) + 8;

      if (y + rowH > contentBottom) newPage();

      // Sfondo riga
      doc.setFillColor(idx % 2 === 0 ? 255 : 252, idx % 2 === 0 ? 255 : 252, idx % 2 === 0 ? 255 : 250);
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.25);
      doc.rect(M, y, tableW, rowH, 'FD');

      // Pos
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
      doc.text(String(idx + 1), colPos + 5, y + rowH / 2 + 1.5, { align: 'center' });

      // Immagine struttura
      const imgX = colStr + 3, imgY = y + 3, imgW = 38;
      const fotoSrc = it.foto || prodotti.find(p => p.id === it.prodottoId)?.foto || null;
      if (fotoSrc) {
        try {
          const ext2 = fotoSrc.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(fotoSrc, ext2, imgX, imgY, imgW, imgH, '', 'FAST');
        } catch(e) {
          doc.setDrawColor(200,200,200); doc.rect(imgX, imgY, imgW, imgH, 'S');
        }
      } else {
        doc.setDrawColor(200,200,200); doc.rect(imgX, imgY, imgW, imgH, 'S');
      }
      // Misure sotto immagine
      if (lMm || aMm) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(40, 40, 40);
        if (lMm) doc.text(`Larghezza: ${lMm} mm`, imgX, imgY + imgH + 5);
        if (aMm) doc.text(`Altezza: ${aMm} mm`, imgX, imgY + imgH + 10);
      }

      // Descrizione
      let dy = y + 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
      const nomeLines = doc.splitTextToSize(it.nome || '', 95);
      nomeLines.forEach(nl => { doc.text(nl, colDesc + 2, dy); dy += 5; });

      // Q.ta destra
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 80);
      doc.text(`Q.ta ${it.qty || 1}`, colTot - 1, y + 5, { align: 'right' });

      dy += 1;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(50, 50, 50);
      descLines.forEach(dl => { doc.text(dl, colDesc + 2, dy); dy += 4.5; });

      // Totale riga
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
      doc.text(fmt(lineTotal), colTot, y + rowH / 2 + 3, { align: 'right' });

      y += rowH;
    });

    // ── SEZIONE FINALE (totale + condizioni + firma) ─────────────────────────
    const subT = prev.subtotale || 0;
    const sAmt = prev.scontoAmt || 0;
    const imp  = prev.imponibile || (subT - sAmt);
    const ivaP = prev.ivaPerc || companyData.iva || 22;
    const ivaAmt = prev.ivaEsclusa ? 0 : (imp * ivaP / 100);
    const totFinale = prev.totaleFinale || (imp + ivaAmt);

    // Stima spazio necessario per la sezione finale
    const needsNewPage = y + 90 > contentBottom;
    if (needsNewPage) newPage();
    else y += 8;

    // BOX TOTALE (destra)
    const totBoxX = W - M - 65;
    const totBoxLabelX = totBoxX + 2;
    const totBoxValX   = W - M - 1;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    let ty = y;

    doc.text('Subtotale:', totBoxLabelX, ty);
    doc.text(fmt(subT), totBoxValX, ty, { align: 'right' });
    ty += 6;

    if (sAmt > 0) {
      doc.setTextColor(39, 130, 80);
      const sLab = prev.scontoTipo === 'perc' ? `Sconto ${prev.scontoValore}%:` : 'Sconto:';
      doc.text(sLab, totBoxLabelX, ty);
      doc.text(`- ${fmt(sAmt)}`, totBoxValX, ty, { align: 'right' });
      ty += 6; doc.setTextColor(60, 60, 60);
    }

    doc.text('Imponibile:', totBoxLabelX, ty);
    doc.text(fmt(imp), totBoxValX, ty, { align: 'right' });
    ty += 6;

    doc.text(`IVA ${ivaP}%:`, totBoxLabelX, ty);
    doc.text(fmt(ivaAmt), totBoxValX, ty, { align: 'right' });
    ty += 8;

    // Riga TOTALE scura
    const totRowH = 10;
    doc.setFillColor(45, 43, 39);
    doc.rect(totBoxX, ty - 5, W - M - totBoxX, totRowH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text('TOTALE', totBoxLabelX + 2, ty + 2);
    doc.text(fmt(totFinale), totBoxValX, ty + 2, { align: 'right' });
    ty += totRowH + 4;

    // CONDIZIONI (sinistra, parte con y iniziale)
    let leftY = y;

    if (companyData.note) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
      doc.text('Condizioni:', M, leftY);
      leftY += 5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      const cLines = doc.splitTextToSize(companyData.note, W - 2 * M);
      doc.text(cLines, M, leftY);
      leftY += cLines.length * 4.5 + 6;
    }

    // Riga di separazione full-width
    const sepY = Math.max(ty + 4, leftY);
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
    doc.line(M, sepY, W - M, sepY);
    leftY = sepY + 6;

    if (prev.tempiConsegna) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
      doc.text('Tempi di Consegna:', M, leftY);
      leftY += 5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      const tLines = doc.splitTextToSize(prev.tempiConsegna, W - 2 * M);
      doc.text(tLines, M, leftY);
      leftY += tLines.length * 4.5 + 5;
    }

    if (prev.pagamenti) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
      doc.text('Pagamenti:', M, leftY);
      leftY += 5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      const pLines = doc.splitTextToSize(prev.pagamenti, W - 2 * M);
      doc.text(pLines, M, leftY);
      leftY += pLines.length * 4.5 + 8;
    }

    // Sezione firma
    if (leftY + 35 > contentBottom) newPage();
    else leftY += 4;

    const midX = W / 2 + 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
    doc.text("Firma dell'impresa", M, leftY);
    doc.text('Firma del committente', midX, leftY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    doc.text('per accettazione', midX, leftY + 5);

    const sigY = leftY + 22;
    doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.5);
    doc.line(M, sigY, M + 68, sigY);
    doc.line(midX, sigY, midX + 68, sigY);

    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
    doc.text(companyData.nome || '', M, sigY + 5);
    const clSigName = cl.azienda || `${cl.cognome || ''} ${cl.nome || ''}`.trim();
    doc.text(clSigName, midX, sigY + 5);

    // Footer ultima pagina + aggiorna numeri pagina
    drawFooter();
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 100);
      doc.setFillColor(255, 255, 255);
      doc.rect(W - M - 18, pageH - 14, 20, 8, 'F');
      doc.text(`Pag. ${i}/${totalPages}`, W - M, pageH - 10, { align: 'right' });
    }

    const prevId = prev.id || (typeof preventivoInput === 'string' ? preventivoInput : 'pdf');
    if (outputMode === 'base64') {
      return doc.output('datauristring');
    } else {
      doc.save(`Preventivo_${prev.numeroPrefisso || ''}_${prev.numero || prevId.slice(-6).toUpperCase()}.pdf`);
      return null;
    }

  } catch (err) {
    console.error('PDF Error:', err);
    alert('Errore durante la generazione del PDF: ' + err.message);
    return null;
  }
}

// ─── WHATSAPP ────────────────────────────────────────────────────────────────
export async function sendWhatsApp(preventivoId) {
  try {
    const [pSnap, companySnap] = await Promise.all([
      db.collection('preventivi').doc(preventivoId).get(),
      db.collection('settings').doc('company').get(),
    ]);

    if (!pSnap.exists) { alert('Preventivo non trovato'); return; }
    const prev = pSnap.data();
    const companyData = companySnap.exists ? companySnap.data() : {};

    const clSnap = prev.clienteId ? await db.collection('clienti').doc(prev.clienteId).get() : null;
    const cl = clSnap?.exists ? clSnap.data() : {};

    const num = prev.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero}` : `#${prev.numero || preventivoId.slice(-4)}`;
    const tel = (cl?.telefono || '').replace(/\s+/g, '').replace(/^00/, '+').replace(/^0/, '+39');

    const msg = encodeURIComponent(
      `Gentile ${cl?.cognome || 'Cliente'}, le inviamo il preventivo ${num} per la fornitura di infissi.\n\nTotale: *${fmt(prev?.totaleFinale)}*${prev?.validoFino ? '\nValido fino al: ' + new Date(prev.validoFino).toLocaleDateString('it-IT') : ''}\n\nPer info: ${companyData.telefono || ''} — ${companyData.nome || ''}`
    );

    const url = tel ? `https://wa.me/${tel.replace('+', '')}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  } catch (err) {
    console.error('WhatsApp Error:', err);
    alert('Errore: ' + err.message);
  }
}

// ─── GMAIL TOKEN ─────────────────────────────────────────────────────────────
export async function getGmailToken() {
  if (_gmailToken && Date.now() < _gmailTokenExpiry) return _gmailToken;

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Libreria Google Identity Services non caricata. Ricarica la pagina.'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
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

// ─── MIME MESSAGE ─────────────────────────────────────────────────────────────
export function buildMimeMessage(to, subject, bodyText, pdfBase64, filename) {
  const boundary = 'InfissiPro_' + Date.now();
  const pdfB64Pure = pdfBase64.split(',').pop().replace(/\s/g, '');
  const pdfLines = pdfB64Pure.match(/.{1,76}/g) || [];
  const subjectB64 = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';
  const bodyB64 = btoa(unescape(encodeURIComponent(bodyText)));

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

  const mimeStr = lines.join('\r\n');
  return btoa(mimeStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── SEND EMAIL (Gmail API con PDF allegato) ─────────────────────────────────
export async function sendEmail(preventivoId, onStatusChange) {
  try {
    const [pSnap, companySnap] = await Promise.all([
      db.collection('preventivi').doc(preventivoId).get(),
      db.collection('settings').doc('company').get(),
    ]);

    if (!pSnap.exists) { alert('Preventivo non trovato'); return null; }
    const prev = pSnap.data();
    const companyData = companySnap.exists ? companySnap.data() : {};

    const clSnap = prev.clienteId ? await db.collection('clienti').doc(prev.clienteId).get() : null;
    const cl = clSnap?.exists ? clSnap.data() : {};

    const toEmail = cl?.email || '';
    const numPDF = prev.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero}` : `#${prev.numero || preventivoId.slice(-4)}`;

    return {
      toEmail,
      numPDF,
      prev,
      cl,
      companyData,
      defaultBody: buildEmailBody(prev, cl, numPDF, companyData)
    };
  } catch (err) {
    console.error('Email Error:', err);
    alert('Errore: ' + err.message);
    return null;
  }
}

export function buildEmailBody(prev, cl, numPDF, companyData) {
  const nomeCliente = cl ? `${cl.cognome} ${cl.nome}` : prev.clienteNome || 'Cliente';
  const validita = prev.validoFino ? `\nValidità offerta: ${new Date(prev.validoFino).toLocaleDateString('it-IT')}` : '';
  return `Gentile ${nomeCliente},\n\nin allegato troverà il preventivo ${numPDF} relativo alla fornitura e installazione infissi.\n\nTotale preventivo: ${fmt(prev.totaleFinale)}${validita}\n\nPer qualsiasi informazione non esiti a contattarci.\n\nCordiali saluti,\n${companyData?.nome || ''}\n${companyData?.telefono ? 'Tel. ' + companyData.telefono : ''}\n${companyData?.email || ''}`.trim();
}

export async function eseguiInvioEmail(preventivoId, toEmail, bodyText, onStatus, prevData = null, companyData = null) {
  try {
    onStatus?.('auth', '🔐 Autorizzazione Gmail in corso...');

    const token = await getGmailToken();

    onStatus?.('pdf', '📄 Generazione PDF in corso...');

    const pdfB64 = await generatePDF(prevData || preventivoId, 'base64');
    if (!pdfB64) throw new Error('Generazione PDF fallita');

    onStatus?.('sending', '📤 Invio email con PDF allegato...');

    // Usa i dati già caricati se disponibili, altrimenti rilegge
    let prev = prevData;
    let company = companyData;
    if (!prev) {
      const pSnap = await db.collection('preventivi').doc(preventivoId).get();
      prev = pSnap.data();
    }
    if (!company) {
      const cSnap = await db.collection('settings').doc('company').get();
      company = cSnap.exists ? cSnap.data() : {};
    }

    const numPDF = prev.numeroPrefisso ? `${prev.numeroPrefisso}/${prev.numero}` : prev.numero || preventivoId.slice(-4);
    const subject = `Preventivo ${numPDF} – ${company.nome || 'InfissiPro'}`;
    const filename = `Preventivo_${prev.numero || preventivoId.slice(-4)}.pdf`;

    const mimeMsg = buildMimeMessage(toEmail, subject, bodyText, pdfB64, filename);

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

    await db.collection('preventivi').doc(preventivoId).update({
      stato: 'inviato',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    onStatus?.('done', '✅ Email inviata con successo! Stato aggiornato a "Inviato".');
    return true;

  } catch (e) {
    onStatus?.('error', '❌ Errore: ' + e.message);
    throw e;
  }
}
