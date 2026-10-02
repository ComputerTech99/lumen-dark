const root = document.documentElement;
const isTop = window === window.top;
const KEEP = "lumen-keep";
const ALWAYS_KEEP = "d2l-navigation-main-footer"; // the purple course navbar

// ---------- colour helpers ----------
function parse(str) {
  const m = str && str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  return { r: r / 255, g: g / 255, b: b / 255, a };
}
function toHsl({ r, g, b, a }) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l, a };
}
const toCss = ({ h, s, l, a }) =>
  `hsla(${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%, ${a})`;

// ---------- which strategy does this frame need? ----------
// "app":     D2L's own interface, full of shadow DOM -> shown inverted.
// "content": author-written lesson HTML -> shown normally, then recoloured.
let fixedMode = null;
function detectMode() {
  if (isTop) return "app";
  if (fixedMode) return fixedMode;
  const urlSaysApp = location.pathname.startsWith("/d2l/");
  if (document.readyState === "loading" || !document.body) return urlSaysApp ? "app" : "content";
  const hasD2l = urlSaysApp ||
    [...document.body.querySelectorAll("*")].some((el) => el.localName.startsWith("d2l-"));
  return (fixedMode = hasD2l ? "app" : "content");
}

// How the parent frame currently appears on screen: inverted or normal.
function parentView() {
  try {
    const v = window.parent.document.documentElement.dataset.lumenView;
    if (v) return v;
  } catch {}
  return window.parent === window.top ? "inv" : "norm";
}

let enabled = true;
let mode = "app";

function applyState() {
  mode = detectMode();
  let filter = false, view = "inv";
  if (!isTop) {
    const pv = parentView();
    if (mode === "app") { filter = pv === "norm"; view = "inv"; }
    else { filter = pv === "inv"; view = "norm"; }
  }
  const cl = root.classList;
  cl.toggle("lumen-on", enabled);
  cl.toggle("lumen-top", enabled && isTop);
  cl.toggle("lumen-filter", enabled && filter);
  cl.toggle("lumen-inv", enabled && view === "inv");
  cl.toggle("lumen-app", enabled && mode === "app");
  cl.toggle("lumen-content", enabled && mode === "content");
  if (enabled) root.dataset.lumenView = view;
  else delete root.dataset.lumenView;
  if (changed.length && (!enabled || mode !== "content")) restore();
  if (flipped.size && !(enabled && view === "inv")) unflipAll();
}

// ---------- inverted frames: restore strongly coloured blocks ----------
const keepSeen = new WeakSet();
function isSaturatedDark(el) {
  const c = parse(getComputedStyle(el).backgroundColor);
  if (!c || c.a < 0.5) return false;
  const { s, l } = toHsl(c);
  return s > 0.25 && l < 0.6;
}
function hasLightInside(el) {
  for (const d of el.querySelectorAll("*")) {
    const c = parse(getComputedStyle(d).backgroundColor);
    if (c && c.a > 0.5 && toHsl(c).l > 0.8) return true;
  }
  return false;
}
function keepScan(els) {
  for (const el of els) {
    if (keepSeen.has(el)) continue;
    keepSeen.add(el);
    if (el.localName === ALWAYS_KEEP) { el.classList.add(KEEP); continue; }
    if (el.parentElement?.closest("." + KEEP)) continue;
    if (isSaturatedDark(el) && !hasLightInside(el)) el.classList.add(KEEP);
  }
}

// ---------- lesson content: per-element recolouring ----------
let recolourSeen = new WeakSet();
const changed = []; // [element, property, previous value, previous priority]

function plan(el) {
  const cs = getComputedStyle(el), out = [];
  const bg = parse(cs.backgroundColor);
  if (bg && bg.a > 0.05) {
    const c = toHsl(bg);
    if (c.l > 0.55) out.push(["background-color", toCss({ ...c, s: c.s * 0.6, l: 0.1 + (1 - c.l) * 0.4 })]);
  }
  const fg = parse(cs.color);
  if (fg) {
    const c = toHsl(fg);
    if (c.l < 0.6) out.push(["color", toCss({ ...c, l: 0.92 - c.l * 0.35 })]);
  }
  for (const side of ["top", "right", "bottom", "left"]) {
    if (parseFloat(cs.getPropertyValue(`border-${side}-width`)) === 0) continue;
    const p = `border-${side}-color`;
    const bc = parse(cs.getPropertyValue(p));
    if (bc && bc.a > 0.05) {
      const c = toHsl(bc);
      if (c.l > 0.6) out.push([p, toCss({ ...c, l: 0.25 })]);
    }
  }
  return out;
}

function recolour(els) {
  const todo = els.filter((el) => !recolourSeen.has(el));
  const plans = todo.map((el) => [el, plan(el)]); // read everything first...
  for (const [el, props] of plans) {               // ...then write, in one pass
    recolourSeen.add(el);
    for (const [p, v] of props) {
      changed.push([el, p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]);
      el.style.setProperty(p, v, "important");
    }
  }
}

function restore() {
  for (const [el, p, v, pr] of changed.reverse()) {
    if (v) el.style.setProperty(p, v, pr);
    else el.style.removeProperty(p);
  }
  changed.length = 0;
  recolourSeen = new WeakSet();
}

// ---------- media hidden inside shadow DOM (e.g. D2L's video player) ----------
// Page CSS can't reach into shadow DOM, but an inline style on the player
// component itself can, so the whole player (video, captions, controls)
// is flipped back to its real colours.
const FLIP = "invert(1) hue-rotate(180deg)";
const flipped = new Set();

function flipHost(el) {
  if (!el || flipped.has(el) || insideFlipped(el)) return;
  for (const f of [...flipped]) {
    let n = f.parentElement ?? f.getRootNode().host;
    while (n && n !== el) n = n.parentElement ?? n.getRootNode().host;
    if (n === el) { f.style.removeProperty("filter"); flipped.delete(f); }
  }
  flipped.add(el);
  el.style.setProperty("filter", FLIP, "important");
}
function unflipAll() {
  for (const el of flipped) el.style.removeProperty("filter");
  flipped.clear();
  shadowChecked = new WeakSet();
}
// A frame we can't look into belongs to another site (YouTube, Vimeo...).
function isForeignFrame(f) {
  try { return f.contentDocument === null; } catch { return true; }
}
// True if something above `el` (crossing shadow boundaries) is already
// flipped back, so flipping `el` too would turn it negative again.
function insideFlipped(el) {
  let n = el.parentElement ?? el.getRootNode().host;
  while (n) {
    if (flipped.has(n) || n.classList?.contains(KEEP)) return true;
    n = n.parentElement ?? n.getRootNode().host;
  }
  return false;
}
function flipSelf(el) {
  if (flipped.has(el) || insideFlipped(el)) return;
  flipped.add(el);
  el.style.setProperty("filter", FLIP, "important");
}

// Pictures inside shadow DOM: <img>, <canvas>, and photo-sized elements
// painted with a CSS background image (banners, course cards).
let shadowChecked = new WeakSet();
function isShadowPicture(el) {
  if (el.localName === "img") return !/\.svg(\?|$)/i.test(el.currentSrc || el.src || "");
  if (el.localName === "canvas") return true;
  if (shadowChecked.has(el)) return false;
  shadowChecked.add(el);
  if (!getComputedStyle(el).backgroundImage.includes("url(")) return false;
  return el.offsetWidth >= 48 && el.offsetHeight >= 48; // skip icons
}

const mediaActive = () => enabled && root.classList.contains("lumen-inv");

// Check one element. `sr` is the shadow root it lives in (null = light DOM).
function checkEl(el, sr) {
  const isPlayer = el.localName === "video" || (el.localName === "iframe" && isForeignFrame(el));
  if (isPlayer) {
    if (sr) flipHost(sr.host);
    else if (el.localName === "iframe") el.classList.add(KEEP);
  } else if (sr && !flipped.has(el) && isShadowPicture(el)) {
    flipSelf(el);
  }
  if (el.shadowRoot) {
    watchRoot(el.shadowRoot);
    scanTree(el.shadowRoot, el.shadowRoot);
  } else if (el.localName.includes("-")) {
    awaitShadow(el); // a component whose code hasn't loaded yet
  }
}
function scanTree(container, sr) {
  if (container.nodeType === 1) checkEl(container, sr);
  for (const el of container.querySelectorAll("*")) checkEl(el, sr);
}

// Watch each shadow root so new pictures are fixed the instant D2L draws them.
const watched = new WeakSet();
function watchRoot(sr) {
  if (watched.has(sr)) return;
  watched.add(sr);
  new MutationObserver((muts) => {
    if (!mediaActive()) return;
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scanTree(n, sr);
  }).observe(sr, { childList: true, subtree: true });
}

// Components often get their shadow root a moment after insertion, which no
// observer reports, so briefly poll just those few elements.
const pendingHosts = new Map(); // element -> time first seen
let pendingTimer = null;
function awaitShadow(el) {
  if (pendingHosts.has(el)) return;
  pendingHosts.set(el, performance.now());
  if (!pendingTimer) pendingTimer = setInterval(checkPending, 50);
}
function checkPending() {
  const now = performance.now();
  for (const [el, t] of pendingHosts) {
    if (el.shadowRoot) {
      pendingHosts.delete(el);
      if (mediaActive()) {
        watchRoot(el.shadowRoot);
        scanTree(el.shadowRoot, el.shadowRoot);
      }
    } else if (!el.isConnected || now - t > 5000) {
      pendingHosts.delete(el); // never became a shadow host; stop watching
    }
  }
  if (!pendingHosts.size) { clearInterval(pendingTimer); pendingTimer = null; }
}

function mediaScan() {
  if (document.body) scanTree(document.body, null);
  for (const el of flipped) if (!el.isConnected) flipped.delete(el);
}

// Slow safety net for anything the observers can't see (e.g. a background
// image swapped in later).
setInterval(() => { if (mediaActive() && !document.hidden) mediaScan(); }, 4000);

// ---------- only process what's new, on the next frame ----------
const queue = new Set();
let scheduled = false;
function enqueue(node) {
  queue.add(node);
  if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
}
function flush() {
  scheduled = false;
  const roots = [...queue];
  queue.clear();
  if (!enabled) return;
  applyState();
  const els = [];
  for (const r of roots) if (r.isConnected) els.push(r, ...r.querySelectorAll("*"));
  if (mode === "content") recolour(els);
  else {
    keepScan(els);
    for (const r of roots) if (r.isConnected) scanTree(r, null);
  }
}

// ---------- wiring ----------
function setOn(on) {
  enabled = on;
  applyState();
  if (!on) root.classList.remove("lumen-pending");
  else if (document.body) { enqueue(document.body); flush(); }
}

// Only the top page decides whether dark mode is on (an iframe's idea of
// the system theme can differ); frames mirror it so the page never splits.
function topRoot() {
  if (isTop) return null;
  try { return window.top.document.documentElement; } catch { return null; }
}
const mirror = topRoot();

if (mirror) {
  const follow = () => {
    const on = mirror.classList.contains("lumen-on");
    if (on !== enabled) setOn(on);
  };
  new MutationObserver(follow).observe(mirror, { attributes: true, attributeFilter: ["class"] });
  enabled = mirror.classList.contains("lumen-on");
} else {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  let userMode = "on";
  const sync = () => {
    const on = userMode === "on" || (userMode === "auto" && mql.matches);
    if (on !== enabled) setOn(on);
  };
  mql.addEventListener("change", sync);
  chrome.storage.local.get(["mode", "enabled"], (r) => {
    userMode = r.mode ?? (r.enabled === false ? "off" : "on");
    sync();
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.mode) { userMode = c.mode.newValue; sync(); }
  });
}

// Lets the keyboard shortcut ask what the page is showing right now.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === "lumen-state" && isTop) reply(enabled);
});

applyState(); // instantly, so nothing flashes white
if (enabled && mode === "content") root.classList.add("lumen-pending");
setTimeout(() => root.classList.remove("lumen-pending"), 1000); // safety net

document.addEventListener("DOMContentLoaded", () => {
  applyState(); // now the DOM exists, confirm which kind of frame this is
  if (enabled) { enqueue(document.body); flush(); }
  root.classList.remove("lumen-pending");
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) enqueue(n);
  }).observe(document.body, { childList: true, subtree: true });
});
