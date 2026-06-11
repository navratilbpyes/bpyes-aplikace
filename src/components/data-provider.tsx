'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

// Vaše konfigurace z Google Firebase konzole
const firebaseConfig = {
  apiKey: "AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ",
  authDomain: "studio-2327834732-8ec09.firebaseapp.com",
  projectId: "studio-2327834732-8ec09",
  storageBucket: "studio-2327834732-8ec09.firebasestorage.app",
  messagingSenderId: "60078641715",
  appId: "1:60078641715:web:1ed05728df58a0272c4946"
};

// Bezpečná inicializace Firebase s ohledem na Next.js SSR (Server-Side Rendering)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

interface DataContextType {
  klienti: any[];
  zaznamy: any[];
  setZaznamy: React.Dispatch<React.SetStateAction<any[]>>;
  setKlienti: React.Dispatch<React.SetStateAction<any[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [klienti, setKlientiState] = useState<any[]>([]);
  const [zaznamy, setZaznamyState] = useState<any[]>([]);

  // 1. Načítání a synchronizace klientů z Firestore v reálném čase
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'klienti'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Pokud je cloudová databáze čistá a prázdná, vložíme výchozí testovací subjekty
      if (docs.length === 0) {
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
          },
          {
            id: "sklady-abc",
            nazev: "Sklady ABC a.s.",
            ico: "98765432",
            pracoviste: [
              { id: "p3", text: "Sklad A", nazev: "Skladová hala ABC", adresa: "Logistický park 45, Brno" }
            ],
            odpovedneOsoby: [
              { jmeno: "Martin Skladník", pozice: "Manažer logistiky" },
              { jmeno: "Eva Skladová", pozice: "Odpovědná osoba" }
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
  }, []);

  // 2. Načítání a synchronizace auditních záznamů z Firestore v reálném čase
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'zaznamy'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setZaznamyState(docs);
    });
    return () => unsubscribe();
  }, []);

  //
