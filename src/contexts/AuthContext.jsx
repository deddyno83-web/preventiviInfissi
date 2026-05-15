import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, firebase } from '../services/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const ADMIN_EMAIL = 'deddyno83@gmail.com';
const ALLOWED_EMAILS = ['deddyno83@gmail.com','gennarosimeoli1@gmail.com','lglsimeoli@gmail.com','simeoliinfissi@gmail.com'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState({
    storicoClienti:  true,
    firmaDigitale:   false,
    whatsapp:        false,
    notifiche:       false,
  });

  function signInGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider).catch(e => alert(e.message));
  }

  function signOut() {
    if(window.confirm('Sei sicuro di voler uscire?')) {
      return auth.signOut();
    }
  }

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
          auth.signOut();
          alert('Accesso non autorizzato per questo account.');
          setCurrentUser(null);
        } else {
          setCurrentUser(user);
          try {
            const doc = await db.collection('settings').doc('features').get();
            if (doc.exists) {
              setFeatures(prev => ({ ...prev, ...doc.data() }));
            }
          } catch(e) { 
            console.warn('loadFeatures error', e); 
          }
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    features,
    setFeatures,
    signInGoogle,
    signOut,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
