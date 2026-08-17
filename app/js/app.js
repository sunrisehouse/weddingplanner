import {
  store, blankVenue, total,
  daysToCeremony, monthsToCeremony, ceremonyAnchor, prepStatus,
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
      { v: 'looking', l: '투어 다니는 중이에요', next: 'month' },
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
    return { hash: '#/guide', label: '웨딩홀 투어 준비하기' };
  }
  if (p.venueStatus === 'looking') return { hash: '#/new', label: '투어 기록 시작하기' };
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

// ── 탭 ──────────────────────────────────────────────────────────────────
// 최상위 화면은 홈과 웨딩홀 둘이다. 그 아래 화면(기록 폼 · 투어 준비 ·
// 온보딩)은 뒤로 가기로 돌아가므로 탭을 붙이지 않는다.
const TABS = [
  ['home', '#/', '🏠', '홈'],
  ['venue', '#/venues', '💐', '웨딩홀'],
];

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
      return `<div class="row prep ${cls}">
        <span class="k"><b>${c.label}</b>${when ? `<em>${esc(when)}</em>` : ''}</span>
        <span class="st">${txt}</span>
      </div>`;
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
      <button class="linkish" id="redo">답 수정</button>
    </h2>
    <div class="card">${rows}</div>
    ${late.length || next
      ? `<p class="note">${anchor.kind === 'month'
          ? '예상 시기에서 거꾸로 세어드린 달이에요. 날짜가 정해지면 날짜로 바뀝니다.'
          : '마감일은 예식일에서 거꾸로 세어드린 날짜예요.'}</p>`
      : ''}

    <div class="btn-row">
      <button class="btn btn-quiet" id="export">내보내기</button>
      <button class="btn btn-quiet" id="import">불러오기</button>
    </div>
    <input type="file" id="file" accept="application/json" hidden />

    <p class="note">
      기록은 <b>이 브라우저에만</b> 저장돼요. 다른 기기나 상대방 폰에서는 보이지 않아요.
      옮기실 때는 내보내기를 쓰세요.
    </p>
    ${tabBar('home')}
  `;
  $('#redo').onclick = () => (location.hash = '#/start/1');
  const setdate = $('#setdate');
  if (setdate) setdate.onclick = () => (location.hash = '#/when');
  $('#export').onclick = doExport;
  $('#import').onclick = () => $('#file').click();
  $('#file').onchange = doImport;
  bindChrome();
}

// ── 웨딩홀 기록이 0곳일 때 ───────────────────────────────────────────────
// 빈 비교표를 보여주는 대신 갈래를 나눈다.
function venueEmptyView() {
  app.innerHTML = `
    ${brand('웨딩홀')}
    <p class="sub">투어를 적어두면 나란히 비교해드려요</p>
    <h1 class="hero sm" style="margin-top:22px">투어 다녀오셨나요?</h1>
    <p class="hero-sub">
      받은 견적을 그대로 적으면 <b>실제로 얼마인지</b> 계산해드려요.
      홀 사용료만 보면 식대가 빠져 실제 금액을 알 수 없습니다.
    </p>

    <div class="card choice">
      <button class="choice-row" id="go-record">
        <span class="ico">📝</span>
        <span class="txt">
          <b>투어 다녀왔어요</b>
          <em>받은 견적을 적어둘게요</em>
        </span>
        <span class="arr">›</span>
      </button>
      <button class="choice-row" id="go-guide">
        <span class="ico">🔍</span>
        <span class="txt">
          <b>아직 안 가봤어요</b>
          <em>투어 준비부터 챙겨드릴게요</em>
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

// ── 웨딩홀 투어 준비 ─────────────────────────────────────────────────────
// 항목은 박람회 자료의 웨딩홀 구성에서 왔지만, 화면에서는 앱이 직접 챙겨준다.
function guideView() {
  app.innerHTML = `
    <button class="back" id="back">‹ 웨딩홀</button>
    <h1 class="hero sm">웨딩홀 투어 준비</h1>
    <p class="hero-sub">
      투어 가시면 이것만 확인하시면 돼요.
      확인한 그대로 비교표가 됩니다.
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

    <p class="note">
      투어 중에 다 못 물어보는 게 정상이에요. 기록할 때 <b>모름</b>으로 남겨두면
      나중에 "안 물어본 것"과 "없는 것"이 구분됩니다.
    </p>

    <div class="sticky">
      <button class="btn btn-primary" id="record">투어 기록하기</button>
    </div>
  `;
  $('#back').onclick = () => (location.hash = '#/venues');
  $('#record').onclick = () => (location.hash = '#/new');
}

// ── 웨딩홀 목록 + 비교 ──────────────────────────────────────────────────
function venueListView() {
  const venues = store.venues();
  if (!venues.length) return venueEmptyView();

  const hasSample = venues.some((v) => v.sample);
  const p = store.profile();
  const venueLate = prepStatus(p).filter((c) => c.state === 'late' && c.key === 'venueStatus');

  app.innerHTML = `
    ${brand('웨딩홀')}
    <p class="sub">투어하면서 적은 것을 나란히 봅니다</p>
    <div style="height:18px"></div>
    ${ddayCard(p, venueLate)}

    ${hasSample ? `
      <div class="card notice sample">
        <p><b>예시 데이터로 둘러보는 중이에요.</b></p>
        <p>비교표가 어떻게 보이는지 보여드리려고 넣어둔 값입니다.</p>
        <button class="btn btn-quiet" id="clear-sample">지우고 내 기록 시작하기</button>
      </div>` : ''}

    <div class="card">${venues
      .map((v) => {
        const t = total(v);
        return `<button class="venue" data-go="${v.id}">
          <div class="name">${esc(v.name || '이름 없는 웨딩홀')}${
            v.sample ? ' <span class="chip">예시</span>' : ''
          }</div>
          <div class="meta">${v.tourDate ? esc(dateLabel(v.tourDate)) + ' 투어' : '투어 날짜 미입력'}</div>
          <div class="sum${t === null ? ' none' : ''}">${
            t === null ? '금액이 덜 채워졌어요' : won(t) + '원'
          }</div>
        </button>`;
      })
      .join('')}</div>

    <button class="btn btn-ghost" id="add" style="margin-top:14px">＋ 웨딩홀 기록하기</button>

    ${venues.length >= 2
      ? compareTable(venues)
      : `<p class="note">한 곳 더 기록하면 <b>비교표</b>가 나타납니다.</p>`}

    <p class="note">
      적어두신 것을 나란히 놓아드릴 뿐이에요. 순위를 매기거나 추천하지 않아요.<br />
      <button class="linkish" id="guide">투어 준비 다시 보기</button>
    </p>
    ${tabBar('venue')}
  `;

  $('#add').onclick = () => (location.hash = '#/new');
  $('#guide').onclick = () => (location.hash = '#/guide');
  app.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => (location.hash = '#/v/' + b.dataset.go);
  });
  if (hasSample) {
    $('#clear-sample').onclick = () => {
      if (confirm('예시 데이터를 지울까요?')) { store.clearSample(); render(); }
    };
  }
  bindChrome();
}

function compareTable(venues) {
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
    <h2 class="section-title">비교</h2>
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
    <button class="back" id="back">‹ 투어 기록</button>
    <h1 class="hero sm">웨딩홀 기록</h1>
    <p class="hero-sub">투어하면서 바로 적어보세요 · 자동 저장돼요</p>

    <div class="card">
      <div class="row">
        <label for="name">홀 이름</label>
        <input id="name" type="text" data-k="name" value="${esc(v.name)}"
               placeholder="예: 강남 ○○홀" ${isNew ? 'autofocus' : ''} />
      </div>
      <div class="row">
        <label for="tourDate">투어 날짜</label>
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
      <button class="btn btn-primary" id="done">비교표에 담기</button>
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

  $('#back').onclick = () => (location.hash = '#/venues');
  $('#done').onclick = () => { persist(); location.hash = '#/venues'; };
  if (existing) {
    $('#del').onclick = () => {
      if (confirm(`'${v.name || '이 웨딩홀'}' 기록을 지울까요?`)) {
        store.remove(v.id);
        location.hash = '#/venues';
      }
    };
  }

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
  if (h === '#/guide') return guideView();
  if (h === '#/new') return editView(null);
  if (h.startsWith('#/v/')) return editView(h.slice(4));
  if (h === '#/venues') return venueListView();
  return homeView();
}

addEventListener('hashchange', render);
render();
