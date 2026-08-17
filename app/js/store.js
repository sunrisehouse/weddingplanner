// 저장소 — 지금은 localStorage. 나중에 서버로 옮길 수 있게 이 파일 뒤로 숨긴다.
//
// 여기 밖에서는 localStorage를 직접 건드리지 않는다.
// 두 사람이 함께 보려면 이 모듈만 교체하면 된다.

const KEY = 'weddingplanner.v1';

// 자료(체크리스트)의 `구분` 열이 그대로 온보딩 질문이 된다.
// 준비 상태는 세 항목 모두 같은 값을 쓴다: done | looking | none
const emptyProfile = () => ({
  ceremonyDateStatus: null,   // confirmed | tentative | unknown
  ceremonyDate: '',
  venueStatus: null,          // 웨딩홀
  sdmStatus: null,            // 스드메 (웨딩패키지)
  honeymoonStatus: null,      // 허니문
  honsuStatus: null,          // 혼수
  onboardedAt: null,
});

// 이전 버전의 웨딩홀 값 이름을 맞춘다
const LEGACY = { contracted: 'done', touring: 'looking' };

const empty = () => ({ version: 1, venues: [], profile: emptyProfile(), updatedAt: null });

// 안 쓰는 질문의 답은 들고 다니지 않는다
function migrate(profile) {
  const p = { ...profile };
  if (LEGACY[p.venueStatus]) p.venueStatus = LEGACY[p.venueStatus];
  delete p.guestEstimate;
  delete p.pyebaek;
  return p;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.venues)) return empty();
    data.profile = migrate({ ...emptyProfile(), ...(data.profile ?? {}) });
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

  profile: () => state.profile,
  onboarded: () => Boolean(state.profile.onboardedAt),

  setProfile(patch) {
    state.profile = { ...state.profile, ...patch };
    commit();
  },

  finishOnboarding() {
    state.profile.onboardedAt = new Date().toISOString();
    commit();
  },

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

  // 예시 데이터 — 비교표는 2곳 이상이어야 의미가 생기는데, 첫 방문자는 0곳이다.
  // 값을 만들어 넣는 대신 sample 표시를 달아 언제든 지울 수 있게 한다.
  loadSample() {
    if (state.venues.some((v) => v.sample)) return;
    state.venues.push(
      {
        ...blankVenue(), sample: true, name: '예시 A홀', tourDate: '',
        hallFee: 5000000, flowers: 1200000, mealPrice: 68000, guarantee: 200,
        bridalRoom: 'yes', pyebaekRoom: 'yes', supplies: 'yes',
        memo: '예시로 넣어둔 값이에요. 실제 시세가 아닙니다.',
      },
      {
        ...blankVenue(), sample: true, name: '예시 B홀', tourDate: '',
        mealPrice: 62000, bridalRoom: 'yes', pyebaekRoom: 'no',
        memo: '일부만 적힌 상태는 이렇게 보입니다.',
      }
    );
    commit();
  },

  clearSample() {
    state.venues = state.venues.filter((v) => !v.sample);
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
    data.profile = migrate({ ...emptyProfile(), ...(data.profile ?? {}) });
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

// 예식일까지 남은 일수. 없으면 null.
export function daysToCeremony(profile) {
  if (!profile?.ceremonyDate) return null;
  const d = new Date(profile.ceremonyDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

// 큰 항목(체크리스트 `구분` 열)과 예약 시점.
//
// ⚠️ days · note의 숫자는 전부 박람회 자료 `비고` 열에서 왔다.
//    새 숫자를 추측해서 넣지 말 것. 근거는 docs/01-checklist.md.
//    화면 문구는 앱이 직접 안내하는 말투로 쓴다 —
//    "자료에 이렇게 적혀 있어요"가 아니라 "이때까지 예약하세요".
//
// days = 예식일까지 남은 일수 (한 달 30일)
export const PREP = [
  {
    key: 'venueStatus', label: '웨딩홀', days: 300,
    note: '늦어도 10개월 전에 예약하세요', by: '10개월 전',
    items: '예식장 사용료 · 꽃장식 · 피로연 · 본식 스냅',
  },
  {
    key: 'sdmStatus', label: '스드메', days: 300,
    note: '10~12개월 전에 예약하세요', by: '10개월 전',
    items: '스튜디오 · 드레스 · 헤어메이크업 · 부케',
  },
  {
    key: 'honeymoonStatus', label: '허니문', days: 180,
    note: '6~8개월 전에 예약하세요', by: '6개월 전',
    items: '신혼여행비 · 예비비',
  },
  {
    key: 'honsuStatus', label: '혼수', days: 90,
    note: '예단은 3개월 전에 준비하세요', by: '3개월 전',
    items: '한복 · 웨딩반지 · 예복 · 예단 · 가전/가구',
    caveat: '한복은 촬영 2개월 전, 가전·가구는 입주 2~3개월 전에 맞추세요. '
      + '예식일과 기준이 달라 위 계산에는 넣지 않았어요.',
  },
];

// 본인이 답한 상태와 자료의 시점을 맞춰본다.
// 앱이 순서를 정해주는 게 아니라, 자료에 적힌 시점이 지났는지만 알린다.
export function prepStatus(profile) {
  const d = daysToCeremony(profile);
  return PREP.map((c) => {
    const answer = profile?.[c.key] ?? null;
    let state;
    if (answer === 'done') state = 'done';
    else if (answer === null) state = 'unanswered';   // 안 물어봤거나 건너뛴 것
    else if (d === null) state = 'nodate';            // 예식일을 모르면 시점을 못 따진다
    else if (d < c.days) state = 'late';
    else state = 'ok';
    return { ...c, answer, state, d };
  });
}
