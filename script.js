// ===== Cấu hình =====
const EXAM_MINUTES = 60;
const AI_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = 'openai/gpt-oss-120b';   // web tự chọn model dùng được, đây chỉ là dự phòng
const NS = 'tdpb_';
const SKIP_PARTS = [4, 6];   // các phần bỏ qua, không hiện trong web (muốn bật lại thì xóa số khỏi danh sách)

const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nk = k => (k === 'key' || k === 'theme') ? k : NS + k;   // 'key' và 'theme' dùng chung các web
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(nk(k))) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(nk(k), JSON.stringify(v)); } catch {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const bank = () => [...ITEMS, ...load('ai', []).map(x => ({ ...x, ai: 1 }))].filter(x => !SKIP_PARTS.includes(x.p));
let S, T, MODEL = null;

document.documentElement.dataset.theme = load('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; save('theme', t); };

// ===== Gọi AI (Groq/OpenAI) =====
async function getModel() {
  if (MODEL) return MODEL;
  try {
    const r = await fetch(AI_URL.replace('/chat/completions', '/models'), { headers: { Authorization: 'Bearer ' + load('key', '') } });
    const ids = (await r.json()).data.map(m => m.id);
    MODEL = [AI_MODEL, 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gpt-4o-mini'].find(m => ids.includes(m)) || ids.find(i => !/whisper|tts|guard|orpheus|compound|embed|safeguard/i.test(i)) || AI_MODEL;
  } catch { MODEL = AI_MODEL; }
  return MODEL;
}
async function ai(sys, user) {
  if (!load('key', '')) { const k = prompt('Dán API key (Groq/OpenAI), chỉ lưu trong trình duyệt của bạn:'); if (!k) throw new Error('Chưa có API key'); save('key', k.trim()); }
  const model = await getModel();
  for (let k = 0; k < 5; k++) {
    const r = await fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + load('key', '') },
      body: JSON.stringify({ model, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
    const j = await r.json(), msg = j.error?.message || '';
    if (r.ok) return JSON.parse(j.choices[0].message.content);
    if (/rate limit/i.test(msg) && k < 4) { const m = /try again in ([\d.]+)s/i.exec(msg); await sleep(((m ? +m[1] : 15) + 2) * 1000); continue; }
    throw new Error(msg || r.status);
  }
}

// ===== Trang chủ =====
function home() {
  clearInterval(T);
  const B = bank(), n = p => B.filter(x => x.p === p).length, nai = load('ai', []).length;
  app.innerHTML = `<section class="hero"><h2>Ôn thi tự luận</h2><p>Môn Tư duy phản biện · ${B.length} câu (${nai} câu do AI tạo)</p></section>
  <h3 class="sec">Chọn phần</h3>
  <div class="chips">${Object.keys(PARTS).filter(p => !SKIP_PARTS.includes(+p)).map(p => `<label class="chip"><input type="checkbox" class="ch" value="${p}" ${p === '6' ? '' : 'checked'}><span><b>Phần ${p}</b>${PARTS[p].name}<small>${n(+p)} câu · ${PARTS[p].pts} điểm/câu</small></span></label>`).join('')}</div>
  <h3 class="sec">Chế độ</h3>
  <div class="modes">
    <button class="mode" onclick="start('practice')"><i>✍️</i><b>Luyện tập</b><small>Viết bài, xem đáp án mẫu, nhờ AI chấm</small></button>
    <button class="mode" onclick="start('exam')"><i>⏱️</i><b>Thi thử</b><small>${EXAM_MINUTES} phút, xem đáp án khi nộp bài</small></button>
    <button class="mode" onclick="genAI()"><i>🤖</i><b>AI tạo thêm câu</b><small>3 câu mới cho mỗi phần đã chọn</small></button>
    <button class="mode" ${nai ? '' : 'disabled'} onclick="if(confirm('Xóa các câu do AI tạo?')){save('ai',[]);home()}"><i>🗑️</i><b>Xóa câu AI</b><small>${nai} câu</small></button>
  </div>`;
}
const chosen = () => [...document.querySelectorAll('.ch:checked')].map(c => +c.value);

function start(mode) {
  const ps = chosen(); let list = bank().filter(x => ps.includes(x.p));
  if (!list.length) return alert('Hãy chọn ít nhất 1 phần.');
  // Thi thử: rút ngẫu nhiên theo cấu trúc đề thật (P1: 8 câu, P2: 3, P3: 4, P4: 2, P5: 4; phần lý thuyết không có trong đề thi)
  const SHAPE = { 1: 8, 2: 3, 3: 4, 4: 2, 5: 4 };
  if (mode === 'exam') list = ps.flatMap(p => shuffle(list.filter(x => x.p === p)).slice(0, SHAPE[p] || 0)).sort((a, b) => a.p - b.p);
  else list = shuffle(list);
  if (!list.length) return alert('Phần đã chọn không có trong đề thi thử. Hãy chọn thêm phần 1-5.');
  S = { mode, list, i: 0, ans: [], grade: [], show: {}, t: EXAM_MINUTES * 60, done: false };
  clearInterval(T);
  if (mode === 'exam') T = setInterval(() => { if (--S.t <= 0) submit(); else tick(); }, 1000);
  view();
}
function tick() { const e = $('#tm'); if (e) e.textContent = `⏱ ${Math.floor(S.t / 60)}:${String(S.t % 60).padStart(2, '0')}`; }

// ===== Vẽ sơ đồ cấu trúc luận điểm bằng SVG =====
// Cú pháp: "1+2>3;3>4" (+ là hỗ trợ liên kết, dấu phẩy là hỗ trợ độc lập, ; ngăn cách các quan hệ, sau | là câu không liên quan)
function diagram(spec) {
  const [main, irr = ''] = spec.split('|');
  const E = main.split(';').filter(Boolean).map(t => { const [a, b] = t.split('>'); return { src: a.split(/[+,]/).map(Number), dst: +b, linked: a.includes('+') }; });
  const lv = {}, nodes = new Set();
  E.forEach(e => { nodes.add(e.dst); e.src.forEach(n => nodes.add(n)); });
  const L = n => lv[n] ?? (lv[n] = Math.max(-1, ...E.filter(e => e.dst === n).flatMap(e => e.src.map(L))) + 1);
  [...nodes].forEach(L);
  const maxL = Math.max(...Object.values(lv)), GX = 78, GY = 100, R = 22, pos = {};
  for (let l = 0; l <= maxL; l++) {
    const ns = [...nodes].filter(n => lv[n] === l);
    const want = n => { const s = E.filter(e => e.dst === n).flatMap(e => e.src); return s.length ? s.reduce((a, m) => a + pos[m].x, 0) / s.length : null; };
    ns.sort((a, b) => (want(a) ?? a * GX) - (want(b) ?? b * GX));
    let x = -1e9;
    ns.forEach((n, i) => { x = Math.max(want(n) ?? i * GX, x + GX); pos[n] = { x, y: l * GY + R + 8 }; });
  }
  irr.split(',').filter(Boolean).map(Number).forEach(n => { pos[n] = { x: Math.max(...Object.values(pos).map(p => p.x)) + GX, y: R + 8, dash: 1 }; });
  let g = '';
  const cnt = {};
  E.forEach(e => {
    const t = pos[e.dst], xs = e.src.map(n => pos[n].x), tip = `x2="${t.x}" y2="${t.y - R - 3}" marker-end="url(#ah)"`;
    if (e.linked) {
      const by = Math.max(...e.src.map(n => pos[n].y)) + R + 12, lo = Math.min(...xs), hi = Math.max(...xs), sx = [...xs].sort((a, b) => a - b);
      e.src.forEach(n => g += `<line x1="${pos[n].x}" y1="${pos[n].y + R}" x2="${pos[n].x}" y2="${by}"/>`);
      g += `<line x1="${lo}" y1="${by}" x2="${hi}" y2="${by}"/>`;
      for (let i = 0; i < sx.length - 1; i++) g += `<text x="${(sx[i] + sx[i + 1]) / 2}" y="${by - 6}" text-anchor="middle" fill="currentColor" stroke="none" font-size="16">+</text>`;
      g += `<line x1="${(lo + hi) / 2}" y1="${by}" ${tip}/>`;
    } else {   // hỗ trợ độc lập: các mũi tên chạm vào mép trên kết luận ở những điểm cách nhau để không chồng lên nhau
      const k = E.filter(f => f.dst === e.dst && !f.linked).reduce((a, f) => a + f.src.length, 0);
      e.src.forEach(n => { const i = (cnt[e.dst] = (cnt[e.dst] ?? -1) + 1), ex = t.x + (i - (k - 1) / 2) * 14; g += `<line x1="${pos[n].x}" y1="${pos[n].y + R}" x2="${ex}" y2="${t.y - R - 3}" marker-end="url(#ah)"/>`; });
    }
  });
  Object.entries(pos).forEach(([n, p]) => g += `<circle cx="${p.x}" cy="${p.y}" r="${R}" style="fill:var(--card)" ${p.dash ? 'stroke-dasharray="5 4" opacity=".6"' : ''}/><text x="${p.x}" y="${p.y + 6}" text-anchor="middle" fill="currentColor" stroke="none" font-size="18" font-weight="600">${n}</text>${p.dash ? `<text x="${p.x}" y="${p.y + R + 16}" text-anchor="middle" fill="currentColor" stroke="none" font-size="11" opacity=".7">không liên quan</text>` : ''}`);
  const xsAll = Object.values(pos).map(p => p.x), minX = Math.min(...xsAll) - R - 14, W = Math.max(...xsAll) - minX + R + 14, H = (maxL + 1) * GY + 14;
  return `<div class="dg"><svg viewBox="${minX} 0 ${W} ${H}" width="${W}" style="max-width:100%;height:auto" fill="none" stroke="currentColor" stroke-width="2"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor" stroke="none"/></marker></defs>${g}</svg><small>Sơ đồ: đường ngang nối nhiều tiền đề kèm dấu + là hỗ trợ liên kết; mũi tên riêng từng tiền đề là hỗ trợ độc lập.</small></div>`;
}

// ===== Hiển thị =====
const ansBlock = x => `<div class="exp"><b>Đáp án mẫu</b><div class="q">${esc(x.a)}</div>${x.aimg ? `<img class="dia" src="${x.aimg}" alt="">` : ''}${x.d ? diagram(x.d) : ''}</div>`;
const gradeBlock = g => !g ? '' : typeof g === 'string' ? `<div class="gr">${esc(g)}</div>` : `<div class="gr"><b>Điểm AI chấm: ${esc(g.diem)}</b>\n✔ ${esc(g.dung || '')}\n✘ ${esc(g.thieu || '')}</div>`;
function card(i, review) {
  const x = S.list[i], P = PARTS[x.p];
  return `<div class="qcard"><div class="top"><span class="tag">Phần ${x.p} · ${P.name}</span>${x.ai ? '<span class="tag ai">AI tạo</span>' : ''}<span class="mut">${P.pts} điểm</span>${!review && S.mode === 'exam' ? '<span id="tm"></span>' : ''}</div>
  <p class="ask">${esc(P.ask)}</p><div class="q">${esc(x.q)}</div>${x.img ? `<img class="dia" src="${x.img}" alt="">` : ''}
  ${review ? `<div class="mine"><b>Bài làm của bạn:</b>\n${esc(S.ans[i] || '(bỏ trống)')}</div>` : `<textarea oninput="S.ans[${i}]=this.value" placeholder="Viết câu trả lời của bạn...">${esc(S.ans[i] || '')}</textarea>`}
  <div class="row">${S.mode === 'practice' ? `<button class="alt" onclick="S.show[${i}]=!S.show[${i}];paint()">${S.show[i] ? 'Ẩn đáp án' : 'Xem đáp án mẫu'}</button>` : ''}${review || S.mode === 'practice' ? `<button onclick="gradeAI(${i})">🤖 Chấm bằng AI</button>` : ''}</div>
  ${review || S.show[i] ? ansBlock(x) : ''}${gradeBlock(S.grade[i])}</div>`;
}
function view() {
  const last = S.i === S.list.length - 1;
  app.innerHTML = `<div class="top"><span>Câu ${S.i + 1}/${S.list.length}</span></div><div class="prog"><i style="width:${(S.i + 1) / S.list.length * 100}%"></i></div>${card(S.i)}
  <div class="row"><button class="alt" onclick="go(-1)">‹ Trước</button><button onclick="go(1)">${last ? (S.mode === 'exam' ? 'Nộp bài' : 'Hoàn thành') : 'Tiếp ›'}</button><button class="danger" onclick="${S.mode === 'exam' ? 'submit()' : 'home()'}">${S.mode === 'exam' ? 'Nộp bài' : 'Thoát'}</button></div>
  ${S.mode === 'exam' ? `<div class="nav">${S.list.map((_, i) => `<button class="n ${(S.ans[i] || '').trim() ? 'done' : ''} ${i === S.i ? 'cur' : ''}" onclick="S.i=${i};view()">${i + 1}</button>`).join('')}</div>` : ''}`;
  tick();
}
function review() {
  app.innerHTML = `<h2>Xem lại bài thi</h2><p class="mut">Đối chiếu bài làm với đáp án mẫu. Bấm "Chấm bằng AI" để nhận điểm và nhận xét từng câu.</p>${S.list.map((_, i) => card(i, true)).join('<hr class="sep">')}<div class="row"><button onclick="home()">Về trang chủ</button></div>`;
}
const paint = () => S.done ? review() : view();
function go(d) { const n = S.i + d; if (n >= S.list.length) return S.mode === 'exam' ? submit() : home(); S.i = Math.max(0, n); view(); }
function submit() { clearInterval(T); S.done = true; review(); }

// ===== AI chấm bài =====
async function gradeAI(i) {
  const x = S.list[i], P = PARTS[x.p];
  if (!(S.ans[i] || '').trim()) return alert('Hãy viết câu trả lời trước khi nhờ AI chấm.');
  S.grade[i] = '⏳ AI đang chấm...'; paint();
  try {
    S.grade[i] = await ai('Bạn là giảng viên môn Tư duy phản biện, chấm bài tự luận bằng tiếng Việt, nghiêm túc nhưng công bằng, bám sát đáp án mẫu. Chỉ trả về JSON.',
      `Yêu cầu: ${P.ask}\nCâu hỏi: ${x.q}\n\nĐáp án mẫu và cách chấm: ${x.a}\n\nBài làm của sinh viên: ${S.ans[i]}\n\nChấm theo thang ${P.max} điểm. Trả JSON: {"diem":"x/${P.max}","dung":"những ý làm đúng","thieu":"những ý thiếu hoặc sai"}`);
  } catch (e) { S.grade[i] = 'Lỗi: ' + e.message; }
  paint();
}

// ===== AI tạo thêm câu hỏi (lưu vào trình duyệt) =====
async function genAI() {
  const ps = chosen(); if (!ps.length) return alert('Hãy chọn ít nhất 1 phần.');
  const out = load('ai', []);
  try {
    for (const p of ps) {
      app.innerHTML = `<h2>🤖 AI đang tạo câu hỏi...</h2><p>Phần ${p}: ${PARTS[p].name} (có thể mất vài chục giây)</p>`;
      const ex = shuffle(ITEMS.filter(x => x.p === p)).slice(0, 2);
      const r = await ai('Bạn là giảng viên môn Tư duy phản biện (Đại học Nha Trang), ra đề tự luận bằng tiếng Việt, đáp án chính xác, đúng kiến thức tư duy phản biện (tuyên bố, chân giá trị, luận điểm, tiền đề, kết luận, diễn dịch, quy nạp). Chỉ trả về JSON.',
        `Dạng bài: Phần ${p} - ${PARTS[p].name}. Yêu cầu của dạng: ${PARTS[p].ask || 'xây dựng/phân tích cấu trúc luận điểm (mô tả sơ đồ bằng chữ, ví dụ (1)+(2) → (3))'}\nVí dụ:\n${ex.map(e => `Câu: ${e.q}\nĐáp án: ${e.a}`).join('\n---\n')}\n\nHãy tạo 3 câu MỚI, nội dung khác ví dụ, cùng dạng. Trả JSON: {"items":[{"q":"...","a":"đáp án mẫu kèm giải thích"}]}`);
      (r.items || []).filter(x => x.q && x.a).forEach(x => out.push({ p, q: String(x.q), a: String(x.a) }));
    }
    save('ai', out);
  } catch (e) { alert('Lỗi: ' + e.message); }
  home();
}

home();
