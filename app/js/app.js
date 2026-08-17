import { store, blankVenue, total } from './store.js';
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

// ── 목록 + 비교 ──────────────────────────────────────────────────────────
function listView() {
  const venues = store.venues();

  const cards = venues.length
    ? `<div class="card">${venues
        .map((v) => {
          const t = total(v);
          return `<button class="venue" data-go="${v.id}">
            <div class="name">${esc(v.name || '이름 없는 웨딩홀')}</div>
            <div class="meta">${v.tourDate ? esc(dateLabel(v.tourDate)) + ' 투어' : '투어 날짜 미입력'}</div>
            <div class="sum${t === null ? ' none' : ''}">${
              t === null ? '금액이 덜 채워졌어요' : won(t) + '원'
            }</div>
          </button>`;
        })
        .join('')}</div>`
    : `<div class="card"><div class="empty-state">
         아직 기록한 웨딩홀이 없어요.<br />투어 다녀오시면 여기에 쌓입니다.
       </div></div>`;

  app.innerHTML = `
    <header>
      <h1>웨딩홀</h1>
      <p class="sub">투어하면서 적은 것을 나란히 봅니다</p>
    </header>

    ${cards}

    <button class="btn btn-ghost" id="add" style="margin-top:14px">＋ 웨딩홀 기록하기</button>

    ${venues.length >= 2 ? compareTable(venues) : ''}

    <p class="note">
      앱은 순위를 매기거나 추천하지 않아요. 적어두신 것을 나란히 놓아드릴 뿐이에요.<br />
      기록은 <b>이 브라우저에만</b> 저장돼요. 다른 기기에서 보시려면 내보내기를 쓰세요.
    </p>

    <div class="btn-row">
      <button class="btn btn-quiet" id="export">내보내기</button>
      <button class="btn btn-quiet" id="import">불러오기</button>
    </div>
    <input type="file" id="file" accept="application/json" hidden />
  `;

  $('#add').onclick = () => (location.hash = '#/new');
  app.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => (location.hash = '#/v/' + b.dataset.go);
  });
  $('#export').onclick = doExport;
  $('#import').onclick = () => $('#file').click();
  $('#file').onchange = doImport;
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

  const moneyRow = (label, key, unit = '') => `
    <div class="row">
      <label for="${key}">${label}</label>
      <input id="${key}" type="number" inputmode="numeric" data-k="${key}"
             value="${v[key] ?? ''}" placeholder="미입력" />${unit ? `<span class="k">${unit}</span>` : ''}
    </div>`;

  app.innerHTML = `
    <header>
      <button class="back" id="back">‹ 웨딩홀</button>
      <h1>웨딩홀 기록</h1>
      <p class="sub">투어하면서 바로 적어보세요 · 자동 저장돼요</p>
    </header>

    <div class="card">
      <div class="row">
        <label for="name">홀 이름</label>
        <input id="name" type="text" data-k="name" value="${esc(v.name)}" placeholder="예: 강남 ○○홀" />
      </div>
      <div class="row">
        <label for="tourDate">투어 날짜</label>
        <input id="tourDate" type="date" data-k="tourDate" value="${esc(v.tourDate)}" />
      </div>
    </div>

    <h2 class="section-title">금액 <span class="hint">받은 견적 그대로 적어주세요</span></h2>
    <div class="card">
      ${moneyRow('홀 사용료', 'hallFee')}
      ${moneyRow('꽃장식', 'flowers')}
      ${moneyRow('식대 (1인)', 'mealPrice')}
      ${moneyRow('보증인원', 'guarantee', '명')}
      <div class="row total"><span class="k"><b>예상 합계</b></span><span class="v" id="total"></span></div>
    </div>
    <p class="formula">홀 사용료 + 꽃장식 + (보증인원 × 식대) · 보증인원은 2~3주 전 최종 결정</p>

    <h2 class="section-title">포함 여부</h2>
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

    <h2 class="section-title">메모 <span class="hint">견적서를 찍어두면 나중에 편해요</span></h2>
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
    $('#total').textContent = t === null ? '입력이 덜 됐어요' : won(t) + '원';
    $('#total').style.color = t === null ? 'var(--mute)' : 'var(--rose)';
    $('#total').style.fontSize = t === null ? '12px' : '16px';
  };

  // 자동 저장 — 투어 중 앱을 닫아도 날아가지 않게
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
  if (h === '#/new') return editView(null);
  if (h.startsWith('#/v/')) return editView(h.slice(4));
  return listView();
}

addEventListener('hashchange', render);
render();
