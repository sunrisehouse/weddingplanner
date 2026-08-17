// 저장소 — 지금은 localStorage. 나중에 서버로 옮길 수 있게 이 파일 뒤로 숨긴다.
//
// 여기 밖에서는 localStorage를 직접 건드리지 않는다.
// 두 사람이 함께 보려면 이 모듈만 교체하면 된다.

const KEY = 'weddingplanner.v1';

const empty = () => ({ version: 1, venues: [], updatedAt: null });

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.venues)) return empty();
    return data;
  } catch {
    return empty();
  }
}

let state = read();
const listeners = new Set();

function commit() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // 용량 초과 등 — 저장에 실패하면 알려야 한다. 조용히 삼키지 않는다.
    alert('저장하지 못했어요. 브라우저 저장 공간이 가득 찼을 수 있어요.\n내보내기로 백업해주세요.');
    throw e;
  }
  listeners.forEach((fn) => fn(state));
}

const uid = () =>
  `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const blankVenue = () => ({
  id: uid(),
  name: '',
  tourDate: '',
  hallFee: null,
  flowers: null,
  mealPrice: null,
  guarantee: null,
  bridalRoom: 'unknown',
  pyebaekRoom: 'unknown',
  supplies: 'unknown',
  memo: '',
  photos: [],
});

export const store = {
  get: () => state,
  venues: () => state.venues,
  venue: (id) => state.venues.find((v) => v.id === id) ?? null,

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  save(venue) {
    const i = state.venues.findIndex((v) => v.id === venue.id);
    if (i === -1) state.venues.push(venue);
    else state.venues[i] = venue;
    commit();
    return venue;
  },

  remove(id) {
    state.venues = state.venues.filter((v) => v.id !== id);
    commit();
  },

  // 내보내기 / 불러오기 — localStorage는 이 브라우저에만 있으니 백업 수단이 반드시 필요하다
  exportJSON() {
    return JSON.stringify(state, null, 2);
  },

  importJSON(text) {
    const data = JSON.parse(text);
    if (data?.version !== 1 || !Array.isArray(data.venues)) {
      throw new Error('이 파일은 웨딩플래너 백업 파일이 아닌 것 같아요.');
    }
    state = data;
    commit();
  },
};

// 예상 합계 — 자료의 계산식 그대로. 하나라도 비면 계산하지 않는다.
export function total(v) {
  const { hallFee, flowers, mealPrice, guarantee } = v;
  if ([hallFee, flowers, mealPrice, guarantee].some((n) => n === null || n === '')) {
    return null;
  }
  return Number(hallFee) + Number(flowers) + Number(guarantee) * Number(mealPrice);
}
