import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Chybí Firebase Admin přihlašovací údaje. Zkontrolujte FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL a FIREBASE_PRIVATE_KEY v env proměnných.'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Lazy getters – Admin app se inicializuje až při prvním použití (ne při buildu).
export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

/**
 * Ověří Firebase ID token z hlavičky Authorization: Bearer <token>.
 * Vrací dekódovaný token, nebo null když je neplatný / chybí konfigurace.
 */
export async function verifyIdToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authorizationHeader.substring(7);
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

/**
 * Ověří, že uživatel je přihlášený A má roli 'admin' v kolekci 'uzivatele'.
 * Vrací uid admina, nebo null.
 */
export async function verifyAdmin(authorizationHeader: string | null): Promise<string | null> {
  const decoded = await verifyIdToken(authorizationHeader);
  if (!decoded) return null;

  try {
    const userDoc = await getAdminDb().collection('uzivatele').doc(decoded.uid).get();
    if (userDoc.exists && userDoc.data()?.role === 'admin') {
      return decoded.uid;
    }
  } catch (e) {
    console.error('Chyba ověření admina:', e);
  }
  return null;
}
