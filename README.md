rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- pomocne funkce ----------
    function isSignedIn() {
      return request.auth != null;
    }

    function profil() {
      return get(/databases/$(database)/documents/uzivatele/$(request.auth.uid)).data;
    }

    function maProfil() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/uzivatele/$(request.auth.uid));
    }

    function isAdmin() {
      return maProfil() && profil().role == 'admin';
    }

    // klientId prihlaseneho uzivatele (klientsky ucet)
    function mujKlientId() {
      return profil().klientId;
    }

    // ---------- pozvanky ----------
    // Klient se k pozvankam nedostane. Cteni/zapis jen admin z UI;
    // server route jede pres service account (mimo tato pravidla).
    match /pozvanky/{id} {
      allow read, write: if isAdmin();
    }

    // ---------- uzivatele ----------
    match /uzivatele/{uid} {
      // svuj profil smi cist uzivatel; vsechny admin
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      // role/klientId/osobaId zapisuje JEN admin (server ma service account)
      allow create, update, delete: if isAdmin();
    }

    // ---------- klienti ----------
    match /klienti/{klientId} {
      // admin vse; klientsky ucet jen SVEHO klienta
      allow read: if isAdmin()
        || (maProfil() && mujKlientId() == klientId);
      // zapisovat klienty smi jen admin
      allow write: if isAdmin();
    }

    // ---------- zaznamy (kontroly/protokoly) ----------
    // Predpoklad: kazdy dokument v `zaznamy` ma pole klientId.
    match /zaznamy/{zaznamId} {
      allow read: if isAdmin()
        || (maProfil() && resource.data.klientId == mujKlientId());
      // vytvaret/menit zaznamy smi jen admin (ty jsi OZO)
      allow create, update, delete: if isAdmin();
    }

    // ---------- konfigurace ----------
    match /konfigurace/{doc} {
      allow read: if maProfil();   // cist smi kazdy prihlaseny
      allow write: if isAdmin();
    }
  }
}
