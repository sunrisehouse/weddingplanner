import { store, blankVenue, total, daysToCeremony, prepStatus } from './store.js';
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
    key: 'ceremonyDateStatus',
    title: '결혼식 날짜가\n정해지셨나요?',
    sub: '언제까지 무엇을 해야 하는지 알려드릴 기준이에요',
    options: [
      { v: 'confirmed', l: '네, 확정했어요', next: 'date' },
      { v: 'tentative', l: '가예약만 해뒀어요', next: 'date' },
      { v: 'unknown', l: '아직요' },
    ],
  },
  {
    key: 'venueStatus',
    title: '웨딩홀은\n정하셨나요?',
    sub: '예식장 사용료 · 꽃장식 · 피로연 · 본식 스냅',
    options: [
      { v: 'done', l: '계약했어요' },
      { v: 'looking', l: '투어 다니는 중이에요' },
      { v: 'none', l: '아직 안 알아봤어요' },
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
      if (o.next === 'date') return (location.hash = `#/start/${i + 1}-date`);
      location.hash = i + 1 < TOTAL_STEPS ? `#/start/${i + 2}` : '#/start/done';
    };
  });
}

// 날짜 입력은 앞 질문의 후속 화면이라 진행 번호를 차지하지 않는다
function dateView(i) {
  const p = store.profile();
  app.innerHTML = `
    ${stepChrome(i, `#/start/${i + 1}`)}
    <h1 class="ob-q">언제인가요?</h1>
    <p class="ob-sub">${p.ceremonyDateStatus === 'tentative' ? '가예약한 날짜를 적어주세요' : '확정된 날짜를 적어주세요'}</p>
    <div class="card">
      <div class="row">
        <label for="cd">결혼식 날짜</label>
        <input id="cd" type="date" value="${esc(p.ceremonyDate)}" />
      </div>
    </div>
    <div class="sticky">
      <button class="btn btn-primary" id="next">다음</button>
      <button class="linkish ob-skip" id="later">나중에 입력할게요</button>
    </div>
  `;
  const go = () => (location.hash = i + 1 < TOTAL_STEPS ? `#/start/${i + 2}` : '#/start/done');
  $('#ob-back').onclick = () => (location.hash = `#/start/${i + 1}`);
  $('#next').onclick = () => { store.setProfile({ ceremonyDate: $('#cd').value }); go(); };
  $('#later').onclick = go;
}

const STATE_TXT = {
  done: ['완료', 'ok'],
  late: ['서둘러야 해요', 'late'],
  ok: ['시간 있어요', 'ok'],
  nodate: ['예식일 정하면 알려드려요', 'mute'],
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
  const d = daysToCeremony(p);
  const prep = prepStatus(p);
  const late = prep.filter((c) => c.state === 'late');

  const dline = d === null
    ? ''
    : `<div class="row do"><span class="k">결혼식까지</span><span class="v">D-${d}</span></div>`;

  const rows = prep
    .map((c) => {
      const [txt, cls] = STATE_TXT[c.state];
      return `<div class="row prep ${cls}">
        <span class="k"><b>${c.label}</b><em>${esc(c.note)}</em></span>
        <span class="st">${txt}</span>
      </div>`;
    })
    .join('');

  // 시점이 지난 것만 짚는다. 무엇을 먼저 하라고 순서를 정해주지는 않는다.
  const lead = late.length
    ? `<div class="card notice">
         <p><b>${late.map((c) => esc(c.label)).join(' · ')}</b> 예약을 서둘러주세요.</p>
         <p>${late.map((c) => `${esc(c.label)} ${esc(c.by)}`).join(' · ')}까지 예약하셔야 하는데
            지금 ${Math.floor(d / 30)}개월 남았어요.</p>
       </div>`
    : d === null
      ? `<div class="card notice"><p><b>예식일을 정하시면 시점을 챙겨드릴게요.</b></p>
         <p>예약 시점은 모두 예식일을 기준으로 세어드려요.</p></div>`
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

// ── 기록이 없을 때 ───────────────────────────────────────────────────────
// 온보딩을 마쳤어도 기록은 0곳이다. 빈 표를 보여주는 대신
// 이 화면이 "이게 뭔지 · 지금 뭘 하면 되는지"를 말한다.
// 온보딩을 건너뛴 사람에게는 이 화면이 첫 화면이 된다.
function introView() {
  app.innerHTML = `
    ${brand()}
    <h1 class="hero">웨딩홀 투어,<br />적어두고 나란히 비교하세요</h1>
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

    <h2 class="section-title">이 앱이 하는 일</h2>
    <div class="card">
      <div class="row do"><span class="k">여러 홀을 나란히 비교</span><span class="mark yes">✓</span></div>
      <div class="row do"><span class="k">홀 사용료 + 꽃장식 + (보증인원 × 식대) 합산</span><span class="mark yes">✓</span></div>
      <div class="row do"><span class="k">투어 전에 확인할 것 알려주기</span><span class="mark yes">✓</span></div>
      <div class="row do"><span class="k">시세 · 평균가 알려주기</span><span class="mark no">✕</span></div>
      <div class="row do"><span class="k">업체 추천 · 순위 매기기</span><span class="mark no">✕</span></div>
    </div>
    <p class="note">
      가격은 지역 · 시기마다 달라서, 어떤 기준값을 보여줘도 틀린 숫자를 믿게 만듭니다.
      그래서 <b>적어두신 것만</b> 계산합니다.
    </p>

    <div class="card notice">
      <p><b>기록은 이 브라우저에만 저장돼요.</b></p>
      <p>다른 기기나 상대방 폰에서는 보이지 않습니다.
         투어 다녀오시면 <b>내보내기</b>로 백업해두세요.</p>
    </div>
  `;
  $('#go-record').onclick = () => (location.hash = '#/new');
  $('#go-guide').onclick = () => (location.hash = '#/guide');
  $('#demo').onclick = () => { store.loadSample(); location.hash = '#/'; render(); };
}

// ── 웨딩홀 투어 준비 ─────────────────────────────────────────────────────
// 항목은 박람회 자료의 웨딩홀 구성에서 왔지만, 화면에서는 앱이 직접 챙겨준다.
function guideView() {
  app.innerHTML = `
    <button class="back" id="back">‹ 처음으로</button>
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
  $('#back').onclick = () => (location.hash = '#/');
  $('#record').onclick = () => (location.hash = '#/new');
}

// ── 목록 + 비교 ──────────────────────────────────────────────────────────
function listView() {
  const venues = store.venues();
  if (!venues.length) return introView();

  const hasSample = venues.some((v) => v.sample);

  const p = store.profile();
  const d = daysToCeremony(p);
  const late = prepStatus(p).filter((c) => c.state === 'late');
  const dday = d === null ? '' : `
    <div class="dday">
      <span class="n">D-${d}</span>
      <span class="t">${esc(dateLabel(p.ceremonyDate))}${
        p.ceremonyDateStatus === 'tentative' ? ' · 가예약' : ''
      }</span>
      ${late.length
        ? `<span class="warn">${late.map((c) => esc(c.label)).join(' · ')} 예약을 서둘러주세요</span>`
        : ''}
    </div>`;

  app.innerHTML = `
    ${brand('웨딩홀')}
    <p class="sub">투어하면서 적은 것을 나란히 봅니다</p>
    ${dday}

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

    <div class="btn-row">
      <button class="btn btn-quiet" id="export">내보내기</button>
      <button class="btn btn-quiet" id="import">불러오기</button>
    </div>
    <input type="file" id="file" accept="application/json" hidden />

    <p class="note">
      앱은 순위를 매기거나 추천하지 않아요. 적어두신 것을 나란히 놓아드릴 뿐이에요.<br />
      기록은 <b>이 브라우저에만</b> 저장돼요. 다른 기기에서 보시려면 내보내기를 쓰세요.<br />
      <button class="linkish" id="guide">투어 준비 다시 보기</button> ·
      <button class="linkish" id="redo">처음 답한 내용 수정</button>
    </p>
  `;

  $('#add').onclick = () => (location.hash = '#/new');
  $('#guide').onclick = () => (location.hash = '#/guide');
  $('#redo').onclick = () => (location.hash = '#/start/1');
  app.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => (location.hash = '#/v/' + b.dataset.go);
  });
  $('#export').onclick = doExport;
  $('#import').onclick = () => $('#file').click();
  $('#file').onchange = doImport;
  if (hasSample) {
    $('#clear-sample').onclick = () => {
      if (confirm('예시 데이터를 지울까요?')) { store.clearSample(); render(); }
    };
  }
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
  if (id && !existing) return (location.hash = '#/');
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

  $('#back').onclick = () => (location.hash = '#/');
  $('#done').onclick = () => { persist(); location.hash = '#/'; };
  if (existing) {
    $('#del').onclick = () => {
      if (confirm(`'${v.name || '이 웨딩홀'}' 기록을 지울까요?`)) {
        store.remove(v.id);
        location.hash = '#/';
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
    const m = h.match(/^#\/start\/(\d+)(-date)?$/);
    if (h === '#/start/done') return doneView();
    if (m) return m[2] ? dateView(Number(m[1]) - 1) : questionView(Number(m[1]) - 1);
    return (location.hash = '#/start/1');
  }

  // 첫 방문이면 온보딩부터
  if (!store.onboarded() && !store.venues().length) return (location.hash = '#/start/1');

  if (h === '#/guide') return guideView();
  if (h === '#/new') return editView(null);
  if (h.startsWith('#/v/')) return editView(h.slice(4));
  return listView();
}

addEventListener('hashchange', render);
render();
