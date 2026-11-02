const root = document.documentElement;
root.classList.add('js');
const page = document.querySelector('.page');
const svg = document.getElementById('thread');
const path = document.getElementById('thread-path');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Most the line may draw per pixel scrolled. Higher is faster.
const MAX_RATE = 10, MAX_RATE_NARROW = 8;
let total = 0, cur = 0, stops = [], table = [];

function centre(el) {
  const p = page.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - p.left + r.width / 2, y: r.top - p.top + r.height / 2, el };
}

function build() {
  const narrow = innerWidth < 704;
  const wiggle = narrow ? 5 : 16;
  const dots = [...document.querySelectorAll('main .dot')].filter(d => d.offsetParent);
  const pts = dots.map(centre);
  const pw = page.clientWidth;
  const segs = [`M${pts[0].x} ${pts[0].y}`];
  const ends = [0];
  let sign = 1, curl = 0;

  const top = el => el.getBoundingClientRect().top - page.getBoundingClientRect().top;
  const h1Bottom = document.querySelector('h1').getBoundingClientRect().bottom - page.getBoundingClientRect().top;
  const gx = centre(document.querySelector('section > .dot')).x;
  const mapTop = top(document.querySelector('.places'));
  const isStop = p => p.el.parentElement.classList.contains('stop');
  // Bow of each hop between cities: positive curves to the walker's right.
  const bows = [.25, .16, -.17, .3, -.16];
  let hop = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1], pre = '';
    const b = pts[i];
    if (i === 1) {
      // Out of the full stop, under the name, down beside the story, then onto the map.
      const y2 = h1Bottom + 20, y3 = y2 + 44, mid = (a.x + gx) / 2;
      const yT = mapTop - (narrow ? 26 : 34);
      segs.push(`C${a.x + 26} ${a.y + 30} ${a.x + 10} ${y2} ${a.x - 40} ${y2} L${mid} ${y2} C${gx + 50} ${y2} ${gx} ${y2} ${gx} ${y3} L${gx} ${yT - 40} C${gx} ${yT + 4} ${b.x} ${yT - 8} ${b.x} ${b.y}`);
      path.setAttribute('d', segs.join(' '));
      ends.push(path.getTotalLength());
      continue;
    }
    if (isStop(a) && isStop(b)) {
      const bow = bows[hop++];
      const d = `Q${(a.x + b.x) / 2 - (b.y - a.y) * bow} ${(a.y + b.y) / 2 + (b.x - a.x) * bow} ${b.x} ${b.y}`;
      segs.push(d);
      path.setAttribute('d', segs.join(' '));
      ends.push(path.getTotalLength());
      continue;
    }
    if (isStop(a)) {
      // Off the map over the Pacific, into the gutter.
      const y3 = a.y + (narrow ? 60 : 110);
      pre = `C${a.x - (narrow ? 8 : 26)} ${a.y + (y3 - a.y) * .45} ${gx} ${a.y + (y3 - a.y) * .4} ${gx} ${y3} `;
      a = { x: gx, y: y3 };
    }
    const dy = b.y - a.y;
    let d;
    if (b.el.parentElement.tagName === 'SECTION') {
      // Section change: run down the gutter, then swing out across the empty gap.
      const sec = b.el.parentElement;
      const prevBottom = sec.previousElementSibling.getBoundingClientRect().bottom - page.getBoundingClientRect().top;
      const yA = Math.max(a.y + 4, prevBottom + 10), yB = b.y - 34;
      const x0 = b.x, first = `L${x0} ${yA}`;
      const m = (yA + yB) / 2, h = yB - yA;
      let swing;
      if (curl++ % 2) {
        const W = Math.min(pw * (narrow ? .6 : .34), 340);
        swing = `C${x0} ${yA + h * .5} ${x0 + W} ${yA} ${x0 + W} ${m} C${x0 + W} ${yB} ${x0} ${yB - h * .5} ${x0} ${yB}`;
      } else {
        // A pen curl: down, out to the right, back over itself, and down again.
        const W = narrow ? 120 : 190;
        swing = `C${x0} ${yB} ${x0 + W} ${yB} ${x0 + W} ${m} C${x0 + W} ${yA} ${x0} ${yA} ${x0} ${yB}`;
      }
      d = `${first} ${swing} L${b.x} ${b.y}`;
    } else {
      const w = Math.min(wiggle, Math.abs(dy) / 6) * sign; sign = -sign;
      d = `C${a.x + w} ${a.y + dy / 3} ${b.x - w} ${b.y - dy / 3} ${b.x} ${b.y}`;
    }
    segs.push(pre + d);
    path.setAttribute('d', segs.join(' '));
    ends.push(path.getTotalLength());
  }
  total = ends[ends.length - 1];
  stops = pts.map((p, i) => ({ el: p.el, at: ends[i] }));

  // Length-to-page-height table: how far the line may be drawn for a given scroll.
  table = [];
  // Where the route doubles back, as on the map, it would otherwise be drawn all at once.
  const rate = narrow ? MAX_RATE_NARROW : MAX_RATE;
  let maxY = -Infinity;
  for (let l = 0; l <= total; l += 12) {
    maxY = Math.max(maxY + 12 / rate, path.getPointAtLength(l).y);
    table.push({ l, maxY });
  }
  path.style.strokeDasharray = total;
  path.style.strokeDashoffset = total - cur;
  svg.style.height = page.scrollHeight + 'px';
}

function target() {
  if (reduced) return total;
  const y = innerHeight * .72 - page.getBoundingClientRect().top;
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) return total;
  let lo = 0, hi = table.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; table[m].maxY <= y ? lo = m : hi = m - 1; }
  return table[lo] ? table[lo].l : 0;
}

function paint() {
  stops.forEach(s => s.el.classList.toggle('on', cur >= s.at - 2));
  path.style.strokeDashoffset = Math.max(total - cur, 0);
}

let running = false;
function tick() {
  const t = target();
  const step = (t - cur) * .09;
  cur = Math.abs(t - cur) < 1 ? t : cur + Math.sign(step) * Math.max(Math.abs(step), 2);
  paint();
  if (cur !== t) requestAnimationFrame(tick); else running = false;
}
function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

function rebuild() { build(); if (reduced) cur = total; kick(); paint(); }
addEventListener('scroll', kick, { passive: true });
new ResizeObserver(rebuild).observe(page);
document.fonts.ready.then(rebuild);
rebuild();
