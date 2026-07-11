// src/lib/firestore-rest.ts
// Minimalistický Firestore přístup přes REST (bez Admin SDK).
// Používá access token ze service accountu (obchází security rules – server je důvěryhodný).

import { getAccessToken } from "./google-token";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// --- převod JS <-> Firestore REST hodnot ---
type FsValue = Record<string, unknown>;

function toFsValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v))
    return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === "object") {
    const fields: Record<string, FsValue> = {};
    for (const [k, val] of Object.entries(v as object))
      fields[k] = toFsValue(val);
    return { mapValue: { fields } };
  }
  throw new Error("Nepodporovaný typ pro Firestore: " + typeof v);
}

function fromFsValue(v: FsValue): unknown {
  const key = Object.keys(v)[0];
  const val = (v as Record<string, unknown>)[key];
  switch (key) {
    case "nullValue": return null;
    case "stringValue": return val;
    case "booleanValue": return val;
    case "integerValue": return parseInt(val as string, 10);
    case "doubleValue": return val;
    case "timestampValue": return new Date(val as string);
    case "arrayValue":
      return ((val as { values?: FsValue[] }).values ?? []).map(fromFsValue);
    case "mapValue": {
      const out: Record<string, unknown> = {};
      const fields = (val as { fields?: Record<string, FsValue> }).fields ?? {};
      for (const [k, fv] of Object.entries(fields)) out[k] = fromFsValue(fv);
      return out;
    }
    default: return null;
  }
}

function docToObject(doc: {
  name?: string;
  fields?: Record<string, FsValue>;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields ?? {})) out[k] = fromFsValue(v);
  if (doc.name) out.__id = doc.name.split("/").pop();
  return out;
}

async function authHeaders() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// GET jeden dokument (null pokud neexistuje)
export async function getDoc(
  collection: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/${collection}/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getDoc selhal: ${res.status}`);
  return docToObject(await res.json());
}

// SET/CREATE dokument s daným ID (patch = přepíše uvedená pole)
export async function setDoc(
  collection: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFsValue(v);
  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const res = await fetch(
    `${BASE}/${collection}/${encodeURIComponent(id)}?${mask}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) throw new Error(`setDoc selhal: ${res.status} ${await res.text()}`);
}

// Dotaz: najdi dokumenty kde field == value (runQuery / structured query)
export async function queryEquals(
  collection: string,
  field: string,
  value: unknown
): Promise<Record<string, unknown>[]> {
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: "EQUAL",
          value: toFsValue(value),
        },
      },
      limit: 10,
    },
  };
  const res = await fetch(`${BASE}:runQuery`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`query selhal: ${res.status}`);
  const rows = (await res.json()) as { document?: { name?: string; fields?: Record<string, FsValue> } }[];
  return rows
    .filter((r) => r.document)
    .map((r) => docToObject(r.document!));
}
