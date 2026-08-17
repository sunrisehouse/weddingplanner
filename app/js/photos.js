// 사진은 IndexedDB에 따로 둔다.
//
// localStorage는 문자열만 담기고 한도가 5MB 안팎이라, 견적서 사진 몇 장이면 금방 찬다.
// 사진이 텍스트 기록까지 밀어내는 걸 막으려고 저장소를 나눴다.

const DB = 'weddingplanner';
const STORE = 'photos';

let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

const uid = () => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const photos = {
  async add(blob) {
    const id = uid();
    await tx('readwrite', (s) => s.put(blob, id));
    return id;
  },
  async get(id) {
    return tx('readonly', (s) => s.get(id));
  },
  async remove(id) {
    return tx('readwrite', (s) => s.delete(id));
  },
  async url(id) {
    const blob = await this.get(id);
    return blob ? URL.createObjectURL(blob) : null;
  },
};
