'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ",
  authDomain: "studio-2327834732-8ec09.firebaseapp.com",
  projectId: "studio-2327834732-8ec09",
  storageBucket: "studio-2327834732-8ec09.firebasestorage.app",
  messagingSenderId: "60078641715",
  appId: "1:60078641715:web:1ed05728df58a0272c4946"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

interface UserProfile {
  role: 'admin' | 'client';
  klientId?: string;
}

interface DataContextType {
  klienti: any[];
  zaznamy: any[];
  user: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  logout: () => Promise<void>;
  setZaznamy: React.Dispatch<React.SetStateAction<any[]>>;
  setKlienti: React.Dispatch<React.SetStateAction<any[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [klienti, setKlientiState] = useState<any[]>([]);
  const [zaznamy, setZaznamyState] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userDocRef = doc(db, 'uzivatele', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          const defaultClientProfile: UserProfile = { role: 'client' };
          await setDoc(userDocRef, defaultClientProfile);
          setUserProfile(defaultClientProfile);
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Načítání klientů (Admin vidí vše, klient vidí JEN svou firmu)
  useEffect(() => {
    if (!user || !userProfile) {
      setKlientiState([]);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'klienti'), (snapshot) => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Bezpečnostní filtr pro klienta
      if (userProfile.role === 'client') {
        docs = docs.filter(k => k.id === userProfile.klientId);
      }
      
      if (docs.length === 0 && userProfile.role === 'admin') {
        const defaultClients = [
          {
            id: "kovarna-novak",
            nazev: "Kovárna Novák s.r.o.",
            ico: "24681357",
            pracoviste: [
              { id: "p1", text: "Provozovna Hlavní", nazev: "Kovárna - hlavní dílna", adresa: "Průmyslová 12, Ostravská hala" },
              { id: "p2", text: "Sklad", nazev: "Sklad materiálu", adresa: "Průmyslová 14, Ostrava" }
            ],
            odpovedneOsoby: [
              { jmeno: "Josef Novák", pozice: "Vedoucí provozu" },
              { jmeno: "Jan Kovář", pozice: "Mistr směny" }
            ]
          }
        ];
        defaultClients.forEach(async (c) => {
          await setDoc(doc(db, 'klienti', c.id), c);
        });
      } else {
        setKlientiState(docs);
      }
    });
    return () => unsubscribe();
  }, [user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) {
      setZaznamyState([]);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'zaznamy'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (userProfile.role === 'admin') {
        setZaznamyState(docs);
      } else {
        if (!userProfile.klientId) {
            setZaznamyState([]);
        } else {
            const klientskeZaznamy = docs.filter(z => z.klientId === userProfile.klientId);
            setZaznamyState(klientskeZaznamy);
        }
      }
    });
    return () => unsubscribe();
  }, [user, userProfile]);

  const logout = async () => {
    await signOut(auth);
  };

  const setZaznamy: React.Dispatch<React.SetStateAction<any[]>> = (value) => {
    setZaznamyState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      
      next.forEach(async (record: any) => {
        if (!record.id) return;
        const existing = prev.find(p => p.id === record.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(record)) {
          try {
            await setDoc(doc(db, 'zaznamy', record.id), record);
          } catch (e) {
            console.error("Chyba zápisu do Firebase:", e);
          }
        }
      });
      
      return next;
    });
  };

  return (
    <DataContext.Provider value={{ klienti, zaznamy, user, userProfile, authLoading, logout, setZaznamy, setKlienti: setKlientiState }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) { throw new Error('useData musí být použit uvnitř DataProvideru'); }
  return context;
}
