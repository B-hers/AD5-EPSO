/* Moteur de figures abstraites : règles explicites -> images -> rendu SVG.
   Module universel (navigateur + Node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Figures = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const FILL = { w: '#ffffff', g: '#a9bcc6', b: '#12343b' };
  const STROKE = '#12343b';
  // ordre de symétrie en rotation (degrés) : au-delà, deux rotations sont visuellement identiques
  const SYM = { circle: 1, square: 90, diamond: 90, cross: 90, triangle: 360, arrow: 360, L: 360, semi: 360 };
  const NAMES = { circle: 'cercle', square: 'carré', diamond: 'losange', triangle: 'triangle', arrow: 'flèche', L: 'équerre', cross: 'croix', semi: 'demi-disque' };
  const FILLNAMES = { w: 'blanc', g: 'gris', b: 'noir' };

  const r1 = (x) => Math.round(x * 10) / 10;

  function shapeSvg(shape, s) {
    const p = (pts) => `<polygon points="${pts.map((q) => q.map(r1).join(',')).join(' ')}"`;
    switch (shape) {
      case 'circle': return `<circle r="${s}"`;
      case 'square': return `<rect x="${-s}" y="${-s}" width="${2 * s}" height="${2 * s}"`;
      case 'diamond': return p([[0, -s], [s, 0], [0, s], [-s, 0]]);
      case 'triangle': return p([[0, -s], [s, s], [-s, s]]);
      case 'arrow': return p([[0, -s], [s, 0], [0.4 * s, 0], [0.4 * s, s], [-0.4 * s, s], [-0.4 * s, 0], [-s, 0]]);
      case 'L': return p([[-s, -s], [-0.3 * s, -s], [-0.3 * s, 0.3 * s], [s, 0.3 * s], [s, s], [-s, s]]);
      case 'cross': { const a = 0.32 * s; return p([[-a, -s], [a, -s], [a, -a], [s, -a], [s, a], [a, a], [a, s], [-a, s], [-a, a], [-s, a], [-s, -a], [-a, -a]]); }
      case 'semi': return `<path d="M${-s},${r1(s / 2)} A${s},${s} 0 0 1 ${s},${r1(s / 2)} Z"`;
      default: throw new Error('forme inconnue ' + shape);
    }
  }

  function elementSvg(e) {
    const n = e.n || 1;
    const sc = n >= 4 ? 0.55 : n === 3 ? 0.7 : n === 2 ? 0.85 : 1;
    const s = e.size * sc;
    const spacing = s * 2.4;
    let out = '';
    for (let i = 0; i < n; i++) {
      const x = e.cx + (i - (n - 1) / 2) * spacing;
      out += `<g transform="translate(${r1(x)} ${e.cy}) rotate(${e.rot || 0})">${shapeSvg(e.shape, s)} fill="${FILL[e.fill]}" stroke="${STROKE}" stroke-width="2.2" stroke-linejoin="round"/></g>`;
    }
    return out;
  }

  function frameSvg(frame, label, opts) {
    const o = opts || {};
    const inner = frame ? frame.els.map(elementSvg).join('') : `<text x="50" y="62" text-anchor="middle" font-size="46" font-weight="700" fill="${STROKE}">?</text>`;
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${label || 'Figure'}" class="fig"><rect x="1.5" y="1.5" width="97" height="97" rx="5" fill="${o.bg || '#fff'}" stroke="#b9c8cf" stroke-width="1.5"/>${inner}</svg>`;
  }

  // ---- évaluation des règles ----
  function ruleValue(r, t) {
    switch (r.kind) {
      case 'step': return r.start + r.d * t;
      case 'accel': return r.start + r.d0 * t + (r.dd * t * (t - 1)) / 2;
      case 'alt2': { let v = r.start; for (let i = 0; i < t; i++) v += i % 2 === 0 ? r.a : r.b; return v; }
      case 'cycle': return r.seq[t % r.seq.length];
      case 'path': return r.path[t % r.path.length];
      default: throw new Error('règle inconnue ' + r.kind);
    }
  }
  function applyAttr(el, attr, v) {
    if (attr === 'pos') { el.cx = v[0]; el.cy = v[1]; }
    else if (attr === 'rot') el.rot = ((v % 360) + 360) % 360;
    else el[attr] = v;
  }
  function slotAt(slot, t) {
    const el = Object.assign({ n: 1, rot: 0 }, slot.base);
    slot.rules.forEach((r) => applyAttr(el, r.attr, ruleValue(r, t)));
    return el;
  }
  function frameAt(spec, t) { return { els: spec.slots.map((s) => slotAt(s, t)) }; }

  function canon(frame) {
    return frame.els.map((e) => {
      const sym = SYM[e.shape];
      const rot = sym === 1 ? 0 : (((e.rot || 0) % sym) + sym) % sym;
      return [e.shape, r1(e.cx), r1(e.cy), r1(e.size), rot, e.fill, e.n || 1].join('|');
    }).sort().join('#');
  }

  // ---- descriptions françaises ----
  const posName = (p) => {
    const h = p[0] < 40 ? 'gauche' : p[0] > 60 ? 'droite' : 'centre';
    const v = p[1] < 40 ? 'haut' : p[1] > 60 ? 'bas' : 'milieu';
    return v === 'milieu' && h === 'centre' ? 'centre' : v === 'milieu' ? `milieu ${h}` : h === 'centre' ? `${v} centre` : `${v} ${h}`;
  };
  function describeRule(r, slot, multi) {
    const who = multi ? `la figure ${slot.base.cx < 50 ? 'de gauche' : 'de droite'}` : 'la figure';
    const sgn = (d) => (d > 0 ? `${d}° dans le sens horaire` : `${-d}° dans le sens antihoraire`);
    switch (r.attr + ':' + r.kind) {
      case 'rot:step': return `${who} tourne de ${sgn(r.d)} à chaque étape.`;
      case 'rot:accel': return `la rotation de ${who} s'accélère : elle tourne de ${r.d0}° puis de ${r.d0 + r.dd}°, puis de ${r.d0 + 2 * r.dd}°… (le pas augmente de ${r.dd}° à chaque étape, sens horaire).`;
      case 'rot:alt2': return `la rotation de ${who} alterne : ${sgn(r.a)}, puis ${sgn(r.b)}, puis de nouveau ${sgn(r.a)}…`;
      case 'fill:cycle': return `le remplissage de ${who} suit le cycle ${r.seq.map((k) => FILLNAMES[k]).join(' → ')} (puis recommence).`;
      case 'shape:cycle': return `la forme suit le cycle ${r.seq.map((k) => NAMES[k]).join(' → ')} (puis recommence).`;
      case 'size:step': return `la taille de ${who} ${r.d > 0 ? 'augmente' : 'diminue'} d'un cran régulier à chaque étape.`;
      case 'size:cycle': return `la taille de ${who} suit le cycle petit/moyen/grand défini par la suite ${r.seq.join(', ')} (puis recommence).`;
      case 'n:step': return `le nombre de formes ${r.d > 0 ? 'augmente' : 'diminue'} de ${Math.abs(r.d)} à chaque étape.`;
      case 'n:cycle': return `le nombre de formes alterne selon le cycle ${r.seq.join(' → ')} (puis recommence).`;
      case 'pos:path': return `${who} se déplace de case en case : ${r.path.map(posName).join(' → ')} (puis recommence au début).`;
      default: return 'règle ' + r.attr + ':' + r.kind;
    }
  }
  function describeSpec(spec) {
    const multi = spec.slots.length > 1;
    const out = [];
    spec.slots.forEach((s) => {
      if (!s.rules.length) out.push(`${multi ? `La figure ${s.base.cx < 50 ? 'de gauche' : 'de droite'}` : 'La figure'} (${NAMES[s.base.shape]}) reste identique : c'est un élément fixe qui ne fait pas partie de la règle.`);
      s.rules.forEach((r) => out.push(describeRule(r, s, multi)));
    });
    return out;
  }

  return { FILL, SYM, NAMES, FILLNAMES, shapeSvg, elementSvg, frameSvg, ruleValue, applyAttr, slotAt, frameAt, canon, describeRule, describeSpec, posName };
});
