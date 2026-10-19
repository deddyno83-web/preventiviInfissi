const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Serializza i Timestamp come { type, seconds, nanoseconds }: stesso formato
// dell'export dall'app, che il ripristino in Impostazioni sa rileggere.
function serializza(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof admin.firestore.Timestamp) {
    return { type: 'firestore/timestamp/1.0', seconds: val.seconds, nanoseconds: val.nanoseconds };
  }
  if (Array.isArray(val)) return val.map(serializza);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = serializza(v);
    return out;
  }
  return val;
}

// Legge una collection con retry in caso di quota temporanea
async function getCollection(col, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const snap = await db.collection(col).get();
      return snap.docs.map(doc => ({ id: doc.id, ...serializza(doc.data()) }));
    } catch (err) {
      if (err.code === 8 && i < retries - 1) {
        // RESOURCE_EXHAUSTED — aspetta 60 secondi e riprova
        console.warn(`  ⚠️  Quota ${col}: attendo 60s e riprovo (tentativo ${i + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, 60000));
      } else {
        throw err;
      }
    }
  }
}

async function backup() {
  const collections = ['preventivi', 'clienti', 'prodotti', 'settings'];
  const data = {};

  for (const col of collections) {
    data[col] = await getCollection(col);
    console.log(`  ${col}: ${data[col].length} documenti`);
  }

  const date = new Date().toISOString().split('T')[0];
  const dir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Mantieni solo gli ultimi 30 backup
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  while (files.length >= 30) {
    fs.unlinkSync(path.join(dir, files.shift()));
  }

  const filename = `backup_${date}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2));
  console.log(`✅ Backup completato: ${filename}`);
}

backup().catch(err => { console.error('❌ Errore:', err); process.exit(1); });
