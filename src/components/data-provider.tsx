'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Klient, Zaznam } from "@/app/lib/types";
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  User,
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
  uroven?: 'full' | 'basic';   // basic = jednorázový klient
  klientId?: string;
}

interface DataContextType {
  klienti: Klient[];
  zaznamy: Zaznam[];
  user: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  logout: () => Promise<void>;
  setZaznamy: React.Dispatch<React.SetStateAction<Zaznam[]>>;
  setKlienti: React.Dispatch<React.SetStateAction<Klient[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [klienti, setKlientiState] = useState<Klient[]>([]);
  const [zaznamy, setZaznamyState] = useState<Zaznam[]>([]);

  // 1. Sledování přihlášení + načtení profilu (role, klientId)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'uzivatele', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            // Profil zakládá výhradně admin serverově (Admin SDK).
            // Klient bez profilu nedostane žádná data – to je záměr.
            console.warn('Uživatel nemá profil v kolekci "uzivatele". Přiřaďte roli/klientId serverově.');
            setUserProfile(null);
          }
        } catch (e) {
          console.error('Nepodařilo se načíst profil uživatele:', e);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Načítání klientů – admin vidí vše, klient jen svou firmu (cílený dotaz)
  useEffect(() => {
    if (!user || !userProfile) {
      setKlientiState([]);
      return;
    }

    if (userProfile.role === 'client' && !userProfile.klientId) {
      setKlientiState([]);
      return;
    }

    const klientiRef = collection(db, 'klienti');
    const q =
      userProfile.role === 'admin'
        ? klientiRef
        : query(klientiRef, where('__name__', '==', userProfile.klientId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Klient);
        setKlientiState(docs);
      },
      (error) => {
        console.error('Chyba načítání klientů:', error);
        setKlientiState([]);
      }
    );

    return () => unsubscribe();
  }, [user, userProfile]);

  // 3. Načítání záznamů – admin vše, klient jen záznamy své firmy (cílený dotaz)
  useEffect(() => {
    if (!user || !userProfile) {
      setZaznamyState([]);
      return;
    }

    if (userProfile.role === 'client' && !userProfile.klientId) {
      setZaznamyState([]);
      return;
    }

    const zaznamyRef = collection(db, 'zaznamy');
    const q =
      userProfile.role === 'admin'
        ? zaznamyRef
        : query(zaznamyRef, where('klientId', '==', userProfile.klientId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Zaznam);
        setZaznamyState(docs);
      },
      (error) => {
        console.error('Chyba načítání záznamů:', error);
        setZaznamyState([]);
      }
    );

    return () => unsubscribe();
  }, [user, userProfile]);

  const logout = async () => {
    await signOut(auth);
  };

  // Zápis záznamů do Firestore. Zápis smí provést pouze admin (viz Firestore Rules).
  // Ukládají se jen skutečně změněné záznamy, sériově, s odchycením chyb.
  const setZaznamy: React.Dispatch<React.SetStateAction<Zaznam[]>> = (value) => {
    setZaznamyState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;

      // Side-effect (zápis do DB) řešíme mimo synchronní tělo setState,
      // aby se ve Strict Mode nespouštěl dvakrát.
      const changed = next.filter((record: any) => {
        if (!record.id) return false;
        const existing = prev.find((p) => p.id === record.id);
        return !existing || JSON.stringify(existing) !== JSON.stringify(record);
      });

      if (changed.length > 0) {
        (async () => {
          for (const record of changed) {
            try {
              await setDoc(doc(db, 'zaznamy', record.id), record);
            } catch (e) {
              console.error('Chyba zápisu záznamu do Firebase:', record.id, e);
            }
          }
        })();
      }

      return next;
    });
  };

  return (
    <DataContext.Provider
      value={{
        klienti,
        zaznamy,
        user,
        userProfile,
        authLoading,
        logout,
        setZaznamy,
        setKlienti: setKlientiState,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData musí být použit uvnitř DataProvideru');
  }
  return context;
}
