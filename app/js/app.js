import {
  store, blankVenue, blankSdm, total,
  daysToCeremony, monthsToCeremony, ceremonyAnchor, prepStatus,
  SDM_PARTS, SDM_SERVICES, SDM_EXTRAS, extrasOf, SDM_STEPS, SDM_MID_PCT, SDM_FINAL_PCT,
  SHOP_PARTS, SHOP_FEE, blankShop,
  SDM_MID_DAYS, SDM_FINAL_DAYS, SDM_PENALTY_DAYS, sdmDates, sdmTotal,
  choiceCount, HONEYMOON_COSTS, honeymoonTotal,
  HONSU_CHOICES, HOME_ITEMS, honsuCount, homeCount, honsuDates,
} from './store.js';
import { photos } from './photos.js';

const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');

const won = (n) => (n === null || n === '' ? null : Number(n).toLocaleString('ko-KR'));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dateLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
};

// 마감일은 요일까지 필요 없다. 해가 넘어가면 연도를 붙인다.
const mdLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
};

// 달만 아는 시점
const ymLabel = (ym) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym ?? ''));
  return m ? `${m[1]}년 ${Number(m[2])}월` : '';
};

// 서술격 조사 — 받침이 있으면 '이에요', 없으면 '예요'
const ida = (word) => {
  const c = String(word).charCodeAt(String(word).length - 1);
  const hangul = c >= 0xac00 && c <= 0xd7a3;
  return hangul && (c - 0xac00) % 28 !== 0 ? '이에요' : '예요';
};

const INCLUDES = [
  ['bridalRoom', '신부대기실'],
  ['pyebaekRoom', '폐백실'],
  ['supplies', '혼구용품'],
];
const TRI = [['yes', '있음'], ['no', '없음'], ['unknown', '모름']];

const brand = (sub = '') => `
  <header>
    <p class="brand">💍 웨딩플래너</p>
    ${sub ? `<h1>${sub}</h1>` : ''}
  </header>`;


// ── 온보딩 — 한 화면에 질문 하나 ────────────────────────────────────────
// 자료(체크리스트)의 `구분` 열에 있는 큰 항목만 묻는다.
// 청첩장 · DVD · 폐백음식처럼 자료에서 '기타'로 묶인 작은 항목은 묻지 않는다.
// 답은 자료의 `비고` 열에 적힌 예약 시점과 맞춰보는 데 쓴다.
const QUESTIONS = [
  {
    // 예식일은 웨딩홀을 계약해야 정해진다. 그래서 이 질문이 첫 번째다.
    key: 'venueStatus',
    title: '웨딩홀은\n정하셨나요?',
    sub: '예식일이 여기서 정해져요',
    options: [
      { v: 'done', l: '계약했어요', next: 'date' },
      { v: 'looking', l: '알아보는 중이에요', next: 'month' },
      { v: 'none', l: '아직 안 알아봤어요', next: 'month' },
    ],
  },
  {
    key: 'sdmStatus',
    title: '스드메는\n어디까지 하셨나요?',
    sub: '스튜디오 · 드레스 · 헤어메이크업 · 부케',
    options: [
      { v: 'done', l: '계약했어요' },
      { v: 'looking', l: '상담 받는 중이에요' },
      { v: 'none', l: '아직 안 알아봤어요' },
    ],
  },
  {
    key: 'honeymoonStatus',
    title: '허니문은\n정하셨나요?',
    sub: '신혼여행지 · 예비비',
    options: [
      { v: 'done', l: '예약했어요' },
      { v: 'looking', l: '알아보는 중이에요' },
      { v: 'none', l: '아직 안 알아봤어요' },
    ],
  },
  {
    key: 'honsuStatus',
    title: '혼수는\n어디까지 하셨나요?',
    sub: '한복 · 웨딩반지 · 예복 · 예단 · 가전/가구',
    options: [
      { v: 'done', l: '거의 정했어요' },
      { v: 'looking', l: '알아보는 중이에요' },
      { v: 'none', l: '아직 안 알아봤어요' },
    ],
  },
];

const TOTAL_STEPS = QUESTIONS.length;

function stepChrome(i, backHash) {
  const pct = Math.round(((i + 1) / TOTAL_STEPS) * 100);
  return `
    <div class="ob-top">
      <button class="ob-back" id="ob-back" aria-label="뒤로">‹</button>
      <span class="ob-count">${i + 1} / ${TOTAL_STEPS}</span>
    </div>
    <div class="ob-bar"><i style="width:${pct}%"></i></div>
    <input type="hidden" id="ob-back-to" value="${backHash}" />`;
}

function questionView(i) {
  const q = QUESTIONS[i];
  if (!q) return (location.hash = '#/start/done');
  const backHash = i === 0 ? '' : `#/start/${i}`;

  app.innerHTML = `
    ${stepChrome(i, backHash)}
    <h1 class="ob-q">${esc(q.title).replace(/\n/g, '<br />')}</h1>
    ${q.sub ? `<p class="ob-sub">${esc(q.sub)}</p>` : '<div style="height:14px"></div>'}
    <div class="ob-opts">
      ${q.options
        .map((o, k) => `<button class="ob-opt" data-k="${k}">${esc(o.l)}</button>`)
        .join('')}
    </div>
    <button class="linkish ob-skip" id="skip">건너뛰고 바로 시작하기</button>
  `;

  $('#ob-back').onclick = () => {
    if (backHash) location.hash = backHash;
    else history.length > 1 ? history.back() : (location.hash = '#/start/1');
  };
  $('#skip').onclick = () => { store.finishOnboarding(); location.hash = '#/'; };

  app.querySelectorAll('.ob-opt').forEach((btn) => {
    btn.onclick = () => {
      const o = q.options[Number(btn.dataset.k)];
      store.setProfile({ [q.key]: o.v });
      if (o.next) return (location.hash = `#/start/${i + 1}-${o.next}`);
      location.hash = i + 1 < TOTAL_STEPS ? `#/start/${i + 2}` : '#/start/done';
    };
  });
}

// 예식 시점 화면은 두 곳에서 쓴다.
//   온보딩 중  — 웨딩홀 질문의 후속 화면. 진행 번호를 차지하지 않고 다음 질문으로 이어진다
//   홈에서 수정 — 시점만 고치고 홈으로 돌아간다. 남은 질문을 다시 걷게 하지 않는다
const stepCtx = (i) => ({
  chrome: stepChrome(i, `#/start/${i + 1}`),
  back: `#/start/${i + 1}`,
  nextLabel: '다음',
  done: () => (location.hash = i + 1 < TOTAL_STEPS ? `#/start/${i + 2}` : '#/start/done'),
});

const editCtx = () => ({
  chrome: '<button class="back" id="ob-back">‹ 홈</button>',
  back: '#/',
  nextLabel: '저장',
  done: () => (location.hash = '#/'),
});

// 웨딩홀을 계약했으면 날짜를 안다
function dateView(ctx) {
  const p = store.profile();
  app.innerHTML = `
    ${ctx.chrome}
    <h1 class="ob-q">예식일이<br />언제인가요?</h1>
    <p class="ob-sub">계약서에 적힌 날짜를 적어주세요</p>
    <div class="card">
      <div class="row">
        <label for="cd">예식일</label>
        <input id="cd" type="date" value="${esc(p.ceremonyDate)}" />
      </div>
    </div>
    <div class="sticky">
      <button class="btn btn-primary" id="next">${ctx.nextLabel}</button>
      <button class="linkish ob-skip" id="later">나중에 입력할게요</button>
    </div>
  `;
  $('#ob-back').onclick = () => (location.hash = ctx.back);
  $('#next').onclick = () => {
    // 날짜를 적었으면 달 추정치는 지운다
    store.setProfile({ ceremonyDate: $('#cd').value, ceremonyMonth: '' });
    ctx.done();
  };
  $('#later').onclick = ctx.done;
}

// 아직 미계약이면 달까지만 안다. 없는 날짜를 만들어 넣지 않는다.
function monthView(ctx) {
  const p = store.profile();
  const now = new Date();
  const cur = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const saved = /^(\d{4})-(\d{2})$/.exec(p.ceremonyMonth || '');
  const sel = saved ? { y: Number(saved[1]), m: Number(saved[2]) } : null;

  const years = [cur.y, cur.y + 1, cur.y + 2, cur.y + 3];
  const yOpts = years
    .map((y) => `<option value="${y}" ${sel?.y === y ? 'selected' : ''}>${y}년</option>`)
    .join('');
  const mOpts = Array.from({ length: 12 }, (_, k) => k + 1)
    .map((m) => `<option value="${m}" ${sel?.m === m ? 'selected' : ''}>${m}월</option>`)
    .join('');

  app.innerHTML = `
    ${ctx.chrome}
    <h1 class="ob-q">예식은 언제쯤<br />생각하세요?</h1>
    <p class="ob-sub">달만 정해두시면 돼요. 웨딩홀 예약하시면 날짜로 바꿔드릴게요</p>
    <div class="card">
      <div class="row">
        <label for="cy">예상 시기</label>
        <span class="ym">
          <select id="cy">${yOpts}</select>
          <select id="cm">${mOpts}</select>
        </span>
      </div>
    </div>
    <div class="sticky">
      <button class="btn btn-primary" id="next">${ctx.nextLabel}</button>
      <button class="linkish ob-skip" id="later">아직 모르겠어요</button>
    </div>
  `;
  if (!sel) $('#cm').value = String(cur.m);
  $('#ob-back').onclick = () => (location.hash = ctx.back);
  $('#next').onclick = () => {
    const ym = `${$('#cy').value}-${String($('#cm').value).padStart(2, '0')}`;
    store.setProfile({ ceremonyMonth: ym, ceremonyDate: '' });
    ctx.done();
  };
  $('#later').onclick = () => {
    store.setProfile({ ceremonyMonth: '', ceremonyDate: '' });
    ctx.done();
  };
}

const STATE_TXT = {
  done: ['완료', 'ok'],
  late: ['서둘러야 해요', 'late'],
  ok: ['시간 있어요', 'ok'],
  nodate: ['시기 정하면 알려드려요', 'mute'],
  unanswered: ['안 정하셨어요', 'mute'],
};

// 다음에 할 일은 앱이 정해서 준다. 목록을 던져놓고 알아서 보라고 하지 않는다.
function nextStep(p) {
  if (p.venueStatus === 'none' || p.venueStatus === null) {
    return { hash: '#/guide', label: '웨딩홀에서 확인할 것 보기' };
  }
  if (p.venueStatus === 'looking') return { hash: '#/new', label: '웨딩홀 기록 시작하기' };
  return { hash: '#/new', label: '계약한 웨딩홀 기록하기' };
}

function doneView() {
  const p = store.profile();
  store.finishOnboarding();
  const a = ceremonyAnchor(p);
  const prep = prepStatus(p);
  const late = prep.filter((c) => c.state === 'late');

  const dline = a.kind === 'date'
    ? `<div class="row do"><span class="k">예식일까지</span><span class="v">D-${daysToCeremony(p)}</span></div>`
    : a.kind === 'month'
      ? `<div class="row do"><span class="k">예식 예정</span>
           <span class="v">${esc(ymLabel(a.ym))}</span></div>`
      : '';

  const rows = prep
    .map((c) => {
      const [txt, cls] = STATE_TXT[c.state];
      const due = dueLabel(c);
      const when = c.state === 'done' ? '' : due ? `${due} ${c.todo}` : c.note;
      return `<div class="row prep ${cls}">
        <span class="k"><b>${c.label}</b>${when ? `<em>${esc(when)}</em>` : ''}</span>
        <span class="st">${txt}</span>
      </div>`;
    })
    .join('');

  // 시점이 지난 것만 짚는다. 무엇을 먼저 하라고 순서를 정해주지는 않는다.
  const remain = a.kind === 'date'
    ? `${Math.floor(daysToCeremony(p) / 30)}개월`
    : `${monthsToCeremony(p)}개월`;
  const lead = late.length
    ? `<div class="card notice gap">
         <p><b>${late.map((c) => esc(c.label)).join(' · ')}</b> 예약을 서둘러주세요.</p>
         <p>${late.map((c) => `${esc(c.label)} ${esc(c.by)}`).join(' · ')}까지 예약하셔야 하는데
            지금 ${remain} 남았어요.</p>
       </div>`
    : a.kind === 'none'
      ? `<div class="card notice gap"><p><b>예식 시기를 정하시면 시점을 챙겨드릴게요.</b></p>
         <p>달만 정해두셔도 됩니다.</p></div>`
      : '';

  const caveats = prep.filter((c) => c.caveat && c.state !== 'done');
  const cta = nextStep(p);

  app.innerHTML = `
    ${brand()}
    <h1 class="hero">이렇게 준비하시면 돼요</h1>
    <p class="hero-sub">답해주신 내용은 언제든 바꿀 수 있어요.</p>
    <div class="card">${dline}${rows}</div>
    ${lead}
    ${caveats.length
      ? `<p class="note">${caveats.map((c) => esc(c.caveat)).join('<br />')}</p>`
      : ''}
    <div class="sticky">
      <button class="btn btn-primary" id="go">${cta.label}</button>
      <button class="linkish ob-skip" id="home">둘러보기</button>
    </div>
  `;
  $('#go').onclick = () => (location.hash = cta.hash);
  $('#home').onclick = () => (location.hash = '#/');
}

// 마감 문구 — 기준이 날짜면 날짜로, 달뿐이면 달로. 날짜를 지어내지 않는다.
const dueLabel = (c) =>
  c.dueDate ? `${mdLabel(c.dueDate)}까지` : c.dueMonth ? `${ymLabel(c.dueMonth)}까지` : '';

const leftLabel = (c) =>
  c.left === null ? '' : c.unit === 'day' ? `${c.left}일 남았어요` : `${c.left}개월 남았어요`;

// 예식 시점 카드 — 홈과 웨딩홀 화면이 같이 쓴다
function ddayCard(p, late) {
  const a = ceremonyAnchor(p);
  if (a.kind === 'none') return '';

  const head = a.kind === 'date'
    ? `<span class="n">D-${daysToCeremony(p)}</span>
       <span class="t">${esc(dateLabel(a.iso))}${
         p.venueStatus === 'done' ? '' : ' · 예정'
       }</span>`
    : `<span class="n">${esc(ymLabel(a.ym))}</span>
       <span class="t">예정 · 약 ${monthsToCeremony(p)}개월 남음</span>`;

  return `
    <div class="dday">
      ${head}
      ${late.length
        ? `<span class="warn">${late.map((c) => esc(c.label)).join(' · ')} 예약을 서둘러주세요</span>`
        : ''}
      ${a.kind === 'month'
        ? '<span class="hintline">웨딩홀 예약하시면 날짜로 바꿔드릴게요</span>'
        : ''}
      <button class="linkish when" data-when>시기 수정</button>
    </div>`;
}

// ── 항목 페이지 공통 ────────────────────────────────────────────────────
// 준비 상태는 어느 항목 페이지에서든 바로 고친다.
// 온보딩을 다시 걷게 하지 않는다.
const SEG3 = [['done', '완료'], ['looking', '진행 중'], ['none', '아직']];

function statusCard(key) {
  const p = store.profile();
  const c = prepStatus(p).find((x) => x.key === key);
  const [txt, cls] = STATE_TXT[c.state];
  const due = dueLabel(c);
  const when = c.state === 'done' ? '' : due ? `${due} ${c.todo}` : c.note;
  return `
    <div class="card">
      <div class="row prep ${cls}">
        <span class="k"><b>준비 시점</b>${when ? `<em>${esc(when)}</em>` : ''}</span>
        <span class="st">${txt}</span>
      </div>
      <div class="row">
        <span class="k">진행 상태</span>
        <span class="seg" data-status="${key}">
          ${SEG3.map(([v, l]) =>
            `<button type="button" data-v="${v}" aria-pressed="${p[key] === v}">${l}</button>`
          ).join('')}
        </span>
      </div>
    </div>`;
}

function bindStatus() {
  const seg = app.querySelector('[data-status]');
  if (!seg) return;
  const key = seg.dataset.status;
  seg.querySelectorAll('button').forEach((b) => {
    b.onclick = () => { store.setProfile({ [key]: b.dataset.v }); render(); };
  });
}

// 날짜 한 줄
const dateRow = (id, label, value, hint = '') => `
  <div class="row${hint ? ' withhint' : ''}">
    <span class="k"><b>${label}</b>${hint ? `<em>${esc(hint)}</em>` : ''}</span>
    <input id="${id}" type="date" data-date="${id}" value="${esc(value)}" />
  </div>`;

// 금액 한 줄 — 앱이 기본값을 채우지 않는다
const numRow = (id, label, value) => `
  <div class="row">
    <label for="${id}">${label}</label>
    <input id="${id}" type="number" inputmode="numeric" data-num="${id}"
           value="${value ?? ''}" placeholder="미입력" />
  </div>`;

// ── 탭 ──────────────────────────────────────────────────────────────────
// 항목마다 관리 화면이 있고, 탭으로 오간다. 그 아래 화면(기록 폼 ·
// 확인할 것 · 온보딩)은 뒤로 가기로 돌아가므로 탭을 붙이지 않는다.
const TABS = [
  ['home', '#/', '🏠', '홈'],
  ['venue', '#/venues', '💐', '웨딩홀'],
  ['sdm', '#/sdm', '📸', '스드메'],
  ['honeymoon', '#/honeymoon', '✈️', '허니문'],
];

// 준비 현황의 각 줄이 그 항목의 관리 화면으로 간다
const ITEM_PAGE = {
  venueStatus: '#/venues',
  sdmStatus: '#/sdm',
  honeymoonStatus: '#/honeymoon',
  honsuStatus: '#/honsu',
};

function tabBar(active) {
  return `<nav class="tabs">${TABS.map(
    ([key, hash, icon, label]) => `
      <button data-tab="${hash}" ${active === key ? 'aria-current="page"' : ''}>
        <span class="i">${icon}</span>${label}
      </button>`
  ).join('')}</nav>`;
}

// 탭과 화면 공통 요소를 연결한다
function bindChrome() {
  app.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => (location.hash = b.dataset.tab);
  });
  const when = app.querySelector('[data-when]');
  if (when) when.onclick = () => (location.hash = '#/when');
  app.querySelectorAll('[data-goto]').forEach((b) => {
    b.onclick = () => (location.hash = b.dataset.goto);
  });
}

// ── 홈 — 준비 전체 ──────────────────────────────────────────────────────
// 첫 화면에는 전체로 봐야 하는 것만 둔다.
// 웨딩홀처럼 특정 항목을 다루는 화면은 탭에서 들어간다.
function homeView() {
  const p = store.profile();
  const anchor = ceremonyAnchor(p);
  const prep = prepStatus(p);
  const late = prep.filter((c) => c.state === 'late');

  // 다음에 다가오는 마감 — 이미 지난 것과 끝낸 것은 뺀다
  const next = prep
    .filter((c) => c.state === 'ok' && c.left !== null)
    .sort((a, b) => a.left - b.left)[0];

  const rows = prep
    .map((c) => {
      const [txt, cls] = STATE_TXT[c.state];
      // 끝낸 항목은 시점을 다시 말하지 않는다.
      // 시점을 알면 '언제까지'를 날짜(또는 달)로 준다.
      const due = dueLabel(c);
      const when = c.state === 'done' ? '' : due ? `${due} ${c.todo}` : c.note;
      return `<button class="row prep link ${cls}" data-goto="${ITEM_PAGE[c.key]}">
        <span class="k"><b>${c.label}</b>${when ? `<em>${esc(when)}</em>` : ''}</span>
        <span class="st">${txt}</span>
        <span class="arr">›</span>
      </button>`;
    })
    .join('');

  app.innerHTML = `
    ${brand('결혼 준비')}
    <div style="height:18px"></div>
    ${ddayCard(p, late)}
    ${anchor.kind === 'none'
      ? `<div class="card notice">
           <p><b>예식 시기를 정하시면 시점을 챙겨드릴게요.</b></p>
           <p>달만 정해두셔도 됩니다. 예약 시점은 모두 예식일을 기준으로 세어드려요.</p>
           <button class="btn btn-quiet" id="setdate">예식 시기 정하기</button>
         </div>` : ''}
    ${anchor.kind === 'month' && p.venueStatus === 'done'
      ? `<div class="card notice">
           <p><b>웨딩홀을 계약하셨으면 예식일이 있어요.</b></p>
           <p>날짜를 넣어주시면 달이 아니라 날짜로 챙겨드릴게요.</p>
           <button class="btn btn-quiet" id="setdate">예식일 넣기</button>
         </div>` : ''}

    ${next ? `
      <div class="card notice ok">
        <p><b>다음은 ${esc(next.label)}${ida(next.label)}.</b></p>
        <p>${dueLabel(next)} ${esc(next.todo)} · ${leftLabel(next)}</p>
      </div>` : ''}

    <h2 class="section-title">준비 현황
      <span class="hint">눌러서 관리하기</span>
    </h2>
    <div class="card">${rows}</div>

    <div class="btn-row">
      <button class="btn btn-quiet" id="export">내보내기</button>
      <button class="btn btn-quiet" id="import">불러오기</button>
    </div>
    <input type="file" id="file" accept="application/json" hidden />

    <p class="note">기록은 <b>이 브라우저에만</b> 저장돼요. 옮기실 때는 내보내기를 쓰세요.</p>
    ${tabBar('home')}
  `;
  const setdate = $('#setdate');
  if (setdate) setdate.onclick = () => (location.hash = '#/when');
  $('#export').onclick = doExport;
  $('#import').onclick = () => $('#file').click();
  $('#file').onchange = doImport;
  bindChrome();
}

// ── 스드메 · 정할 것 ────────────────────────────────────────────────────
// 정해진 패키지를 사는 게 아니다. 계약서가 빈칸으로 되어 있고
// (드레스 촬영 ( )벌 / 본식 ( )벌, 헤어메이크업 각 ( )회, 앨범 ( )p ( )권)
// 그 빈칸을 채우는 일이 곧 결정이다. 자료의 값은 힌트로만 보여준다.
function choiceCard() {
  const c = store.plan('sdm').choices;
  const n = choiceCount(c);
  const picked = Object.entries(c.services ?? {})
    .filter(([, on]) => on)
    .map(([k]) => k);

  // 품목 머리줄 — 무엇의 조건인지 한 줄로 갈라준다
  const head = (key) => {
    const [, label] = SDM_PARTS.find(([k]) => k === key);
    return `<div class="row grouphead"><span class="gk">${label}</span></div>`;
  };

  const yn = (key, label, hint) => `
    <div class="row optrow${hint ? ' withhint' : ''}">
      ${hint
        ? `<span class="k"><b>${label}</b><em>${esc(hint)}</em></span>`
        : `<span class="k">${label}</span>`}
      <span class="seg" data-choice3="${key}">
        ${[['yes', '할게요'], ['no', '안 함'], ['unknown', '미정']].map(([v, l]) =>
          `<button type="button" data-v="${v}" aria-pressed="${(c[key] ?? 'unknown') === v}">${l}</button>`
        ).join('')}
      </span>
    </div>`;

  const pair = (label, hint, a, b) => `
    <div class="row withhint pairrow">
      <span class="k"><b>${label}</b><em>${esc(hint)}</em></span>
      <span class="pair">
        ${[a, b].map(([key, tag, unit]) => `
          <label class="pairbox">
            <em>${tag}</em>
            <input type="number" inputmode="numeric" data-choice="${key}"
                   value="${c[key] ?? ''}" placeholder="–" />
            <em>${unit}</em>
          </label>`).join('')}
      </span>
    </div>`;

  return `
    <h2 class="section-title">정할 것
      <span class="hint">${n.done} / ${n.total} 정함</span>
    </h2>
    <div class="card">
      ${head('studio')}
      <div class="row">
        <label for="ch-album">앨범 · 액자</label>
        <input id="ch-album" type="text" data-choice-text="album" value="${esc(c.album)}"
               placeholder="20p 1권 + 20R 액자" />
      </div>
      ${yn('origin', '원본 데이터', '별도 구입')}

      ${head('dress')}
      ${pair('벌수', '촬영 3벌 · 본식 1벌이 기본',
        ['dressShoot', '촬영', '벌'], ['dressMain', '본식', '벌'])}

      ${head('makeup')}
      ${pair('횟수', '신랑 · 신부 각각 1회가 기본',
        ['hairShoot', '촬영', '회'], ['hairMain', '본식', '회'])}

      ${head('bouquet')}
      ${yn('bouquet', '부케', '부토니아 · 코사지 포함')}
    </div>

    <h2 class="section-title">받을 서비스
      <span class="hint">${picked.length ? picked.join(' · ') : '계약서 체크 항목'}</span>
    </h2>
    <div class="card">
      <div class="row" style="display:block">
        <div class="tags" data-services>
          ${SDM_SERVICES.map((name) =>
            `<button type="button" data-svc="${esc(name)}"
                     aria-pressed="${Boolean(c.services?.[name])}">${name}</button>`
          ).join('')}
        </div>
      </div>
    </div>

    ${extrasDetails()}`;
}

// 계약 금액 밖 항목 — 읽을 거리라 접어둔다. 필요할 때만 펼친다.
function extrasDetails() {
  return `
    <details class="more">
      <summary>계약 금액 밖 ${SDM_EXTRAS.length}개 — 상담에서 물어보세요</summary>
      <div class="card">
        ${SDM_PARTS.filter(([k]) => extrasOf(k).length).map(([k, label]) => `
          <div class="row grouphead"><span class="gk">${label}</span></div>
          ${extrasOf(k).map(({ label: l, hint }) => `
            <div class="row tight">
              <span class="k">${l}</span>
              ${hint ? `<span class="v mute">${esc(hint)}</span>` : ''}
            </div>`).join('')}`).join('')}
      </div>
    </details>`;
}

// 샵 정하기 — 세 줄만 두고 자세한 건 눌러 들어간다
function shopCard() {
  const picked = store.profile().pickedShops ?? {};
  const done = SHOP_PARTS.filter(([k]) => picked[k]).length;

  return `
    <h2 class="section-title">샵 정하기
      <span class="hint">${done} / ${SHOP_PARTS.length} 정함</span>
    </h2>
    <div class="card">
      ${SHOP_PARTS.map(([key, label]) => {
        const chosen = picked[key] ? store.shop(picked[key]) : null;
        const n = store.shops(key).length;
        const state = chosen
          ? esc(chosen.name || '이름 없는 샵')
          : n
            ? `${n}곳 비교 중`
            : '아직';
        return `<button class="row link${chosen ? ' ok' : ''}" data-goto="#/sdm/shop/${key}">
          <span class="k"><b>${label}</b></span>
          <span class="st${chosen ? '' : ' mute'}">${state}</span>
          <span class="arr">›</span>
        </button>`;
      }).join('')}
    </div>`;
}

// 샵 한 곳 — 후보 목록 + 정하기
function shopView(part) {
  const def = SHOP_PARTS.find(([k]) => k === part);
  if (!def) return (location.hash = '#/sdm');
  const [, label, hint] = def;
  const [feeLabel, feeHint] = SHOP_FEE[part];
  const list = store.shops(part);
  const pickedId = store.profile().pickedShops?.[part] ?? null;
  const picked = pickedId ? store.shop(pickedId) : null;

  const card = (x) => `
    <div class="cand">
      <div class="row">
        <label for="n-${x.id}">샵 이름</label>
        <input id="n-${x.id}" type="text" data-shop="${x.id}" data-f="name"
               value="${esc(x.name)}" placeholder="미입력" />
      </div>
      <div class="row">
        <label for="d-${x.id}">방문 날짜</label>
        <input id="d-${x.id}" type="date" data-shop="${x.id}" data-f="visitDate"
               value="${esc(x.visitDate)}" />
      </div>
      <div class="row${feeHint ? ' withhint' : ''}">
        ${feeHint
          ? `<span class="k"><b>${feeLabel}</b><em>${esc(feeHint)}</em></span>`
          : `<label for="f-${x.id}">${feeLabel}</label>`}
        <input id="f-${x.id}" type="number" inputmode="numeric" data-shop="${x.id}" data-f="fee"
               value="${x.fee ?? ''}" placeholder="미입력" />
      </div>
      <div class="row" style="display:block">
        <textarea data-shop="${x.id}" data-f="memo"
                  placeholder="마음에 든 점, 걸린 점 …">${esc(x.memo)}</textarea>
      </div>
      <div class="row tight">
        ${pickedId === x.id
          ? '<button class="linkish" data-unpickshop="' + part + '">다시 비교하기</button>'
          : `<button class="linkish" data-pickshop="${part}" data-id="${x.id}">이 샵으로 정했어요</button>`}
        <button class="linkish mute" data-delshop="${x.id}">삭제</button>
      </div>
    </div>`;

  app.innerHTML = `
    <button class="back" id="back">‹ 스드메</button>
    <h1 class="hero sm">${label}</h1>
    <p class="hero-sub">${esc(hint)}</p>

    ${picked ? `
      <div class="card notice ok">
        <p><b>${esc(picked.name || '이름 없는 샵')}</b>로 정하셨어요.</p>
      </div>` : ''}

    <h2 class="section-title">${picked ? '비교했던 곳' : '후보'}
      <span class="hint">${list.length}곳</span>
    </h2>
    ${list.length
      ? `<div class="card">${list.map(card).join('')}</div>`
      : '<p class="note">알아본 곳을 적어두시면 나란히 보여드려요.</p>'}

    <button class="btn btn-ghost" id="add" style="margin-top:14px">＋ 샵 추가</button>
  `;

  $('#back').onclick = () => (location.hash = '#/sdm');
  $('#add').onclick = () => { store.saveShop(blankShop(part)); render(); };

  app.querySelectorAll('[data-shop]').forEach((el) => {
    const save = () => {
      const x = { ...store.shop(el.dataset.shop) };
      const f = el.dataset.f;
      x[f] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
      store.saveShop(x);
    };
    el.oninput = save;
    if (el.type === 'date') el.onchange = save;   // 날짜 선택기는 change만 보내는 경우가 있다
  });
  app.querySelectorAll('[data-pickshop]').forEach((b) => {
    b.onclick = () => { store.pickShop(b.dataset.pickshop, b.dataset.id); render(); };
  });
  app.querySelectorAll('[data-unpickshop]').forEach((b) => {
    b.onclick = () => { store.unpickShop(b.dataset.unpickshop); render(); };
  });
  app.querySelectorAll('[data-delshop]').forEach((b) => {
    b.onclick = () => {
      if (confirm('이 샵 기록을 지울까요?')) { store.removeShop(b.dataset.delshop); render(); }
    };
  });
}

function bindChoices() {
  const sdm = () => store.plan('sdm');
  const patch = (o) => store.setPlan('sdm', { choices: { ...sdm().choices, ...o } });

  app.querySelectorAll('[data-choice3]').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { patch({ [seg.dataset.choice3]: b.dataset.v }); render(); };
    });
  });
  app.querySelectorAll('[data-choice]').forEach((el) => {
    el.oninput = () =>
      patch({ [el.dataset.choice]: el.value === '' ? null : Number(el.value) });
  });
  const album = app.querySelector('[data-choice-text]');
  if (album) album.oninput = () => patch({ album: album.value });
  app.querySelectorAll('[data-svc]').forEach((b) => {
    b.onclick = () => {
      const name = b.dataset.svc;
      const services = { ...sdm().choices.services };
      if (services[name]) delete services[name];
      else services[name] = true;
      patch({ services });
      render();
    };
  });
}

// ── 스드메 ──────────────────────────────────────────────────────────────
// 단계가 있다. 알아보기 → 업체 비교 → 계약 확정.
// 화면이 단계마다 달라진다 — 비교는 계약 전에, 촬영일·결제는 계약 후에 쓴다.
function sdmView() {
  const p = store.profile();
  const list = store.sdmVendors();
  const picked = p.pickedSdmId ? store.sdmVendor(p.pickedSdmId) : null;

  const head = `
    ${brand('스드메')}
    <p class="sub">스튜디오 · 드레스 · 헤어메이크업 · 부케</p>
    <div style="height:18px"></div>`;

  if (picked) return sdmContracted(head, p, picked, list);
  if (list.length) return sdmCompare(head, list);
  return sdmIntro(head);
}

// 1단계 — 아직 안 알아봤을 때. 상담에서 확인할 것을 먼저 알려준다.
function sdmIntro(head) {
  app.innerHTML = `
    ${head}
    ${statusCard('sdmStatus')}
    ${choiceCard()}
    ${shopCard()}

    <div class="sticky">
      <button class="btn btn-primary" id="add">업체 기록 시작하기</button>
    </div>
    ${tabBar('sdm')}
  `;
  $('#add').onclick = () => (location.hash = '#/sdm/new');
  bindStatus();
  bindChoices();
  bindChrome();
}

// 2단계 — 업체 비교. 여기서 계약을 확정한다.
function sdmCompare(head, list) {
  app.innerHTML = `
    ${head}
    ${statusCard('sdmStatus')}
    ${choiceCard()}
    ${shopCard()}

    <h2 class="section-title">받은 견적
      <span class="hint">${list.length}곳</span>
    </h2>
    <div class="card">${list.map(sdmCard).join('')}</div>
    <button class="btn btn-ghost" id="add" style="margin-top:14px">＋ 업체 기록하기</button>

    ${list.length >= 2
      ? sdmTable(list)
      : '<p class="note">한 곳 더 적으면 <b>비교표</b>가 나타납니다.</p>'}

    <p class="note"><b>실제 예상</b> = 받은 견적 + 적어둔 별도 비용</p>
    ${extrasDetails()}
    ${tabBar('sdm')}
  `;
  $('#add').onclick = () => (location.hash = '#/sdm/new');
  bindStatus();
  bindChoices();
  bindPick('sdm');
  bindChrome();
}

// 3단계 — 계약 확정. 촬영일이 기준이 되고 결제·위약금 날짜가 나온다.
function sdmContracted(head, p, picked, list) {
  const s = store.plan('sdm');
  const d = sdmDates(s, p);
  const t = sdmTotal(picked);
  const others = list.filter((v) => v.id !== picked.id);

  app.innerHTML = `
    ${head}
    <div class="card notice ok">
      <p><b>${esc(picked.name || '이름 없는 업체')}</b>와 계약하셨어요.</p>
      <p>실제 예상 ${t.ok ? won(t.sum) + '원' : '금액 미입력'}${
        t.missing ? ` · 별도 ${t.missing}개 미입력` : ''
      }</p>
      <div class="btn-row">
        <button class="btn btn-quiet" data-go-sdm="${picked.id}">계약 내용 보기</button>
        <button class="btn btn-quiet" data-unpick="sdm">다시 비교하기</button>
      </div>
    </div>

    <h2 class="section-title">촬영일
      <span class="hint">예식일과 별개 기준일</span>
    </h2>
    <div class="card">
      ${dateRow('shootDate', '웨딩 촬영', s.shootDate,
        '헤어·메이크업 3시간 + 촬영 4시간 · 의상 4벌')}
      ${d.penalty
        ? `<div class="row"><span class="k">위약금 시작</span>
             <span class="v">${mdLabel(d.penalty)}</span></div>`
        : ''}
      ${d.mid
        ? `<div class="row"><span class="k">중도금 ${SDM_MID_PCT}%</span>
             <span class="v">${mdLabel(d.mid)}</span></div>`
        : ''}
      ${d.final
        ? `<div class="row"><span class="k">잔금 ${SDM_FINAL_PCT}%</span>
             <span class="v">${mdLabel(d.final)}</span></div>`
        : ''}
    </div>
    <p class="formula">
      ${s.shootDate
        ? `위약금은 촬영 ${SDM_PENALTY_DAYS}일 전부터 · 중도금은 촬영 ${SDM_MID_DAYS}일 전 ·
           잔금은 본식 ${SDM_FINAL_DAYS}일 전${d.final ? '' : ' (예식일을 넣으면 계산해드려요)'}`
        : '촬영일을 넣으면 위약금 경계와 중도금 날짜를 계산해드려요'}
    </p>

    ${choiceCard()}
    ${shopCard()}

    <h2 class="section-title">준비 단계</h2>
    <div class="card">
      ${SDM_STEPS.map(([k, label, hint]) => dateRow(k, label, s[k], hint)).join('')}
    </div>

    <details class="more">
      <summary>계약 금액 밖 ${SDM_EXTRAS.length}개 — 적어둔 금액</summary>
      <div class="card">
        ${SDM_PARTS.filter(([k]) => extrasOf(k).length).map(([k, label]) => `
          <div class="row grouphead"><span class="gk">${label}</span></div>
          ${extrasOf(k).map(({ key, label: l }) => {
            const x = picked.extras?.[key];
            const has = !(x === null || x === '' || x === undefined);
            return `<div class="row tight">
              <span class="k">${l}</span>
              <span class="v${has ? '' : ' none'}">${has ? won(x) + '원' : '미입력'}</span>
            </div>`;
          }).join('')}`).join('')}
      </div>
      <p class="note">
        <button class="linkish" data-go-sdm="${picked.id}">계약 내용</button>에서 고칠 수 있어요.
      </p>
    </details>

    ${others.length ? `
      <h2 class="section-title">비교했던 곳
        <span class="hint">${others.length}곳</span>
      </h2>
      <div class="card">${others.map(sdmCard).join('')}</div>` : ''}

    <h2 class="section-title">메모</h2>
    <div class="card">
      <div class="row" style="display:block">
        <textarea data-memo placeholder="담당 플래너, 전달받은 것 …">${esc(s.memo)}</textarea>
      </div>
    </div>
    ${tabBar('sdm')}
  `;

  app.querySelectorAll('[data-date]').forEach((el) => {
    el.onchange = () => { store.setPlan('sdm', { [el.dataset.date]: el.value }); render(); };
  });
  const memo = app.querySelector('[data-memo]');
  memo.oninput = () => store.setPlan('sdm', { memo: memo.value });
  bindChoices();
  bindPick('sdm');
  bindChrome();
}

// 후보 한 장
function sdmCard(v) {
  const t = sdmTotal(v);
  const p = store.profile();
  const isPicked = p.pickedSdmId === v.id;
  return `
    <div class="cand">
      <button class="venue" data-go-sdm="${v.id}">
        <div class="name">${esc(v.name || '이름 없는 업체')}${
          isPicked ? ' <span class="chip on">계약</span>' : ''
        }</div>
        <div class="meta">${
          v.consultDate ? esc(dateLabel(v.consultDate)) + ' 상담' : '상담 날짜 미입력'
        }</div>
        <div class="sum${t.ok ? '' : ' none'}">${
          t.ok ? won(t.sum) + '원' : '견적 금액 미입력'
        }${t.ok && t.missing ? ` <em>별도 ${t.missing}개 미입력</em>` : ''}</div>
      </button>
      ${isPicked ? '' : `
        <button class="linkish pick" data-pick-sdm="${v.id}">이 업체로 계약했어요</button>`}
    </div>`;
}

// 비교표 — 품목별로 묶어 나란히 놓는다.
// 뭉쳐 놓으면 어느 품목의 조건인지 알 수 없다.
function sdmTable(list) {
  const head = list
    .map((v) => `<th class="col">${esc(v.name || '이름 없음')}
        <span class="date">${v.consultDate ? esc(dateLabel(v.consultDate)) : '날짜 미입력'}</span></th>`)
    .join('');

  const cells = (pick) => list.map(pick).join('');

  const money = (label, get) =>
    `<tr><th class="k">${label}</th>${cells((v) => {
      const x = get(v);
      return x === null || x === '' || x === undefined
        ? '<td class="empty">미입력</td>'
        : `<td class="num">${won(x)}원</td>`;
    })}</tr>`;

  const count = (label, get, unit) =>
    `<tr><th class="k">${label}</th>${cells((v) => {
      const x = get(v);
      return x === null || x === '' || x === undefined
        ? '<td class="empty">미입력</td>'
        : `<td class="num">${x}${unit}</td>`;
    })}</tr>`;

  const text = (label, get) =>
    `<tr><th class="k">${label}</th>${cells((v) =>
      get(v) ? `<td class="wrap">${esc(get(v))}</td>` : '<td class="empty">미입력</td>'
    )}</tr>`;

  const tri = (label, get) =>
    `<tr><th class="k">${label}</th>${cells((v) => {
      const x = get(v);
      return x === 'yes' ? '<td class="yes">포함</td>'
        : x === 'no' ? '<td class="no">별도</td>'
        : '<td class="empty">모름</td>';
    })}</tr>`;

  const group = (key) => {
    const [, label] = SDM_PARTS.find(([k]) => k === key);
    return `<tr class="grp"><th class="k" colspan="${list.length + 1}">${label}</th></tr>`;
  };

  return `
    <h2 class="section-title">비교
      <span class="hint">품목별로</span>
    </h2>
    <div class="card compare-scroll">
      <table class="compare">
        <thead><tr><th class="k"></th>${head}</tr></thead>
        <tbody>
          ${money('견적 금액', (v) => v.quotePrice)}

          ${group('studio')}
          ${text('앨범 · 액자', (v) => v.album)}
          ${extrasOf('studio').map((x) => money(x.label, (v) => v.extras?.[x.key])).join('')}

          ${group('dress')}
          ${count('촬영 벌수', (v) => v.shootDress, '벌')}
          ${count('본식 벌수', (v) => v.mainDress, '벌')}
          ${extrasOf('dress').map((x) => money(x.label, (v) => v.extras?.[x.key])).join('')}

          ${group('makeup')}
          ${count('촬영 횟수', (v) => v.hairShoot, '회')}
          ${count('본식 횟수', (v) => v.hairMain, '회')}
          ${extrasOf('makeup').map((x) => money(x.label, (v) => v.extras?.[x.key])).join('')}

          ${group('bouquet')}
          ${tri('부케', (v) => v.bouquet)}

          <tr class="total-row"><th class="k">별도 합계</th>${cells((v) =>
            `<td class="num">${won(sdmTotal(v).extraSum)}원</td>`)}</tr>
          <tr class="total-row"><th class="k">실제 예상</th>${cells((v) => {
            const t = sdmTotal(v);
            return t.ok
              ? `<td class="num">${won(t.sum)}원</td>`
              : '<td class="empty">계산 불가</td>';
          })}</tr>
        </tbody>
      </table>
    </div>`;
}

// ── 스드메 업체 기록 ────────────────────────────────────────────────────
function sdmEdit(id) {
  const existing = id ? store.sdmVendor(id) : null;
  if (id && !existing) return (location.hash = '#/sdm');
  const v = existing ? { ...existing, extras: { ...existing.extras } } : blankSdm();
  const isNew = !existing;
  const picked = store.profile().pickedSdmId === v.id;
  const c = store.plan('sdm').choices;   // 정해둔 조건을 힌트로 보여준다

  const money = (key, label, hint = '') => `
    <div class="row${hint ? ' withhint' : ''}">
      ${hint
        ? `<span class="k"><b>${label}</b><em>${esc(hint)}</em></span>`
        : `<label for="${key}">${label}</label>`}
      <input id="${key}" type="number" inputmode="numeric" data-x="${key}"
             value="${v[key] ?? ''}" placeholder="미입력" />
    </div>`;

  // 정해둔 값이 있으면 힌트로 붙인다 — 업체가 그보다 적게 주면 그 자리에서 보인다
  const numWithChoice = (key, label, decided, unit) => `
    <div class="row${decided === null || decided === undefined ? '' : ' withhint'}">
      ${decided === null || decided === undefined
        ? `<label for="${key}">${label} (${unit})</label>`
        : `<span class="k"><b>${label} (${unit})</b><em>정하신 건 ${decided}${unit}</em></span>`}
      <input id="${key}" type="number" inputmode="numeric" data-x="${key}"
             value="${v[key] ?? ''}" placeholder="미입력" />
    </div>`;

  // 별도 항목 — 라벨만. 설명은 '정할 것' 화면에 접어둔 목록에 한 번 있다.
  const extraRow = ({ key, label }) => `
    <div class="row">
      <label for="x-${key}">${label} <span class="tag">별도</span></label>
      <input id="x-${key}" type="number" inputmode="numeric" data-extra="${key}"
             value="${v.extras?.[key] ?? ''}" placeholder="미입력" />
    </div>`;

  app.innerHTML = `
    <button class="back" id="back">‹ 스드메</button>
    <h1 class="hero sm">${isNew ? '업체 기록' : esc(v.name || '업체 기록')}</h1>
    <p class="hero-sub">받은 견적을 그대로 적어보세요 · 자동 저장돼요</p>

    <div class="card">
      <div class="row">
        <label for="name">업체 이름</label>
        <input id="name" type="text" data-x="name" value="${esc(v.name)}"
               placeholder="예: ○○웨딩" ${isNew ? 'autofocus' : ''} />
      </div>
      <div class="row">
        <label for="consultDate">상담 날짜</label>
        <input id="consultDate" type="date" data-x="consultDate" value="${esc(v.consultDate)}" />
      </div>
    </div>

    <h2 class="section-title">받은 견적 <span class="hint">정하신 조건으로</span></h2>
    <div class="card">
      ${money('quotePrice', '견적 금액')}
    </div>

    <h2 class="section-title">품목별 <span class="hint">업체가 주는 구성</span></h2>
    <div class="card">
      <div class="row grouphead"><span class="gk">스튜디오</span></div>
      <div class="row${c.album ? ' withhint' : ''}">
        ${c.album
          ? `<span class="k"><b>앨범 · 액자</b><em>정하신 건 ${esc(c.album)}</em></span>`
          : '<label for="album">앨범 · 액자</label>'}
        <input id="album" type="text" data-x="album" value="${esc(v.album)}"
               placeholder="예: 20p 1권 + 20R 액자" />
      </div>
      ${extrasOf('studio').map(extraRow).join('')}

      <div class="row grouphead"><span class="gk">드레스</span></div>
      ${numWithChoice('shootDress', '촬영 벌수', c.dressShoot, '벌')}
      ${numWithChoice('mainDress', '본식 벌수', c.dressMain, '벌')}
      ${extrasOf('dress').map(extraRow).join('')}

      <div class="row grouphead"><span class="gk">헤어 · 메이크업</span></div>
      ${numWithChoice('hairShoot', '촬영 횟수', c.hairShoot, '회')}
      ${numWithChoice('hairMain', '본식 횟수', c.hairMain, '회')}
      ${extrasOf('makeup').map(extraRow).join('')}

      <div class="row grouphead"><span class="gk">부케</span></div>
      <div class="row">
        <span class="k">견적에 포함</span>
        <span class="seg" data-tri="bouquet">
          ${[['yes', '포함'], ['no', '별도'], ['unknown', '모름']].map(([val, txt]) =>
            `<button type="button" data-v="${val}"
                     aria-pressed="${(v.bouquet ?? 'unknown') === val}">${txt}</button>`
          ).join('')}
        </span>
      </div>

      <div class="row total">
        <span class="k"><b>실제 예상</b></span>
        <span class="v" id="sdm-total"></span>
      </div>
    </div>
    <p class="formula">모르는 항목은 비워두세요</p>

    <h2 class="section-title">메모</h2>
    <div class="card">
      <div class="row" style="display:block">
        <textarea data-x="memo" placeholder="담당자, 들은 조건, 마음에 걸린 것 …">${esc(v.memo)}</textarea>
      </div>
    </div>

    <div class="sticky">
      <button class="btn btn-primary" id="done">${
        picked ? '저장' : '저장하고 비교표로'
      }</button>
      ${picked
        ? '<button class="linkish ob-skip" data-unpick="sdm">계약 취소하고 다시 비교</button>'
        : `<button class="linkish ob-skip" data-pick-sdm="${v.id}">이 업체로 계약했어요</button>`}
    </div>

    ${existing ? '<button class="danger" id="del">이 업체 기록 삭제</button>' : ''}
  `;

  const refresh = () => {
    const t = sdmTotal(v);
    const el = $('#sdm-total');
    el.textContent = t.ok ? won(t.sum) + '원' : '견적 금액을 넣어주세요';
    el.style.color = t.ok ? 'var(--rose)' : 'var(--mute)';
    el.style.fontSize = t.ok ? '16px' : '12px';
  };
  const persist = () => store.saveSdm(v);

  app.querySelectorAll('[data-x]').forEach((el) => {
    el.oninput = () => {
      const k = el.dataset.x;
      v[k] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
      persist();
      refresh();
    };
  });
  app.querySelectorAll('[data-extra]').forEach((el) => {
    el.oninput = () => {
      v.extras[el.dataset.extra] = el.value === '' ? null : Number(el.value);
      persist();
      refresh();
    };
  });
  app.querySelectorAll('[data-tri]').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { v[seg.dataset.tri] = b.dataset.v; persist(); sdmEdit(v.id); };
    });
  });

  $('#back').onclick = () => { persist(); location.hash = '#/sdm'; };
  $('#done').onclick = () => { persist(); location.hash = '#/sdm'; };
  if (existing) {
    $('#del').onclick = () => {
      if (confirm(`'${v.name || '이 업체'}' 기록을 지울까요?`)) {
        store.removeSdm(v.id);
        location.hash = '#/sdm';
      }
    };
  }
  bindPick('sdm');
  refresh();
}

// 확정 · 확정 취소는 여러 화면에서 쓴다
function bindPick(kind) {
  app.querySelectorAll(`[data-pick-${kind}]`).forEach((b) => {
    b.onclick = () => {
      const id = b.dataset[kind === 'sdm' ? 'pickSdm' : 'pickVenue'];
      store.pick(kind, id);
      // 웨딩홀을 확정하면 예식일이 생긴다. 아직 안 적었으면 바로 물어본다.
      if (kind === 'venue' && !store.profile().ceremonyDate) {
        location.hash = '#/when';
        return;
      }
      location.hash = kind === 'sdm' ? '#/sdm' : '#/venues';
      render();
    };
  });
  app.querySelectorAll('[data-unpick]').forEach((b) => {
    b.onclick = () => {
      if (!confirm('계약 확정을 취소하고 다시 비교할까요?\n적어둔 기록은 그대로 있어요.')) return;
      store.unpick(b.dataset.unpick);
      render();
    };
  });
  app.querySelectorAll('[data-go-sdm]').forEach((b) => {
    b.onclick = () => (location.hash = '#/sdm/v/' + b.dataset.goSdm);
  });
}

// ── 허니문 ──────────────────────────────────────────────────────────────
// 자료에 적힌 것은 한 줄이다 — 신혼여행비 · 추가지출 · 예비비(선물비), 6~8개월 전.
// 없는 항목을 만들어 넣지 않고, 날짜와 금액만 받는다.
function honeymoonView() {
  const p = store.profile();
  const h = store.plan('honeymoon');
  const { sum, missing } = honeymoonTotal(h);

  // 예식일과의 간격 — 둘 다 있을 때만
  let gap = '';
  if (h.departDate && p.ceremonyDate) {
    const n = Math.round(
      (new Date(h.departDate + 'T00:00:00') - new Date(p.ceremonyDate + 'T00:00:00')) / 86400000
    );
    gap = n === 0 ? '예식 당일 출발' : n > 0 ? `예식 ${n}일 후 출발` : `예식 ${-n}일 전 출발`;
  }
  let nights = '';
  if (h.departDate && h.returnDate) {
    const n = Math.round(
      (new Date(h.returnDate + 'T00:00:00') - new Date(h.departDate + 'T00:00:00')) / 86400000
    );
    if (n >= 0) nights = `${n}박 ${n + 1}일`;
  }

  app.innerHTML = `
    ${brand('허니문')}
    <p class="sub">신혼여행지 · 예비비</p>
    <div style="height:18px"></div>
    ${statusCard('honeymoonStatus')}

    <h2 class="section-title">일정
      ${nights ? `<span class="hint">${nights}</span>` : ''}
    </h2>
    <div class="card">
      <div class="row">
        <label for="place">여행지</label>
        <input id="place" type="text" data-text="place" value="${esc(h.place)}"
               placeholder="미입력" />
      </div>
      ${dateRow('departDate', '출발', h.departDate, gap)}
      ${dateRow('returnDate', '귀국', h.returnDate)}
    </div>

    <h2 class="section-title">비용 <span class="hint">적어두신 것만 더해요</span></h2>
    <div class="card">
      ${HONEYMOON_COSTS.map(([k, label]) => numRow(k, label, h[k])).join('')}
      <div class="row total">
        <span class="k"><b>입력한 금액 합계</b></span>
        <span class="v">${missing === HONEYMOON_COSTS.length ? '미입력' : won(sum) + '원'}</span>
      </div>
    </div>
    ${missing && missing < HONEYMOON_COSTS.length
      ? `<p class="formula">안 적은 항목 ${missing}개는 합계에서 빠졌어요</p>`
      : ''}

    <h2 class="section-title">메모</h2>
    <div class="card">
      <div class="row" style="display:block">
        <textarea data-memo placeholder="항공, 숙소, 알아본 것 …">${esc(h.memo)}</textarea>
      </div>
    </div>
    ${tabBar('honeymoon')}
  `;

  app.querySelectorAll('[data-date]').forEach((el) => {
    el.onchange = () => { store.setPlan('honeymoon', { [el.dataset.date]: el.value }); render(); };
  });
  app.querySelectorAll('[data-num]').forEach((el) => {
    el.oninput = () =>
      store.setPlan('honeymoon', { [el.dataset.num]: el.value === '' ? null : Number(el.value) });
  });
  const place = app.querySelector('[data-text]');
  place.oninput = () => store.setPlan('honeymoon', { place: place.value });
  const memo = app.querySelector('[data-memo]');
  memo.oninput = () => store.setPlan('honeymoon', { memo: memo.value });
  bindStatus();
  bindChrome();
}

// ── 혼수 ────────────────────────────────────────────────────────────────
// 탭까지 두지는 않는다. 홈의 준비 현황에서 눌러 들어온다.
//
// 혼수도 사 오는 게 아니라 품목마다 고르는 일이다. 자료의 `내용` 열에
// 갈래가 적혀 있어 그대로 선택지가 된다.
// 시점 기준도 예식일이 아니다 — 한복은 촬영일, 살림은 입주일에서 나온다.
// 품목에 무엇이 들어가는지 — 읽을 거리라 접어둔다
function honsuDetails() {
  return `
    <details class="more">
      <summary>품목에 뭐가 들어가나요</summary>
      <div class="card">
        ${HONSU_CHOICES.map(({ label, hint }) => `
          <div class="row tight">
            <span class="k">${label}</span>
            <span class="v mute">${esc(hint)}</span>
          </div>`).join('')}
        <div class="row tight">
          <span class="k">신혼집 살림</span>
          <span class="v mute">신혼집에 맞춰 · 입주일 기준</span>
        </div>
      </div>
    </details>`;
}

function honsuView() {
  const h = store.plan('honsu');
  const sdm = store.plan('sdm');
  const n = honsuCount(h);
  const hm = homeCount(h);
  const d = honsuDates(h, sdm);

  const choiceRow = ({ key, label, short, opts }) => `
    <div class="row optrow${short ? ' withhint' : ''}">
      ${short
        ? `<span class="k"><b>${label}</b><em>${esc(short)}</em></span>`
        : `<span class="k">${label}</span>`}
      <span class="seg" data-honsu="${key}">
        ${opts.map(([v, l]) =>
          `<button type="button" data-v="${v}" aria-pressed="${(h[key] ?? 'unknown') === v}">${l}</button>`
        ).join('')}
        <button type="button" data-v="unknown"
                aria-pressed="${(h[key] ?? 'unknown') === 'unknown'}">미정</button>
      </span>
    </div>`;

  app.innerHTML = `
    <button class="back" id="back">‹ 홈</button>
    <h1 class="hero sm">혼수</h1>
    <p class="hero-sub">한복 · 웨딩반지 · 예복 · 예단 · 가전/가구</p>
    ${statusCard('honsuStatus')}

    <h2 class="section-title">정할 것
      <span class="hint">${n.done} / ${n.total} 정함</span>
    </h2>
    <div class="card">
      ${HONSU_CHOICES.map(choiceRow).join('')}
    </div>
    ${d.hanbok
      ? `<p class="formula">한복은 <b>${mdLabel(d.hanbok)}까지</b> 맞추거나 빌리세요 ·
           촬영 2개월 전이에요</p>`
      : `<p class="formula">한복은 촬영 2개월 전이에요.
           <button class="linkish" id="go-sdm">스드메에서 촬영일</button>을 넣으면 날짜로 알려드려요</p>`}

    <h2 class="section-title">신혼집 살림
      <span class="hint">${hm.done} / ${hm.total} 정함</span>
    </h2>
    <div class="card">
      ${dateRow('moveInDate', '입주 예정일', h.moveInDate,
        d.home ? `${mdLabel(d.home)}까지 준비하세요 · 입주 2개월 전` : '입주 2~3개월 전에 준비해요')}
      ${HOME_ITEMS.map(([k, label]) => `
        <div class="row optrow">
          <span class="k">${label}</span>
          <span class="seg" data-home="${k}">
            ${[['yes', '준비'], ['no', '생략'], ['unknown', '미정']].map(([v, l]) =>
              `<button type="button" data-v="${v}" aria-pressed="${(h.home?.[k] ?? 'unknown') === v}">${l}</button>`
            ).join('')}
          </span>
        </div>`).join('')}
    </div>
    ${honsuDetails()}
  `;

  $('#back').onclick = () => (location.hash = '#/');
  const goSdm = $('#go-sdm');
  if (goSdm) goSdm.onclick = () => (location.hash = '#/sdm');

  app.querySelectorAll('[data-honsu]').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { store.setPlan('honsu', { [seg.dataset.honsu]: b.dataset.v }); render(); };
    });
  });
  app.querySelectorAll('[data-home]').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        store.setPlan('honsu', { home: { ...h.home, [seg.dataset.home]: b.dataset.v } });
        render();
      };
    });
  });
  app.querySelectorAll('[data-date]').forEach((el) => {
    el.onchange = () => { store.setPlan('honsu', { [el.dataset.date]: el.value }); render(); };
  });
  bindStatus();
}

// ── 웨딩홀 기록이 0곳일 때 ───────────────────────────────────────────────
// 빈 비교표를 보여주는 대신 갈래를 나눈다.
function venueEmptyView() {
  app.innerHTML = `
    ${brand('웨딩홀')}
    <p class="sub">정할 것 — 어느 예식장</p>
    <h1 class="hero sm" style="margin-top:22px">웨딩홀 정보를<br />적어주세요</h1>
    <p class="hero-sub">
      <b>어느 예식장으로 할지</b>가 가장 큰 결정이에요.
      받은 견적을 그대로 적으면 실제로 얼마인지 계산해서 나란히 비교해드려요.
    </p>

    <div class="card choice">
      <button class="choice-row" id="go-record">
        <span class="ico">📝</span>
        <span class="txt">
          <b>웨딩홀 기록하기</b>
          <em>알아본 곳을 적어둘게요</em>
        </span>
        <span class="arr">›</span>
      </button>
      <button class="choice-row" id="go-guide">
        <span class="ico">🔍</span>
        <span class="txt">
          <b>무엇을 확인할지 보기</b>
          <em>홀에 물어볼 것을 짚어드려요</em>
        </span>
        <span class="arr">›</span>
      </button>
    </div>

    <button class="btn btn-quiet" id="demo" style="margin-top:12px">
      예시로 먼저 둘러보기
    </button>
    ${tabBar('venue')}
  `;
  $('#go-record').onclick = () => (location.hash = '#/new');
  $('#go-guide').onclick = () => (location.hash = '#/guide');
  $('#demo').onclick = () => { store.loadSample(); location.hash = '#/venues'; render(); };
  bindChrome();
}

// ── 웨딩홀에서 확인할 것 ─────────────────────────────────────────────────
// 항목은 박람회 자료의 웨딩홀 구성에서 왔지만, 화면에서는 앱이 직접 챙겨준다.
function guideView() {
  app.innerHTML = `
    <button class="back" id="back">‹ 웨딩홀</button>
    <h1 class="hero sm">웨딩홀에서 확인할 것</h1>
    <p class="hero-sub">
      이것만 물어보시면 돼요. 확인한 그대로 비교표가 됩니다.
    </p>

    <h2 class="section-title">금액</h2>
    <div class="card">
      <div class="row ask"><span class="k"><b>홀 사용료</b><em>신부대기실 · 폐백실 · 혼구용품이 포함인지</em></span></div>
      <div class="row ask"><span class="k"><b>꽃장식</b><em>단상 · 꽃길 · 꽃아치 · 테이블세팅까지 어디까지인지</em></span></div>
      <div class="row ask"><span class="k"><b>식대 (1인)</b><em>가장 크게 벌어지는 항목이에요</em></span></div>
      <div class="row ask"><span class="k"><b>최소 보증인원</b><em>몇 명부터 계약이 되는지</em></span></div>
    </div>
    <p class="formula">홀 사용료 + 꽃장식 + (보증인원 × 식대) = 예상 합계</p>

    <h2 class="section-title">시설</h2>
    <div class="card">
      <div class="row ask"><span class="k"><b>신부대기실</b></span></div>
      <div class="row ask"><span class="k"><b>폐백실</b><em>폐백을 하실 거면 꼭 확인하세요</em></span></div>
      <div class="row ask"><span class="k"><b>혼구용품</b></span></div>
    </div>

    <h2 class="section-title">놓치기 쉬운 것</h2>
    <div class="card">
      <div class="row ask"><span class="k"><b>보증인원 최종 결정 시점</b><em>예식 2~3주 전에 확정하시면 돼요</em></span></div>
      <div class="row ask"><span class="k"><b>예약 시점</b><em>늦어도 10개월 전에 예약하세요</em></span></div>
      <div class="row ask"><span class="k"><b>위약금 기준</b><em>며칠 전부터 발생하는지</em></span></div>
    </div>

    <p class="note">다 못 물어봐도 괜찮아요. 기록할 때 <b>모름</b>으로 남기시면 돼요.</p>

    <div class="sticky">
      <button class="btn btn-primary" id="record">웨딩홀 기록하기</button>
    </div>
  `;
  $('#back').onclick = () => (location.hash = '#/venues');
  $('#record').onclick = () => (location.hash = '#/new');
}

// ── 웨딩홀 — 정할 것은 하나, 어느 예식장이냐 ────────────────────────────
// 예식장 선택이 가장 큰 결정이다. 꽃장식 · 식대 · 시설은 홀을 정한 뒤에
// 고르는 옵션이라, 정하기 전에는 화면에 비교 중인 곳만 둔다.
function venueListView() {
  const venues = store.venues();
  if (!venues.length) return venueEmptyView();

  const p = store.profile();
  const picked = p.pickedVenueId ? store.venue(p.pickedVenueId) : null;
  const hasSample = venues.some((v) => v.sample);
  const venueLate = prepStatus(p).filter((c) => c.state === 'late' && c.key === 'venueStatus');
  const others = picked ? venues.filter((v) => v.id !== picked.id) : venues;

  // 비교 중인 곳은 예상 합계가 싼 순으로 세운다. 금액이 덜 찬 곳은 뒤로.
  const ranked = [...others].sort((a, b) => {
    const ta = total(a);
    const tb = total(b);
    if (ta === null) return tb === null ? 0 : 1;
    if (tb === null) return -1;
    return ta - tb;
  });
  const best = ranked.find((v) => total(v) !== null) ?? null;

  const card = (v) => {
    const t = total(v);
    const cheapest = !picked && best && v.id === best.id && ranked.length >= 2;
    return `
      <div class="cand">
        <button class="venue" data-go="${v.id}">
          <div class="name">${esc(v.name || '이름 없는 웨딩홀')}${
            cheapest ? ' <span class="chip on">가장 저렴</span>' : ''
          }${v.sample ? ' <span class="chip">예시</span>' : ''}</div>
          <div class="sum${t === null ? ' none' : ''}">${
            t === null ? '금액이 덜 채워졌어요' : won(t) + '원'
          }</div>
          <div class="meta">${esc(mealLine(v))}</div>
        </button>
        <button class="linkish pick" data-pick-venue="${v.id}">이 홀로 예약했어요</button>
      </div>`;
  };

  app.innerHTML = `
    ${brand('웨딩홀')}
    <p class="sub">${picked ? '정한 예식장과 옵션' : '정할 것 — 어느 예식장'}</p>
    <div style="height:18px"></div>
    ${ddayCard(p, venueLate)}

    ${picked ? `
      <div class="card notice ok">
        <p><b>${esc(picked.name || '이름 없는 웨딩홀')}</b>로 정하셨어요.</p>
        <p>예상 합계 ${total(picked) === null ? '금액 미입력' : won(total(picked)) + '원'}</p>
        <div class="btn-row">
          <button class="btn btn-quiet" data-go="${picked.id}">계약 내용 보기</button>
          <button class="btn btn-quiet" data-unpick="venue">다시 정하기</button>
        </div>
      </div>
      ${p.ceremonyDate ? '' : `
        <div class="card notice gap">
          <p><b>예식일을 넣어주세요.</b></p>
          <p>계약서에 적힌 날짜를 넣으면 남은 준비 시점을 날짜로 챙겨드려요.</p>
          <button class="btn btn-quiet" data-when-btn>예식일 넣기</button>
        </div>`}
      ${optionCard(picked)}
    ` : `
      <h2 class="section-title">비교 중인 곳 <span class="hint">${ranked.length}곳</span></h2>
      <div class="card">${ranked.map(card).join('')}</div>
      <button class="btn btn-ghost" id="add" style="margin-top:14px">＋ 웨딩홀 기록하기</button>
      ${ranked.length >= 2 ? `
        <details class="more">
          <summary>항목별로 비교하기</summary>
          ${compareTable(ranked, '')}
        </details>`
        : '<p class="note">한 곳 더 적으면 <b>나란히 비교</b>해드려요.</p>'}
      <p class="note">꽃장식 · 식대 · 시설 같은 옵션은 홀을 정한 뒤에 고르시면 돼요.</p>
    `}

    ${hasSample ? `
      <div class="card notice sample gap">
        <p><b>예시 데이터로 둘러보는 중이에요.</b></p>
        <p>비교표가 어떻게 보이는지 보여드리려고 넣어둔 값입니다.</p>
        <button class="btn btn-quiet" id="clear-sample">지우고 내 기록 시작하기</button>
      </div>` : ''}

    ${picked && others.length ? `
      <details class="more">
        <summary>비교했던 곳 ${others.length}곳</summary>
        <div class="card">${others.map(card).join('')}</div>
        ${venues.length >= 2 ? compareTable(venues) : ''}
      </details>` : ''}
    ${picked
      ? '<button class="btn btn-ghost" id="add" style="margin-top:14px">＋ 웨딩홀 기록하기</button>'
      : ''}
    ${statusCard('venueStatus')}

    <p class="note"><button class="linkish" id="guide">웨딩홀에서 확인할 것 보기</button></p>
    ${tabBar('venue')}
  `;

  $('#add').onclick = () => (location.hash = '#/new');
  $('#guide').onclick = () => (location.hash = '#/guide');
  app.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => (location.hash = '#/v/' + b.dataset.go);
  });
  const whenBtn = app.querySelector('[data-when-btn]');
  if (whenBtn) whenBtn.onclick = () => (location.hash = '#/when');
  if (hasSample) {
    $('#clear-sample').onclick = () => {
      if (confirm('예시 데이터를 지울까요?')) { store.clearSample(); render(); }
    };
  }
  bindStatus();
  bindPick('venue');
  bindChrome();
}

// 카드 한 줄 요약 — 합계가 왜 그 금액인지 알려주는 두 값만.
function mealLine(v) {
  const meal = v.mealPrice === null || v.mealPrice === ''
    ? '식대 미입력' : `식대 ${won(v.mealPrice)}원`;
  const g = v.guarantee === null || v.guarantee === ''
    ? '보증인원 미입력' : `보증 ${won(v.guarantee)}명`;
  return `${meal} · ${g}`;
}

// 홀을 정한 뒤 남는 것은 옵션 선택뿐이다. 기록한 값을 그대로 보여준다.
function optionCard(v) {
  const money = (label, key, hint) => {
    const blank = v[key] === null || v[key] === '';
    return `
      <div class="row${hint ? ' withhint' : ''}">
        <span class="k"><b>${label}</b>${hint ? `<em>${hint}</em>` : ''}</span>
        <span class="st${blank ? ' mute' : ''}">${
          blank ? '미정' : won(v[key]) + '원'
        }</span>
      </div>`;
  };
  const tri = ([key, label]) => {
    const val = v[key] === 'yes' ? '포함' : v[key] === 'no' ? '없음' : '미확인';
    return `
      <div class="row">
        <span class="k">${label}</span>
        <span class="st${v[key] === 'unknown' ? ' mute' : ''}">${val}</span>
      </div>`;
  };

  return `
    <h2 class="section-title">옵션</h2>
    <div class="card">
      ${money('꽃장식', 'flowers', '단상 · 꽃길 · 테이블세팅 범위')}
      ${money('식대 (1인)', 'mealPrice', `보증인원 ${
        v.guarantee === null || v.guarantee === '' ? '미정' : won(v.guarantee) + '명'
      }`)}
      ${INCLUDES.map(tri).join('')}
    </div>
    <p class="note">
      옵션은 홀과 상의해 정하시면 돼요. 정해지면
      <button class="linkish" data-go="${v.id}">기록을 고쳐주세요</button>
    </p>`;
}

function compareTable(venues, title = '비교') {
  const head = venues
    .map((v) => `<th class="col">${esc(v.name || '이름 없음')}
        <span class="date">${v.tourDate ? esc(dateLabel(v.tourDate)) : '날짜 미입력'}</span></th>`)
    .join('');

  const moneyRow = (label, key, suffix = '') =>
    `<tr><th class="k">${label}</th>${venues
      .map((v) =>
        v[key] === null || v[key] === ''
          ? '<td class="empty">미입력</td>'
          : `<td class="num">${won(v[key])}${suffix}</td>`
      )
      .join('')}</tr>`;

  const triRow = ([key, label]) =>
    `<tr><th class="k">${label}</th>${venues
      .map((v) => {
        if (v[key] === 'yes') return '<td class="yes">있음</td>';
        if (v[key] === 'no') return '<td class="no">없음</td>';
        return '<td class="empty">모름</td>';
      })
      .join('')}</tr>`;

  return `
    ${title ? `<h2 class="section-title">${title}</h2>` : ''}
    <div class="card"><div class="compare-scroll">
      <table class="compare">
        <thead><tr><th class="k"></th>${head}</tr></thead>
        <tbody>
          ${moneyRow('홀 사용료', 'hallFee')}
          ${moneyRow('꽃장식', 'flowers')}
          ${moneyRow('식대 (1인)', 'mealPrice')}
          ${moneyRow('보증인원', 'guarantee', '명')}
          <tr class="total-row"><th class="k">예상 합계</th>${venues
            .map((v) => {
              const t = total(v);
              return t === null
                ? '<td class="empty">계산 불가</td>'
                : `<td class="num">${won(t)}</td>`;
            })
            .join('')}</tr>
          ${INCLUDES.map(triRow).join('')}
        </tbody>
      </table>
    </div></div>
    <p class="formula">홀 사용료 + 꽃장식 + (보증인원 × 식대) · 보증인원은 2~3주 전 최종 결정</p>
  `;
}

// ── 기록 (입력) ──────────────────────────────────────────────────────────
function editView(id) {
  const existing = id ? store.venue(id) : null;
  if (id && !existing) return (location.hash = '#/venues');
  const v = existing ? structuredClone(existing) : blankVenue();
  const isNew = !existing;

  const moneyRow = (label, key, unit = '') => `
    <div class="row">
      <label for="${key}">${label}</label>
      <input id="${key}" type="number" inputmode="numeric" data-k="${key}"
             value="${v[key] ?? ''}" placeholder="미입력" />${unit ? `<span class="k">${unit}</span>` : ''}
    </div>`;

  app.innerHTML = `
    <button class="back" id="back">‹ 웨딩홀</button>
    <h1 class="hero sm">웨딩홀 기록</h1>
    <p class="hero-sub">알아본 것을 그대로 적어보세요 · 자동 저장돼요</p>

    <div class="card">
      <div class="row">
        <label for="name">홀 이름</label>
        <input id="name" type="text" data-k="name" value="${esc(v.name)}"
               placeholder="예: 강남 ○○홀" ${isNew ? 'autofocus' : ''} />
      </div>
      <div class="row">
        <label for="tourDate">알아본 날짜</label>
        <input id="tourDate" type="date" data-k="tourDate" value="${esc(v.tourDate)}" />
      </div>
    </div>

    <h2 class="section-title">금액 <span class="hint">받은 견적 그대로</span></h2>
    <div class="card">
      ${moneyRow('홀 사용료', 'hallFee')}
      ${moneyRow('꽃장식', 'flowers')}
      ${moneyRow('식대 (1인)', 'mealPrice')}
      ${moneyRow('보증인원', 'guarantee', '명')}
      <div class="row total"><span class="k"><b>예상 합계</b></span><span class="v" id="total"></span></div>
    </div>
    <p class="formula">홀 사용료 + 꽃장식 + (보증인원 × 식대) · 보증인원은 2~3주 전 최종 결정</p>

    <h2 class="section-title">포함 여부 <span class="hint">못 물어봤으면 모름</span></h2>
    <div class="card">
      ${INCLUDES.map(([key, label]) => `
        <div class="row">
          <span class="k">${label}</span>
          <span class="seg" data-seg="${key}">
            ${TRI.map(([val, txt]) =>
              `<button type="button" data-v="${val}" aria-pressed="${v[key] === val}">${txt}</button>`
            ).join('')}
          </span>
        </div>`).join('')}
    </div>

    <h2 class="section-title">메모 <span class="hint">견적서를 찍어두면 편해요</span></h2>
    <div class="card">
      <div class="row" style="display:block">
        <textarea data-k="memo" placeholder="주차, 예식 간격, 대기실 분위기 …">${esc(v.memo)}</textarea>
      </div>
      <div class="thumbs" id="thumbs"></div>
      <div class="row">
        <label for="photo" class="k">견적서 사진</label>
        <input id="photo" type="file" accept="image/*" style="max-width:60%" />
      </div>
    </div>

    <div class="sticky">
      <button class="btn btn-primary" id="done">${
        store.profile().pickedVenueId === v.id ? '저장' : '비교표에 담기'
      }</button>
      ${store.profile().pickedVenueId === v.id
        ? '<button class="linkish ob-skip" data-unpick="venue">예약 확정 취소하고 다시 비교</button>'
        : `<button class="linkish ob-skip" data-pick-venue="${v.id}">이 홀로 예약했어요</button>`}
    </div>

    ${existing ? '<button class="danger" id="del">이 웨딩홀 삭제</button>' : ''}
  `;

  const refreshTotal = () => {
    const t = total(v);
    const el = $('#total');
    el.textContent = t === null ? '입력이 덜 됐어요' : won(t) + '원';
    el.style.color = t === null ? 'var(--mute)' : 'var(--rose)';
    el.style.fontSize = t === null ? '12px' : '16px';
  };

  const persist = () => { store.save(v); };

  app.querySelectorAll('[data-k]').forEach((el) => {
    el.oninput = () => {
      const k = el.dataset.k;
      if (el.type === 'number') v[k] = el.value === '' ? null : Number(el.value);
      else v[k] = el.value;
      refreshTotal();
      persist();
    };
  });

  app.querySelectorAll('[data-seg]').forEach((seg) => {
    seg.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      v[seg.dataset.seg] = btn.dataset.v;
      seg.querySelectorAll('button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn))
      );
      persist();
    };
  });

  $('#photo').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    v.photos.push(await photos.add(file));
    persist();
    drawThumbs();
    e.target.value = '';
  };

  async function drawThumbs() {
    const box = $('#thumbs');
    box.innerHTML = '';
    for (const pid of v.photos) {
      const url = await photos.url(pid);
      if (!url) continue;
      const img = new Image();
      img.src = url;
      img.alt = '견적서 사진';
      box.append(img);
    }
  }

  $('#back').onclick = () => { persist(); location.hash = '#/venues'; };
  $('#done').onclick = () => { persist(); location.hash = '#/venues'; };
  if (existing) {
    $('#del').onclick = () => {
      if (confirm(`'${v.name || '이 웨딩홀'}' 기록을 지울까요?`)) {
        store.remove(v.id);
        location.hash = '#/venues';
      }
    };
  }

  // 확정을 누르면 아직 저장 안 된 입력도 함께 담긴다
  bindPick('venue');
  app.querySelectorAll('[data-pick-venue]').forEach((b) => {
    const go = b.onclick;
    b.onclick = () => { persist(); go(); };
  });

  refreshTotal();
  drawThumbs();
}

// ── 내보내기 / 불러오기 ──────────────────────────────────────────────────
function doExport() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `weddingplanner-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function doImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    store.importJSON(await file.text());
    alert('불러왔어요.');
    render();
  } catch (err) {
    alert('불러오지 못했어요.\n' + err.message);
  }
  e.target.value = '';
}

// ── 라우터 ───────────────────────────────────────────────────────────────
function render() {
  const h = location.hash;
  scrollTo(0, 0);

  // 온보딩
  if (h.startsWith('#/start')) {
    const m = h.match(/^#\/start\/(\d+)(-date|-month)?$/);
    if (h === '#/start/done') return doneView();
    if (m) {
      const i = Number(m[1]) - 1;
      if (m[2] === '-date') return dateView(stepCtx(i));
      if (m[2] === '-month') return monthView(stepCtx(i));
      return questionView(i);
    }
    return (location.hash = '#/start/1');
  }

  // 첫 방문이면 온보딩부터
  if (!store.onboarded() && !store.venues().length) return (location.hash = '#/start/1');

  // 예식 시점만 고치는 화면 — 웨딩홀 계약 여부로 정밀도가 갈린다
  if (h === '#/when') {
    return store.profile().venueStatus === 'done'
      ? dateView(editCtx())
      : monthView(editCtx());
  }
  if (h === '#/sdm') return sdmView();
  const shop = h.match(/^#\/sdm\/shop\/(\w+)$/);
  if (shop) return shopView(shop[1]);
  if (h === '#/sdm/new') return sdmEdit(null);
  if (h.startsWith('#/sdm/v/')) return sdmEdit(h.slice(8));
  if (h === '#/honeymoon') return honeymoonView();
  if (h === '#/honsu') return honsuView();
  if (h === '#/guide') return guideView();
  if (h === '#/new') return editView(null);
  if (h.startsWith('#/v/')) return editView(h.slice(4));
  if (h === '#/venues') return venueListView();
  return homeView();
}

addEventListener('hashchange', render);
render();
