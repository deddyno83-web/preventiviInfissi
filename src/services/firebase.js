import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDK2qpsavt2oDKD8T8MxeLz-hXRhAtL-Pc",
  authDomain: "infissipro-747ac.firebaseapp.com",
  projectId: "infissipro-747ac",
  storageBucket: "infissipro-747ac.firebasestorage.app",
  messagingSenderId: "53831286391",
  appId: "1:53831286391:web:d12b78cc0cb50b37b59072",
  measurementId: "G-E100WWF3JQ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

export { auth, db, storage, firebase };
