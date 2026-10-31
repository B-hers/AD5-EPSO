'use strict';
(function () {
  const F = window.Figures;
  const $app = document.getElementById('app');
  const KEY = 'ad5-progress-v1';
  const CATS = { verbal: 'Raisonnement verbal', numerical: 'Raisonnement numérique', abstract: 'Raisonnement abstrait' };
  // Format confirmé : avis de concours EPSO/AD/427/26, tableau 2 (JO C/2026/711).
  const OFFICIAL = { verbal: { n: 20, sec: 35 * 60 }, numerical: { n: 10, sec: 20 * 60 }, abstract: { n: 10, sec: 10 * 60 } };
  const DIFFS = { 1: 'Facile', 2: 'Intermédiaire', 3: 'Difficile', 4: 'Expert' };

  let QS = []; let BY = {}; let S = load(); let session = null; let tick = null; let installEvt = null;

  // ---------- stockage ----------
  function load() {
    const d = { attempts: {}, favs: [], flagged: [], sessions: [], exams: [], settings: { cat: 'all', diff: 0, count: 10, perQ: false, perQSec: 0, sess: false, sessMin: 15, hide: false } };
    try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r) return Object.assign(d, r, { settings: Object.assign(d.settings, r.settings || {}) }); } catch (e) { /* données illisibles : on repart de zéro */ }
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage plein ou indisponible */ } }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  // ---------- statistiques ----------
  function stats(list) {
    let tried = 0, n = 0, ok = 0, sec = 0, review = 0;
    list.forEach((q) => { const a = S.attempts[q.id]; if (a) { tried++; n += a.n; ok += a.ok; sec += a.sec; if (a.last === 'ko') review++; } });
    return { total: list.length, tried, n, ok, rate: pc(ok, n), avg: n ? Math.round(sec / n) : 0, review };
  }
  function weak() {
    const m = {};
    QS.forEach((q) => { const a = S.attempts[q.id]; if (!a || !a.n) return; const k = q.category + '|' + q.subcategory; m[k] = m[k] || { n: 0, ok: 0, cat: q.category, sub: q.subcategory }; m[k].n += a.n; m[k].ok += a.ok; });
    return Object.values(m).filter((x) => x.n >= 2).map((x) => Object.assign(x, { rate: pc(x.ok, x.n) })).sort((a, b) => a.rate - b.rate).slice(0, 3);
  }

  // ---------- rendu des questions ----------
  function chartSvg(c) {
    const W = 520, H = 270, L = 44, B = 36, T = 28; const mx = Math.max(...c.values); const top = Math.ceil(mx / 50) * 50 || Math.ceil(mx / 5) * 5 || 10;
    const step = top / 5; const bw = (W - L - 10) / c.values.length; let g = '';
    for (let i = 0; i <= 5; i++) { const y = H - B - ((H - B - T) * i) / 5; g += `<line x1="${L}" x2="${W - 6}" y1="${y}" y2="${y}" stroke="#d4dcdf"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#51666d">${Math.round(step * i * 10) / 10}</text>`; }
    c.values.forEach((v, i) => { const h = ((H - B - T) * v) / top; const x = L + i * bw + bw * 0.18; g += `<rect x="${x}" y="${H - B - h}" width="${bw * 0.64}" height="${h}" fill="#1d4b55"/><text x="${x + bw * 0.32}" y="${H - B - h - 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#142a30">${v}</text><text x="${x + bw * 0.32}" y="${H - B + 17}" text-anchor="middle" font-size="12" fill="#142a30">${esc(c.labels[i])}</text>`; });
    return `<figure style="margin:10px 0"><figcaption class="muted" style="font-weight:600;color:#142a30">${esc(c.title)} (${esc(c.unit)})</figcaption><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}">${g}</svg></figure>`;
  }
  function tableHtml(t) {
    return `<div class="tablewrap"><table class="tbl"><caption>${esc(t.title)}</caption><thead><tr>${t.headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function questionHtml(q, o) {
    o = o || {}; let h = '';
    if (q.category === 'verbal' && q.data && q.data.text) h += `<div class="passage">${[].concat(q.data.text).map((p) => `<p>${esc(p)}</p>`).join('')}</div>`;
    if (q.data && q.data.table) h += tableHtml(q.data.table);
    if (q.data && q.data.chart) h += chartSvg(q.data.chart);
    if (q.category === 'abstract') {
      h += `<div class="seq" role="group" aria-label="Suite de figures">${q.data.frames.map((f, i) => `<div>${F.frameSvg(f, 'Figure ' + (i + 1))}</div><span class="arrow" aria-hidden="true">›</span>`).join('')}<div>${F.frameSvg(null, 'Figure à trouver')}</div></div>`;
    }
    h += `<p class="qtext"><strong>${esc(q.question)}</strong></p>`;
    const fig = q.category === 'abstract';
    h += `<div class="opts ${fig ? 'figopts' : ''}" role="radiogroup" aria-label="Propositions">` + q.options.map((op) => {
      let cls = 'opt'; if (o.choice === op.id) cls += ' sel';
      if (o.reveal) { if (op.id === q.correctAnswer) cls += ' ok'; else if (o.choice === op.id) cls += ' ko'; }
      const body = fig ? F.frameSvg(op.frame, op.text) : `<span>${esc(op.text)}</span>`;
      return `<button class="${cls}" role="radio" aria-checked="${o.choice === op.id}" data-act="pick" data-id="${op.id}" ${o.locked ? 'disabled' : ''}><span class="l">${op.id}</span>${body}</button>`;
    }).join('') + '</div>';
    return h;
  }
  const explHtml = (q) => `<div class="expl"><strong>Explication.</strong> ${esc(q.explanation)}${q.category === 'abstract' ? '' : ''}</div>`;

  // ---------- navigation ----------
  function render(html) { stopTick(); $app.innerHTML = html; window.scrollTo(0, 0); }
  function home() {
    session = null; const all = stats(QS);
    const cats = Object.keys(CATS).map((c) => { const l = QS.filter((q) => q.category === c); return { c, l, st: stats(l) }; });
    const last = S.sessions.slice(-4).reverse(); const wk = weak();
    render(`<h1>Entraînement aux tests de raisonnement AD5</h1>
      <div class="stats">
        <div class="stat"><b>${all.total}</b>questions disponibles</div>
        <div class="stat"><b>${all.tried}</b>questions déjà traitées</div>
        <div class="stat"><b>${all.n ? all.rate + ' %' : '–'}</b>bonnes réponses${all.n ? ` (${all.ok}/${all.n})` : ''}</div>
        <div class="stat"><b>${all.review}</b>à revoir${all.avg ? ` · ${all.avg} s / question` : ''}</div>
      </div>
      <h2>S’entraîner maintenant</h2>
      <div class="grid3">${cats.map(({ c, l, st }) => `<button class="cat" data-act="quick" data-cat="${c}" ${l.length ? '' : 'disabled'}><b>${CATS[c]}</b><span class="muted">${l.length ? `${l.length} questions · ${st.n ? st.rate + ' % de réussite' : 'pas encore commencé'}` : 'Questions à venir (lot suivant)'}</span><span class="bar" style="width:100%"><i style="width:${st.rate}%"></i></span></button>`).join('')}</div>
      <p class="muted">Un appui lance une série de ${S.settings.count} questions avec vos derniers réglages.</p>
      <div class="row" style="margin-top:6px"><button class="btn" data-act="setup">Personnaliser une série</button><button class="btn" data-act="exam-setup">Examen blanc</button><button class="btn" data-act="errors">Mes erreurs (${all.review})</button></div>
      ${wk.length ? `<h2>Points faibles à travailler</h2><div class="card">${wk.map((w) => `<div class="row between"><span>${esc(CATS[w.cat])} · ${esc(w.sub.replace(/_/g, ' '))}</span><b>${w.rate} %</b></div>`).join('')}</div>` : ''}
      ${last.length ? `<h2>Dernières sessions</h2><div class="card">${last.map((s) => `<div class="row between"><span>${new Date(s.date).toLocaleDateString('fr-BE')} · ${s.mode === 'exam' ? 'Examen blanc' : 'Entraînement'} · ${esc(s.label)}</span><b>${s.ok}/${s.total}</b></div>`).join('')}</div>` : ''}`);
  }

  function setup() {
    const s = S.settings;
    render(`<h1>Série d’entraînement</h1><div class="card">
      <label class="f">Catégorie<select id="s-cat"><option value="all">Toutes</option>${Object.keys(CATS).map((c) => `<option value="${c}" ${s.cat === c ? 'selected' : ''}>${CATS[c]}</option>`).join('')}</select></label>
      <label class="f">Difficulté<select id="s-diff"><option value="0">Toutes</option>${[1, 2, 3, 4].map((d) => `<option value="${d}" ${+s.diff === d ? 'selected' : ''}>${DIFFS[d]}</option>`).join('')}</select></label>
      <label class="f">Nombre de questions<select id="s-count">${[5, 10, 15, 20, 30].map((n) => `<option ${+s.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" id="s-perq" ${s.perQ ? 'checked' : ''}> Chronomètre par question</label>
      <label class="f">Durée par question (secondes, 0 = durée indicative de la question)<input type="number" id="s-perqsec" min="0" max="600" value="${s.perQSec}"></label>
      <label class="chk"><input type="checkbox" id="s-sess" ${s.sess ? 'checked' : ''}> Chronomètre global de session</label>
      <label class="f">Durée de la session (minutes)<input type="number" id="s-sessmin" min="1" max="120" value="${s.sessMin}"></label>
      <label class="chk"><input type="checkbox" id="s-hide" ${s.hide ? 'checked' : ''}> Masquer la correction jusqu’à la fin de la série</label>
      <p class="muted">Les deux chronomètres sont indépendants : désactivez-les pour vous entraîner sans compte à rebours.</p>
      <div class="row"><button class="btn primary" data-act="start-train">Commencer</button><button class="btn" data-act="home">Retour</button></div></div>`);
  }
  function readSetup() {
    const g = (id) => document.getElementById(id);
    Object.assign(S.settings, { cat: g('s-cat').value, diff: +g('s-diff').value, count: +g('s-count').value, perQ: g('s-perq').checked, perQSec: +g('s-perqsec').value || 0, sess: g('s-sess').checked, sessMin: +g('s-sessmin').value || 15, hide: g('s-hide').checked });
    save();
  }

  // ---------- sélection des questions ----------
  function pickQuestions(pool, n) {
    const scored = pool.map((q) => { const a = S.attempts[q.id]; let p = 2; if (a) p = a.last === 'ko' ? 3.5 : 1; if (a && a.ko > a.ok) p += 0.5; return { q, p: p + Math.random() * 1.6 }; });
    return scored.sort((a, b) => b.p - a.p).slice(0, n).map((x) => x.q.id).sort(() => Math.random() - 0.5);
  }
  function startTrain(opts) {
    const s = Object.assign({}, S.settings, opts.override || {});
    let pool = QS.filter((q) => (s.cat === 'all' || q.category === s.cat) && (!+s.diff || q.difficulty === +s.diff));
    if (opts.ids) pool = opts.ids.map((id) => BY[id]);
    if (!pool.length) { alert('Aucune question ne correspond à ces critères.'); return; }
    const ids = opts.ids ? opts.ids.slice().sort(() => Math.random() - 0.5).slice(0, opts.n || s.count) : pickQuestions(pool, s.count);
    session = { mode: opts.mode || 'train', label: opts.label || (s.cat === 'all' ? 'Toutes catégories' : CATS[s.cat]), ids, i: 0, ans: {}, s, startAt: Date.now(), deadlineS: s.sess ? Date.now() + s.sessMin * 60000 : null };
    showQ();
  }

  // ---------- séance : question ----------
  function curQ() { return BY[session.ids[session.i]]; }
  function showQ() {
    const q = curQ(); const a = session.ans[q.id] = session.ans[q.id] || { choice: null, sec: 0, late: false, done: false };
    a.shownAt = Date.now();
    const s = session.s;
    session.deadlineQ = s.perQ && !a.done ? Date.now() + (s.perQSec || q.estimatedTimeSeconds) * 1000 : null;
    session.qTotal = s.perQ ? (s.perQSec || q.estimatedTimeSeconds) : 0;
    const fav = S.favs.includes(q.id);
    render(`<div class="qhead"><span>Question ${session.i + 1} / ${session.ids.length} <span class="tag">${esc(CATS[q.category].replace('Raisonnement ', ''))}</span><span class="tag">${DIFFS[q.difficulty]}</span></span>
      <span class="row">${session.deadlineS ? '<span class="timer" id="t-sess" title="Temps de session"></span>' : ''}${session.deadlineQ ? '<span class="timer" id="t-q" title="Temps de la question"></span>' : ''}</span></div>
      ${session.deadlineQ ? '<div class="timer-bar" aria-hidden="true"><i id="t-bar" style="width:100%"></i></div>' : ''}
      <div id="qbox">${questionHtml(q, { choice: a.choice, locked: a.done && !session.s.hide ? true : false, reveal: a.done && !session.s.hide })}</div>
      <div id="fb">${a.done && !session.s.hide ? feedbackHtml(q, a) : ''}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" data-act="validate" id="b-val" ${a.choice && !a.done ? '' : 'disabled'} ${a.done ? 'hidden' : ''}>Valider</button>
        <button class="btn" data-act="skip" ${a.done ? 'hidden' : ''}>Passer</button>
        <button class="btn small" data-act="fav">${fav ? '★ Favori' : '☆ Favori'}</button>
        <button class="btn small" data-act="flag">Signaler</button>
        <button class="btn small" data-act="quit">Quitter</button>
      </div>`);
    startTick();
  }
  function feedbackHtml(q, a) {
    const ok = a.choice === q.correctAnswer;
    return `<p class="verdict ${ok ? 'ok' : 'ko'}">${ok ? 'Bonne réponse.' : `Réponse incorrecte — la bonne réponse est ${q.correctAnswer}.`}${a.late ? ' Temps écoulé : réponse donnée hors délai.' : ''}</p>${explHtml(q)}<div class="row"><button class="btn primary" data-act="next">${session.i + 1 < session.ids.length ? 'Question suivante' : 'Voir les résultats'}</button></div>`;
  }
  function addTime(a) { if (a.shownAt) { a.sec += Math.round((Date.now() - a.shownAt) / 1000); a.shownAt = 0; } }
  function record(q, a) {
    const r = S.attempts[q.id] = S.attempts[q.id] || { n: 0, ok: 0, ko: 0, sec: 0, last: null, hist: [] };
    const ok = a.choice === q.correctAnswer; r.n++; ok ? r.ok++ : r.ko++; r.sec += a.sec; r.last = ok ? 'ok' : 'ko'; r.hist.push({ t: Date.now(), ok, sec: a.sec }); if (r.hist.length > 20) r.hist.shift();
  }
  function validate() {
    const q = curQ(); const a = session.ans[q.id]; if (!a.choice || a.done) return;
    addTime(a); a.done = true; a.late = !!(session.deadlineQ && Date.now() > session.deadlineQ); record(q, a); save();
    if (session.s.hide) return next(); showQ();
  }
  function next() {
    const q = curQ(); addTime(session.ans[q.id]);
    if (session.i + 1 < session.ids.length) { session.i++; showQ(); } else finish();
  }

  // ---------- chronomètre (basé sur Date.now : robuste à la mise en veille) ----------
  function startTick() { stopTick(); tick = setInterval(updateTimers, 250); updateTimers(); }
  function stopTick() { if (tick) clearInterval(tick); tick = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && session) updateTimers(); });
  function updateTimers() {
    if (!session) return; const now = Date.now();
    if (session.exam) { const sec = session.exam.cur; const left = (sec.deadline - now) / 1000; const el = document.getElementById('t-sec'); if (el) { el.textContent = mmss(left); el.classList.toggle('low', left < 60); } if (left <= 0) endSection(true); return; }
    if (session.deadlineS) { const left = (session.deadlineS - now) / 1000; const el = document.getElementById('t-sess'); if (el) { el.textContent = 'Session ' + mmss(left); el.classList.toggle('low', left < 60); } if (left <= 0) { const q = curQ(); addTime(session.ans[q.id]); finish(true); return; } }
    if (session.deadlineQ) { const left = (session.deadlineQ - now) / 1000; const el = document.getElementById('t-q'); if (el) { el.textContent = left > 0 ? mmss(left) : 'Temps écoulé'; el.classList.toggle('low', left < 10); } const b = document.getElementById('t-bar'); if (b) b.style.width = Math.max(0, (left / session.qTotal) * 100) + '%'; }
  }

  // ---------- examen blanc ----------
  function examSetup() {
    render(`<h1>Examen blanc</h1><div class="card">
      <p>Choisissez les tests à passer. Chaque test est chronométré séparément et on ne revient pas au test précédent.</p>
      ${Object.keys(CATS).map((c) => { const n = QS.filter((q) => q.category === c).length; const o = OFFICIAL[c]; const k = Math.min(o.n, n); return `<label class="chk"><input type="checkbox" class="ex-cat" value="${c}" ${n ? 'checked' : 'disabled'}> ${CATS[c]} — ${n ? `${k} questions, ${Math.round((o.sec * k) / o.n / 60)} min` : 'pas encore de questions'}</label>`; }).join('')}
      <p class="muted"><strong>Format :</strong> verbal 20 questions / 35 min, numérique 10 / 20 min, abstrait 10 / 10 min (avis de concours EPSO/AD/427/26, tableau 2, JO C/2026/711). Seuils officiels : 10/20 en verbal, et 10/20 cumulés en numérique + abstrait. Si la banque contient moins de questions que le format, la durée est réduite proportionnellement.</p>
      <p class="muted">Le résultat est un pourcentage de réussite d’entraînement, pas un score EPSO. Non confirmé par l’avis : la navigation libre entre les questions d’un même test est une hypothèse d’entraînement.</p>
      <div class="row"><button class="btn primary" data-act="start-exam">Lancer l’examen</button><button class="btn" data-act="home">Retour</button></div></div>`);
  }
  function startExam() {
    const cs = [...document.querySelectorAll('.ex-cat:checked')].map((x) => x.value); if (!cs.length) { alert('Sélectionnez au moins un test.'); return; }
    const secs = cs.map((c) => { const pool = QS.filter((q) => q.category === c); const o = OFFICIAL[c]; const k = Math.min(o.n, pool.length); return { cat: c, ids: pickQuestions(pool, k), limit: Math.round((o.sec * k) / o.n) }; });
    session = { mode: 'exam', label: 'Examen blanc', ids: [], i: 0, ans: {}, s: { hide: true }, startAt: Date.now(), exam: { secs, idx: 0, cur: null } };
    openSection();
  }
  function openSection() {
    const e = session.exam; const sec = e.secs[e.idx]; sec.deadline = Date.now() + sec.limit * 1000; sec.started = Date.now(); e.cur = sec; session.ids = sec.ids; session.i = 0;
    showExamQ();
  }
  function showExamQ() {
    const e = session.exam; const sec = e.cur; const q = curQ(); const a = session.ans[q.id] = session.ans[q.id] || { choice: null, sec: 0 }; a.shownAt = Date.now();
    render(`<div class="qhead"><span>${esc(CATS[sec.cat])} · ${session.i + 1} / ${sec.ids.length}</span><span class="timer" id="t-sec"></span></div>
      <div id="qbox">${questionHtml(q, { choice: a.choice })}</div>
      <div class="qnav" aria-label="Questions">${sec.ids.map((id, i) => `<button data-act="goto" data-i="${i}" class="${session.ans[id] && session.ans[id].choice ? 'done' : ''} ${i === session.i ? 'cur' : ''}" aria-label="Question ${i + 1}${session.ans[id] && session.ans[id].choice ? ' répondue' : ''}">${i + 1}</button>`).join('')}</div>
      <p class="muted">${sec.ids.filter((id) => !(session.ans[id] && session.ans[id].choice)).length} question(s) sans réponse.</p>
      <div class="row"><button class="btn" data-act="prev" ${session.i ? '' : 'disabled'}>Précédente</button><button class="btn" data-act="nextq" ${session.i + 1 < sec.ids.length ? '' : 'disabled'}>Suivante</button><button class="btn primary" data-act="end-section">${e.idx + 1 < e.secs.length ? 'Terminer ce test' : 'Terminer l’examen'}</button></div>`);
    startTick();
  }
  function endSection(timeout) {
    stopTick(); const e = session.exam; const sec = e.cur; const q = curQ(); addTime(session.ans[q.id]);
    sec.used = Math.min(sec.limit, Math.round((Date.now() - sec.started) / 1000)); sec.timeout = !!timeout;
    sec.ids.forEach((id) => { const a = session.ans[id]; if (a && a.choice) { a.done = true; record(BY[id], a); } });
    save();
    if (e.idx + 1 < e.secs.length) { e.idx++; render(`<h1>${timeout ? 'Temps écoulé' : 'Test terminé'}</h1><p>Prochain test : <strong>${esc(CATS[e.secs[e.idx].cat])}</strong> — ${e.secs[e.idx].ids.length} questions, ${Math.round(e.secs[e.idx].limit / 60)} min. Le chronomètre démarre au clic.</p><button class="btn primary" data-act="open-section">Commencer</button>`); } else { session.ids = e.secs.flatMap((s) => s.ids); finish(false); }
  }

  // ---------- résultats ----------
  function finish(timeout) {
    stopTick(); const exam = !!session.exam; const ids = exam ? session.exam.secs.flatMap((s) => s.ids) : session.ids;
    if (!exam) ids.forEach((id) => { const a = session.ans[id]; if (a) addTime(a); });
    const ans = session.ans; let ok = 0, ko = 0, na = 0, sec = 0; const per = {}; const rev = [];
    ids.forEach((id) => { const q = BY[id]; const a = ans[id]; const p = per[q.category] = per[q.category] || { ok: 0, ko: 0, na: 0 }; sec += a ? a.sec : 0;
      if (!a || !a.choice || (!exam && !a.done)) { na++; p.na++; rev.push(q); } else if (a.choice === q.correctAnswer) { ok++; p.ok++; } else { ko++; p.ko++; rev.push(q); } });
    const total = ids.length; if (exam) sec = session.exam.secs.reduce((t, s) => t + (s.used || 0), 0);
    S.sessions.push({ date: Date.now(), mode: session.mode, label: session.label, total, ok, ko, na, sec }); S.sessions = S.sessions.slice(-50);
    if (exam) S.exams.push({ date: Date.now(), total, ok, ko, na, sec, per }); save();
    const res = session; session = null;
    render(`<h1>${exam ? 'Résultat de l’examen blanc' : 'Résultats de la série'}</h1>${timeout ? '<p class="verdict ko">Le temps imparti est écoulé.</p>' : ''}
      <div class="stats"><div class="stat"><b>${ok}</b>correctes</div><div class="stat"><b>${ko}</b>incorrectes</div><div class="stat"><b>${na}</b>sans réponse</div><div class="stat"><b>${pc(ok, total)} %</b>de réussite</div></div>
      <p class="muted">Temps total : ${mmss(sec)} · moyenne : ${total ? Math.round(sec / total) : 0} s par question.${exam ? ' Ce pourcentage est un indicateur d’entraînement, pas un score EPSO.' : ''}</p>
      <h2>Par catégorie</h2><div class="card">${Object.entries(per).map(([c, p]) => `<div class="row between"><span>${esc(CATS[c])}</span><b>${p.ok}/${p.ok + p.ko + p.na}</b></div>`).join('')}</div>
      ${rev.length ? `<h2>À revoir (${rev.length})</h2>${rev.map((q) => `<details><summary>${esc(q.id)} · ${esc(q.subcategory.replace(/_/g, ' '))}</summary>${questionHtml(q, { choice: res.ans[q.id] && res.ans[q.id].choice, reveal: true, locked: true })}${explHtml(q)}</details>`).join('')}` : '<p class="verdict ok">Aucune erreur sur cette série.</p>'}
      <div class="row" style="margin-top:14px"><button class="btn primary" data-act="home">Retour à l’accueil</button>${rev.length ? '<button class="btn" data-act="errors">Mes erreurs</button>' : ''}</div>`);
  }

  // ---------- mes erreurs ----------
  function errorsView(f) {
    f = f || {}; const cat = f.cat || 'all', diff = +f.diff || 0;
    const flt = (q) => (cat === 'all' || q.category === cat) && (!diff || q.difficulty === diff);
    const missed = QS.filter((q) => flt(q) && S.attempts[q.id] && S.attempts[q.id].last === 'ko');
    const rep = QS.filter((q) => flt(q) && S.attempts[q.id] && S.attempts[q.id].ko >= 2);
    const favs = QS.filter((q) => flt(q) && S.favs.includes(q.id));
    render(`<h1>Mes erreurs</h1><div class="card">
      <div class="row"><label class="f" style="flex:1">Catégorie<select id="e-cat"><option value="all">Toutes</option>${Object.keys(CATS).map((c) => `<option value="${c}" ${cat === c ? 'selected' : ''}>${CATS[c]}</option>`).join('')}</select></label>
      <label class="f" style="flex:1">Difficulté<select id="e-diff"><option value="0">Toutes</option>${[1, 2, 3, 4].map((d) => `<option value="${d}" ${diff === d ? 'selected' : ''}>${DIFFS[d]}</option>`).join('')}</select></label></div>
      <label class="chk"><input type="checkbox" id="e-hide"> Ne pas afficher la correction tout de suite</label>
      <div class="row"><button class="btn primary" data-act="redo" data-k="missed" ${missed.length ? '' : 'disabled'}>Refaire les questions ratées (${missed.length})</button>
      <button class="btn" data-act="redo" data-k="rep" ${rep.length ? '' : 'disabled'}>Ratées plusieurs fois (${rep.length})</button>
      <button class="btn" data-act="redo" data-k="favs" ${favs.length ? '' : 'disabled'}>Mes favoris (${favs.length})</button></div></div>
      <h2>Revoir les explications</h2>${missed.length ? missed.map((q) => `<details><summary>${esc(q.id)} · ${esc(CATS[q.category])} · ${esc(q.subcategory.replace(/_/g, ' '))}</summary>${questionHtml(q, { reveal: true, locked: true })}${explHtml(q)}</details>`).join('') : '<p class="muted">Aucune question ratée pour ces filtres.</p>'}
      <div class="row"><button class="btn" data-act="home">Retour</button></div>`);
    document.getElementById('e-cat').onchange = () => errorsView({ cat: document.getElementById('e-cat').value, diff: document.getElementById('e-diff').value });
    document.getElementById('e-diff').onchange = () => errorsView({ cat: document.getElementById('e-cat').value, diff: document.getElementById('e-diff').value });
    window.__errs = { missed: missed.map((q) => q.id), rep: rep.map((q) => q.id), favs: favs.map((q) => q.id) };
  }

  // ---------- réglages / export / PWA ----------
  function settingsView() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    render(`<h1>Réglages</h1>
      <div class="card"><h2 style="margin-top:0">Installer l’application</h2>
        ${installEvt ? '<button class="btn primary" data-act="install">Installer sur cet appareil</button>' : ''}
        <p>${ios ? 'Sur iPhone : ouvrez cette page dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».' : 'Sur Android et ordinateur : utilisez le bouton d’installation du navigateur (menu ⋮ → « Installer l’application »).'}</p>
        <p class="muted">Après le premier chargement complet en ligne, l’application et ses questions fonctionnent hors connexion.</p></div>
      <div class="card"><h2 style="margin-top:0">Sauvegarde de la progression</h2>
        <p class="muted">Les résultats restent sur cet appareil. Exportez-les pour les sauvegarder ou les transférer.</p>
        <div class="row"><button class="btn" data-act="export">Exporter (fichier JSON)</button><label class="btn">Importer<input type="file" id="imp" accept="application/json" hidden></label></div></div>
      <div class="card"><h2 style="margin-top:0">Chronomètre</h2><p class="muted">Le temps est calculé à partir de l’heure réelle : si le téléphone se verrouille ou si l’application passe en arrière-plan, le temps continue de s’écouler et le compte à rebours est recalculé au retour. En examen, un test expiré en arrière-plan est clôturé au retour.</p></div>
      <div class="card"><h2 style="margin-top:0">Données</h2><p class="muted">${S.flagged.length} question(s) signalée(s). Questions signalées : ${esc(S.flagged.join(', ') || 'aucune')}.</p><button class="btn small" data-act="reset">Effacer toute la progression</button></div>
      <button class="btn" data-act="home">Retour</button>`);
    const imp = document.getElementById('imp'); if (imp) imp.onchange = importData;
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'ad5-training', version: 1, exportedAt: new Date().toISOString(), data: S }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ad5-progression-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importData(ev) {
    const f = ev.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); if (j.app !== 'ad5-training' || !j.data || !j.data.attempts) throw new Error('format'); S = Object.assign(load(), j.data); save(); alert('Progression importée.'); home(); } catch (e) { alert('Fichier invalide : ce n’est pas une sauvegarde AD5 Training.'); } };
    r.readAsText(f);
  }

  // ---------- événements ----------
  $app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act;
    switch (act) {
      case 'home': home(); break;
      case 'quick': startTrain({ override: { cat: t.dataset.cat, diff: 0 } }); break;
      case 'setup': setup(); break;
      case 'start-train': readSetup(); startTrain({}); break;
      case 'exam-setup': examSetup(); break;
      case 'start-exam': startExam(); break;
      case 'open-section': openSection(); break;
      case 'errors': errorsView(); break;
      case 'pick': { const q = curQ(); const a = session.ans[q.id]; if (a.done && !session.exam) return; a.choice = t.dataset.id; document.querySelectorAll('.opt').forEach((b) => { const on = b.dataset.id === a.choice; b.classList.toggle('sel', on); b.setAttribute('aria-checked', on); }); const v = document.getElementById('b-val'); if (v) v.disabled = false; const nb = document.querySelector(`.qnav button[data-i="${session.i}"]`); if (nb) nb.classList.add('done'); break; }
      case 'validate': validate(); break;
      case 'skip': next(); break;
      case 'next': next(); break;
      case 'fav': { const q = curQ(); const i = S.favs.indexOf(q.id); if (i < 0) S.favs.push(q.id); else S.favs.splice(i, 1); save(); t.textContent = i < 0 ? '★ Favori' : '☆ Favori'; break; }
      case 'flag': { const q = curQ(); if (!S.flagged.includes(q.id)) S.flagged.push(q.id); save(); t.textContent = 'Signalée'; t.disabled = true; break; }
      case 'quit': if (confirm('Quitter la série ? Les réponses déjà validées sont conservées.')) { const q = curQ(); addTime(session.ans[q.id]); session.ids = session.ids.slice(0, session.i + (session.ans[q.id].done ? 1 : 0)); session.ids.length ? finish(false) : home(); } break;
      case 'goto': case 'prev': case 'nextq': { const q = curQ(); addTime(session.ans[q.id]); session.i = act === 'goto' ? +t.dataset.i : act === 'prev' ? session.i - 1 : session.i + 1; showExamQ(); break; }
      case 'end-section': if (confirm('Terminer ce test ? Vous ne pourrez plus y revenir.')) endSection(false); break;
      case 'redo': { const ids = window.__errs[t.dataset.k]; const hide = document.getElementById('e-hide').checked; startTrain({ ids, n: 15, mode: 'review', label: 'Révision', override: { hide } }); break; }
      case 'export': exportData(); break;
      case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; } break;
      case 'reset': if (confirm('Effacer définitivement toute la progression de cet appareil ?')) { S = Object.assign(load(), { attempts: {}, favs: [], flagged: [], sessions: [], exams: [] }); localStorage.removeItem(KEY); save(); home(); } break;
      default: break;
    }
  });
  document.getElementById('home-btn').onclick = () => { if (session && !confirm('Quitter la série en cours ?')) return; stopTick(); home(); };
  document.querySelectorAll('[data-nav]').forEach((b) => { b.onclick = () => { if (session && !confirm('Quitter la série en cours ?')) return; stopTick(); session = null; b.dataset.nav === 'errors' ? errorsView() : settingsView(); }; });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

  // ---------- démarrage ----------
  async function init() {
    try {
      const parts = await Promise.all(['verbal', 'numerical', 'abstract'].map((c) => fetch('data/' + c + '.json').then((r) => { if (!r.ok) throw new Error(c); return r.json(); })));
      QS = parts.flat(); BY = Object.fromEntries(QS.map((q) => [q.id, q])); home();
    } catch (e) { $app.innerHTML = '<h1>Questions indisponibles</h1><p>Impossible de charger la banque de questions. Si vous êtes hors connexion, ouvrez d’abord l’application une fois avec Internet pour la mettre en cache.</p>'; }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const show = (w) => { const b = document.getElementById('update'); b.hidden = false; document.getElementById('update-btn').onclick = () => w.postMessage({ type: 'SKIP_WAITING' }); };
      if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); }); });
    }).catch(() => { /* hors HTTPS : pas de mode hors ligne */ });
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } }); // pas de rechargement à la toute première installation
  }
  window.__ad5 = { get session() { return session; }, get state() { return S; } };
  init();
})();
