const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function backup() {
  const collections = ['preventivi', 'clienti', 'prodotti', 'settings'];
  const data = {};

  for (const col of collections) {
    const snap = await db.collection(col).get();
    data[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
