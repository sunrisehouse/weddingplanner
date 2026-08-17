// 저장소 — 지금은 localStorage. 나중에 서버로 옮길 수 있게 이 파일 뒤로 숨긴다.
//
// 여기 밖에서는 localStorage를 직접 건드리지 않는다.
// 두 사람이 함께 보려면 이 모듈만 교체하면 된다.

const KEY = 'weddingplanner.v1';

// 자료(체크리스트)의 `구분` 열이 그대로 온보딩 질문이 된다.
// 준비 상태는 네 항목 모두 같은 값을 쓴다: done | looking | none
//
// 예식 시점은 두 칸으로 나눠 담는다. 웨딩홀을 계약해야 날짜가 나오므로
// 미계약이면 달만 알고, 그때 ceremonyDate는 비워 둔다.
const emptyProfile = () => ({
  venueStatus: null,          // 웨딩홀 — 이 답이 예식일 정밀도를 정한다
  pickedVenueId: null,        // 예약을 확정한 웨딩홀
  ceremonyDate: '',           // YYYY-MM-DD (계약 후 확정)
  ceremonyMonth: '',          // YYYY-MM (미계약 · 예상 시기)
  sdmStatus: null,            // 스드메 (웨딩패키지)
  pickedSdmId: null,          // 계약을 확정한 스드메 업체
  honeymoonStatus: null,      // 허니문
  honsuStatus: null,          // 혼수
  onboardedAt: null,
});

// 이전 버전의 웨딩홀 값 이름을 맞춘다
const LEGACY = { contracted: 'done', touring: 'looking' };

// 항목별 기록. 웨딩홀은 여러 곳을 비교하니 venues 배열로 따로 있고,
// 스드메 · 허니문 · 혼수는 한 벌씩이라 여기 담는다.
const emptyPlan = () => ({
  // 계약 후에 의미가 생기는 것들. 후보별 견적은 sdmVendors에 있다.
  sdm: {
    shootDate: '',      // 촬영일 — 예식일과 별개 기준일
    dressTour: '',
    shootFitting: '',
    mainFitting: '',
    memo: '',
  },
  honeymoon: {
    place: '', departDate: '', returnDate: '',
    travel: null, extra: null, reserve: null,
    memo: '',
  },
  honsu: {},            // 품목키: yes(준비) | no(생략) | unknown(미정)
});

const empty = () => ({
  version: 1,
  venues: [],        // 웨딩홀 후보
  sdmVendors: [],    // 스드메 후보
  profile: emptyProfile(),
  plan: emptyPlan(),
  updatedAt: null,
});

// 중첩된 칸이라 얕은 병합으로는 새 필드가 안 채워진다
function fillPlan(saved) {
  const base = emptyPlan();
  const p = saved ?? {};
  return {
    sdm: { ...base.sdm, ...(p.sdm ?? {}) },
    honeymoon: { ...base.honeymoon, ...(p.honeymoon ?? {}) },
    honsu: { ...(p.honsu ?? {}) },
  };
}

// 안 쓰는 질문의 답은 들고 다니지 않는다
function migrate(profile) {
  const p = { ...profile };
  if (LEGACY[p.venueStatus]) p.venueStatus = LEGACY[p.venueStatus];
  delete p.guestEstimate;
  delete p.pyebaek;
  delete p.ceremonyDateStatus;   // 확정/가예약은 venueStatus로 알 수 있다
  return p;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.venues)) return empty();
    data.profile = migrate({ ...emptyProfile(), ...(data.profile ?? {}) });
    data.plan = fillPlan(data.plan);
    if (!Array.isArray(data.sdmVendors)) data.sdmVendors = [];
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

  // 항목별 기록 — 스드메 · 허니문 · 혼수
  plan: (section) => (section ? state.plan[section] : state.plan),

  setPlan(section, patch) {
    state.plan[section] = { ...state.plan[section], ...patch };
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
    if (state.profile.pickedVenueId === id) {
      state.profile = { ...state.profile, pickedVenueId: null, venueStatus: 'looking' };
    }
    commit();
  },

  // ── 스드메 후보 ──────────────────────────────────────────────────────
  sdmVendors: () => state.sdmVendors,
  sdmVendor: (id) => state.sdmVendors.find((v) => v.id === id) ?? null,

  saveSdm(v) {
    const i = state.sdmVendors.findIndex((x) => x.id === v.id);
    if (i === -1) state.sdmVendors.push(v);
    else state.sdmVendors[i] = v;
    commit();
    return v;
  },

  removeSdm(id) {
    state.sdmVendors = state.sdmVendors.filter((v) => v.id !== id);
    if (state.profile.pickedSdmId === id) {
      state.profile = { ...state.profile, pickedSdmId: null, sdmStatus: 'looking' };
    }
    commit();
  },

  // ── 비교 → 예약 확정 ─────────────────────────────────────────────────
  // 확정하면 진행 상태가 같이 넘어간다. 두 곳에 따로 적게 하지 않는다.
  pick(kind, id) {
    state.profile = kind === 'venue'
      ? { ...state.profile, pickedVenueId: id, venueStatus: 'done' }
      : { ...state.profile, pickedSdmId: id, sdmStatus: 'done' };
    commit();
  },

  unpick(kind) {
    state.profile = kind === 'venue'
      ? { ...state.profile, pickedVenueId: null, venueStatus: 'looking' }
      : { ...state.profile, pickedSdmId: null, sdmStatus: 'looking' };
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
    data.plan = fillPlan(data.plan);
    if (!Array.isArray(data.sdmVendors)) data.sdmVendors = [];
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

// 예식일까지 남은 일수. 확정 날짜가 없으면 null.
export function daysToCeremony(profile) {
  if (!profile?.ceremonyDate) return null;
  const d = new Date(profile.ceremonyDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

// 예식 달까지 남은 개월. 달만 아는 경우에 쓴다.
export function monthsToCeremony(profile) {
  const ym = parseYM(profile?.ceremonyMonth);
  if (!ym) return null;
  const now = new Date();
  return (ym.y - now.getFullYear()) * 12 + (ym.m - (now.getMonth() + 1));
}

function parseYM(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? { y, m: mo } : null;
}

const shiftDays = (iso, n) =>
  new Date(new Date(iso + 'T00:00:00').getTime() + n * 86400000)
    .toISOString().slice(0, 10);

function shiftMonths(ymStr, n) {
  const ym = parseYM(ymStr);
  if (!ym) return null;
  const t = ym.y * 12 + (ym.m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

// 예식 시점의 기준.
//
// 예식일은 웨딩홀을 계약해야 정해진다. 그래서 두 가지 정밀도를 다룬다.
//   date  — 웨딩홀 계약 후. 날짜까지 안다
//   month — 아직 미계약. 달만 안다. 없는 날짜를 만들어 쓰지 않는다
export function ceremonyAnchor(profile) {
  if (profile?.ceremonyDate && daysToCeremony(profile) !== null) {
    return { kind: 'date', iso: profile.ceremonyDate };
  }
  if (parseYM(profile?.ceremonyMonth)) {
    return { kind: 'month', ym: profile.ceremonyMonth };
  }
  return { kind: 'none' };
}

// 큰 항목(체크리스트 `구분` 열)과 예약 시점.
//
// ⚠️ months · note의 숫자는 전부 박람회 자료 `비고` 열에서 왔다.
//    새 숫자를 추측해서 넣지 말 것. 근거는 docs/01-checklist.md.
//    화면 문구는 앱이 직접 안내하는 말투로 쓴다 —
//    "자료에 이렇게 적혀 있어요"가 아니라 "이때까지 예약하세요".
export const PREP = [
  {
    key: 'venueStatus', label: '웨딩홀', months: 10,
    note: '늦어도 10개월 전에 예약하세요', by: '10개월 전', todo: '예약하세요',
    items: '예식장 사용료 · 꽃장식 · 피로연 · 본식 스냅',
  },
  {
    key: 'sdmStatus', label: '스드메', months: 10,
    note: '10~12개월 전에 예약하세요', by: '10개월 전', todo: '예약하세요',
    items: '스튜디오 · 드레스 · 헤어메이크업 · 부케',
  },
  {
    key: 'honeymoonStatus', label: '허니문', months: 6,
    note: '6~8개월 전에 예약하세요', by: '6개월 전', todo: '예약하세요',
    items: '신혼여행비 · 예비비',
  },
  {
    key: 'honsuStatus', label: '혼수', months: 3,
    note: '예단은 3개월 전에 준비하세요', by: '3개월 전', todo: '예단 준비하세요',
    items: '한복 · 웨딩반지 · 예복 · 예단 · 가전/가구',
    caveat: '한복은 촬영 2개월 전, 가전·가구는 입주 2~3개월 전에 맞추세요. '
      + '예식일과 기준이 달라 위 계산에는 넣지 않았어요.',
  },
];

// 본인이 답한 상태를 예약 시점과 맞춰본다.
// 앱이 순서를 정해주는 게 아니라, 시점이 지났는지만 알린다.
//
// 기준이 달뿐이면 마감도 달로만 낸다. 날짜를 지어내지 않는다.
export function prepStatus(profile) {
  const a = ceremonyAnchor(profile);
  const days = a.kind === 'date' ? daysToCeremony(profile) : null;
  const months = a.kind === 'month' ? monthsToCeremony(profile) : null;

  return PREP.map((c) => {
    const answer = profile?.[c.key] ?? null;
    let dueDate = null;
    let dueMonth = null;
    let left = null;
    let unit = null;

    if (a.kind === 'date') {
      dueDate = shiftDays(a.iso, -c.months * 30);   // 한 달 30일로 센다
      left = days - c.months * 30;
      unit = 'day';
    } else if (a.kind === 'month') {
      dueMonth = shiftMonths(a.ym, -c.months);
      left = months - c.months;
      unit = 'month';
    }

    let state;
    if (answer === 'done') state = 'done';
    else if (answer === null) state = 'unanswered';   // 안 물어봤거나 건너뛴 것
    else if (a.kind === 'none') state = 'nodate';     // 시점을 모르면 따질 수 없다
    else if (left < 0) state = 'late';
    else state = 'ok';

    return { ...c, answer, state, dueDate, dueMonth, left, unit };
  });
}

// ── 스드메 ────────────────────────────────────────────────────────────────
//
// ⚠️ 아래 항목과 숫자는 전부 자료에서 왔다.
//    품목 구성 → docs/01-checklist.md '웨딩패키지 (스드메)'
//    별도 항목 · 결제 · 위약금 → docs/03-contract.md (계약서 인쇄면)
//    단계별 소요시간 · 벌수 → docs/02-schedule.md (일정표 인쇄면)
//    새 항목이나 금액을 추측해서 넣지 말 것.

// 스드메 후보 한 곳
export const blankSdm = () => ({
  id: uid(),
  name: '',
  consultDate: '',
  packagePrice: null,   // 패키지(계약) 금액
  shootDress: null,     // 촬영 드레스 벌수
  mainDress: null,      // 본식 드레스 벌수
  album: '',            // 앨범 · 액자 구성
  extras: {},           // 별도 항목별 금액 (모르면 비움)
  memo: '',
});

// 패키지에 들어 있는 구성 (체크리스트 인쇄면)
export const SDM_PACKAGE = [
  ['스튜디오', '촬영 · 20p 앨범 1권 + 20R 액자'],
  ['드레스 (촬영)', '신부 화이트 3벌 / 신랑 턱시도'],
  ['드레스 (본식)', '신부 화이트 1벌 / 신랑 턱시도'],
  ['헤어 & 메이크업', '촬영 · 본식 각 1회 (신랑 · 신부)'],
  ['부케', '부케 1 · 부토니아 1 · 코사지 6'],
];

// 계약서에 인쇄된 '별도' 항목. 계약 금액에 포함되지 않는다.
// 앱이 금액을 제시하지 않는다 — 업체에서 받은 금액을 직접 적는다.
export const SDM_EXTRAS = [
  ['origin', '원본 데이터', '스튜디오 · 별도 구입'],
  ['retouch', '선수정본', '스튜디오'],
  ['helperShoot', '헬퍼비 (촬영)', '드레스 · 촬영과 본식에 각각 발생'],
  ['helperMain', '헬퍼비 (본식)', '드레스'],
  ['tourFee', '드레스 투어비', '샵당 발생 · 피팅비 5.5만원~'],
  ['tripShoot', '출장비 (촬영)', '청담 이외 지역 · 5시간 기준'],
  ['tripMain', '출장비 (본식)', '서울 이외 지역'],
  ['early', '얼리스타트', '메이크업 · 8시 이전'],
  ['late', '테이블 비용', '메이크업 · 17시 이후'],
];

// 스드메 준비 단계 (촬영일은 따로 다룬다)
export const SDM_STEPS = [
  ['dressTour', '드레스샵 투어', '2~3곳 · 샵당 1시간 · 4벌 피팅 후 1벌 홀딩'],
  ['shootFitting', '촬영 가봉', '1시간 · 6벌 피팅 후 3벌 선택'],
  ['mainFitting', '본식 가봉', '4벌 피팅 후 1벌 선택 · 부케 결정'],
];

// 계약서에 인쇄된 결제 비율과 기한
export const SDM_DEPOSIT_PCT = 10;
export const SDM_MID_PCT = 70;
export const SDM_FINAL_PCT = 20;
export const SDM_MID_DAYS = 60;      // 촬영 60일 전 중도금
export const SDM_FINAL_DAYS = 60;    // 본식 60일 전 잔금
export const SDM_PENALTY_DAYS = 90;  // 촬영일 기준 90일 이내 변경·취소 시 위약금

// 실제 예상 = 패키지 금액 + 적어둔 별도 비용.
// 자료의 요지가 "계약 총액만 보면 실제 지출을 알 수 없다"는 것이다.
export function sdmTotal(v) {
  const p = v?.packagePrice;
  const hasPackage = !(p === null || p === '' || p === undefined);
  let sum = hasPackage ? Number(p) : 0;
  let missing = hasPackage ? 0 : 1;
  let extraSum = 0;
  for (const [k] of SDM_EXTRAS) {
    const x = v?.extras?.[k];
    if (x === null || x === '' || x === undefined) missing += 1;
    else { extraSum += Number(x); sum += Number(x); }
  }
  return { ok: hasPackage, sum, extraSum, missing };
}

// 촬영일에서 나오는 날짜들. 촬영일이 없으면 계산하지 않는다.
export function sdmDates(plan, profile) {
  const shoot = plan?.shootDate;
  const okShoot = shoot && !Number.isNaN(new Date(shoot + 'T00:00:00').getTime());
  const ceremony = profile?.ceremonyDate;
  const okCeremony = ceremony && daysToCeremony(profile) !== null;
  return {
    penalty: okShoot ? shiftDays(shoot, -SDM_PENALTY_DAYS) : null,
    mid: okShoot ? shiftDays(shoot, -SDM_MID_DAYS) : null,
    final: okCeremony ? shiftDays(ceremony, -SDM_FINAL_DAYS) : null,
  };
}

// ── 허니문 ────────────────────────────────────────────────────────────────
// 자료에 적힌 것: 신혼여행비 · 여행지 추가지출비용 · 예비비용(선물비용) / 6~8개월 전
export const HONEYMOON_COSTS = [
  ['travel', '신혼여행비'],
  ['extra', '여행지 추가지출'],
  ['reserve', '예비비 (선물비용)'],
];

// 적어둔 금액만 더한다. 빈 칸은 개수만 센다.
export function honeymoonTotal(h) {
  let sum = 0;
  let missing = 0;
  for (const [key] of HONEYMOON_COSTS) {
    const v = h?.[key];
    if (v === null || v === '' || v === undefined) missing += 1;
    else sum += Number(v);
  }
  return { sum, missing };
}

// ── 혼수 ──────────────────────────────────────────────────────────────────
// 체크리스트 인쇄면의 혼수 품목. 시점 기준이 예식일이 아닌 것은 그대로 적어둔다.
export const HONSU_ITEMS = [
  ['hanbok', '한복', '신부 · 신랑 · 양가 어머님 · 촬영 2개월 전'],
  ['ring', '웨딩반지', '커플링 · 예물'],
  ['suit', '예복', '신랑 맞춤예복 · 턱시도 대여'],
  ['yedan', '예단', '현금 또는 현금+예물 · 3개월 전'],
  ['appliance', '가전 · 가구', '신혼집에 맞춰 · 입주 2~3개월 전'],
  ['living', '주방용품 · 침구 · 생활용품', '신혼집에 맞춰 · 입주 2~3개월 전'],
];
