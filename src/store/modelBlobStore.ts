// IndexedDB-backed storage for uploaded 3D model files. localStorage can't hold
// blobs (or wouldn't fit one), so the raw file lives here and only its id is
// persisted in the config store, letting the model survive a page reload.

const DB_NAME = 'iimt-models';
const STORE_NAME = 'blobs';

export interface StoredModel {
  blob: Blob;
  name: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function runTx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const req = run(tx.objectStore(STORE_NAME));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function saveModelBlob(id: string, file: File): Promise<IDBValidKey> {
  const record: StoredModel = { blob: file, name: file.name };
  return runTx('readwrite', (store) => store.put(record, id));
}

export function loadModelBlob(id: string): Promise<StoredModel | undefined> {
  return runTx('readonly', (store) => store.get(id));
}

export function deleteModelBlob(id: string): Promise<undefined> {
  return runTx('readwrite', (store) => store.delete(id));
}
