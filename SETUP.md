# 🔧 InfissiPro — Guida alla Configurazione

## Cos'è questa app
Un'app web completa per la gestione dei preventivi di infissi, con:
- Login con Google (solo Gmail autorizzate)
- Catalogo prodotti
- Anagrafica clienti
- Creazione e archivio preventivi
- Generazione PDF professionale con logo
- Apertura email pre-compilata

---

## STEP 1 — Crea il progetto Firebase (gratuito)

1. Vai su https://console.firebase.google.com
2. Clicca **"Aggiungi progetto"**
3. Nome: `infissipro` (o come preferisci)
4. Disabilita Google Analytics (non serve) → **Crea progetto**

---

## STEP 2 — Abilita l'autenticazione Google

1. Nel menu sinistro → **Authentication** → **Inizia**
2. Tab **Sign-in method** → Abilita **Google** → Salva
3. (Facoltativo) Tab **Users** → puoi vedere chi si logga

---

## STEP 3 — Crea il database Firestore

1. Menu sinistro → **Firestore Database** → **Crea database**
2. Scegli **"Modalità di produzione"**
3. Regione: `europe-west6` (Svizzera, la più vicina all'Italia)
4. Una volta creato, vai su **Regole** e incolla:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Questo permette l'accesso solo agli utenti loggati con Google.

Se vuoi limitare a 2 email specifiche, usa questa regola:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth.token.email in [
        'tuaemail@gmail.com',
        'altremail@gmail.com'
      ];
    }
  }
}
```

---

## STEP 4 — Ottieni le credenziali Firebase

1. Ingranaggio ⚙️ → **Impostazioni progetto**
2. Scorri in basso → **Le tue app** → clicca **</>** (Web app)
3. Nome app: `InfissiPro Web` → Registra
4. Copia il blocco `firebaseConfig` che appare:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "infissipro.firebaseapp.com",
  projectId: "infissipro",
  storageBucket: "infissipro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## STEP 5 — Aggiorna il file index.html

Apri `index.html` e cerca questa sezione (circa riga 380):

```javascript
// ════════════════════════════════════════════
//  FIREBASE CONFIG — sostituisci con i tuoi dati
// ════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  ...
```

Sostituisci tutti i valori `YOUR_*` con i tuoi dati reali copiati al paso precedente.

---

## STEP 6 — Aggiungi email autorizzate (opzionale ma consigliato)

Nello stesso file, cerca:
```javascript
const ALLOWED_EMAILS = [];
```

Inserisci le email dei 2 utenti autorizzati:
```javascript
const ALLOWED_EMAILS = ['email1@gmail.com', 'email2@gmail.com'];
```

---

## STEP 7 — Deploy su Firebase Hosting (gratuito)

### Metodo A — Senza installare nulla (più semplice)

1. Vai su https://console.firebase.google.com → **Hosting** → **Inizia**
2. Installa Firebase CLI:
   ```
   npm install -g firebase-tools
   ```
3. Nella cartella del progetto:
   ```bash
   firebase login
   firebase init hosting
   # Seleziona il tuo progetto
   # Public directory: . (punto)
   # Single page app: No
   # GitHub deploys: No
   firebase deploy
   ```
4. Al termine riceverai un URL tipo: `https://infissipro.web.app`

### Metodo B — Upload manuale

1. Hosting → **Aggiungi un sito personalizzato**
2. Trascina il file `index.html` nell'area di upload

---

## STEP 8 — Configurazione iniziale nell'app

1. Accedi con il tuo Google
2. Vai su **Impostazioni** (menu sinistro)
3. Inserisci i dati aziendali (nome, P.IVA, indirizzo, ecc.)
4. Carica il logo aziendale (PNG trasparente consigliato)
5. Imposta l'aliquota IVA predefinita
6. Clicca **Salva Impostazioni**

---

## Struttura del database (Firestore)

```
firestore/
├── settings/
│   └── company         ← dati azienda + logo base64
├── prodotti/
│   └── {prodottoId}    ← nome, categoria, prezzo, ...
├── clienti/
│   └── {clienteId}     ← cognome, nome, email, ...
└── preventivi/
    └── {preventivoId}  ← items, totale, stato, ...
```

---

## Funzionalità incluse

| Funzione | Descrizione |
|---|---|
| 🔐 Login Google | Solo utenti Gmail autorizzati |
| 📦 Catalogo prodotti | Aggiungi/modifica/elimina prodotti con categorie |
| 👥 Clienti | Anagrafica con tutti i campi utili |
| 📋 Preventivi | Editor con selezione prodotti, quantità, note per riga |
| 💰 Calcolo automatico | Subtotale + IVA configurabile + Totale |
| 📄 PDF professionale | Con logo, intestazione azienda/cliente, tabella prodotti |
| 📧 Email pre-compilata | Apre Gmail/Outlook con oggetto e corpo già scritti |
| 📊 Dashboard | Statistiche mensili, ultimi preventivi, azioni rapide |
| 🔍 Ricerca e filtri | Per tutti gli archivi |
| 📱 Mobile responsive | Bottom navigation + layout ottimizzato |

---

## Costi

| Servizio | Piano gratuito |
|---|---|
| Firebase Auth | Illimitato |
| Firestore | 1 GB storage, 50K letture/giorno |
| Firebase Hosting | 10 GB/mese di transfer |
| **Totale** | **€0/mese** |

Per una piccola attività (2 utenti, centinaia di preventivi) il piano gratuito è ampiamente sufficiente.

---

## Supporto

Per aggiornare l'app, modificare il file `index.html` e ripetere `firebase deploy`.
