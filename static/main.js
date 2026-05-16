/* static/main.js
 * Kiosk Game Frontend (vanilla JS, touch-first)
 * Pages: welcome -> game -> scoreboard
 * ViewBox: 1080x1920 (portrait)
 */
(() => {
  // --------------------------
  // Global helpers
  // --------------------------
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const VB_WIDTH = 1080;
  const VB_HEIGHT = 1920;

  async function loadConfigOnce() {
    const res = await fetch("/config?v=" + Date.now(), { cache: "no-store" });
    const cfg = await res.json();
    return cfg; // jangan simpan ke window.__CFG saat dev
  }

  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }

  // Utility: clamp number
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

  // Anti accidental zoom/scroll in kiosk
  // (CSS should also disable overscroll; this is extra guard)
  function onGestureStart(e) {
    e.preventDefault();
    document.body.style.zoom = 1;
  }
  function onWheel(e) {
    if (e.ctrlKey) e.preventDefault();
  }
  function onTouchMove(e) {
    if (!e.target.closest("#control-zone")) e.preventDefault();
  }

  function lockPageGestures() {
    window.addEventListener("gesturestart", onGestureStart, { passive: false });
    window.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
  }

  function unlockPageGestures() {
    window.removeEventListener("gesturestart", onGestureStart);
    window.removeEventListener("wheel", onWheel);
    document.removeEventListener("touchmove", onTouchMove);
  }

  // --------------------------
  // Page router
  // --------------------------
  const page = document.body.dataset.page;
  if (page === "welcome") initWelcome();
  if (page === "game") initGamePage();
  if (page === "scoreboard") initScoreboardPage();

  // --------------------------
  // Welcome page
  // --------------------------
  function initWelcome() {
    lockPageGestures();
    // Autofocus first input if present
    const first = document.querySelector('input[name="name"]');
    if (first) first.focus();
  }

  // --------------------------
  // Scoreboard page
  // --------------------------
  async function initScoreboardPage() {
    lockPageGestures();
    const cfg = await loadConfigOnce();
    const secs = cfg?.ux?.autoReturnSeconds ?? 12;
    setTimeout(() => {
      window.location.href = "/";
    }, secs * 1000);
  }

  // --------------------------
  // Game page
  // --------------------------
async function initGamePage() {
  lockPageGestures();
  const cfg = await loadConfigOnce();

  // ---- DOM refs
  const svg = document.getElementById("game-svg");
  const control = document.getElementById("control-zone");
  const scoreEl = document.getElementById("score");
  const timerEl = document.getElementById("timer");
  const finishForm = document.getElementById("finish-form");
  const finishScore = document.getElementById("finish-score");

  // ---- Gameplay config (global)
  const durationSec = Number(cfg?.gameplay?.duration ?? 100);
  const spawnRate   = Number(cfg?.gameplay?.spawnRate ?? 0.8);
  const globalSpeed = Number(cfg?.gameplay?.speed ?? 1.0);
  const defaultScore= Number(cfg?.gameplay?.scoring?.default ?? 10);
  const defaultPenalty = Number(cfg?.gameplay?.bombPenalty ?? 50);
  const MAX_ITEMS = Number(cfg?.gameplay?.maxItems ?? 20);

  // ---- Assets: normalize items/bombs (boleh string atau object di config)
  const cartSrc = cfg?.graphics?.cart;

  const rawItems = Array.isArray(cfg?.graphics?.items) ? cfg.graphics.items : [];
  const rawBombs = Array.isArray(cfg?.graphics?.bombs)
      ? cfg.graphics.bombs
      : (cfg?.graphics?.bomb ? [{ src: cfg.graphics.bomb }] : []);

  function normItem(x) {
    if (typeof x === "string") x = { src: x };
    return {
      kind: "item",
      src: String(x.src || ""),
      label: x.label || "",
      weight: Number(x.weight ?? 1),
      width: Number(x.width ?? x.size ?? 128),
      height: Number(x.height ?? x.size ?? 128),
      speedMul: Number(x.speedMul ?? 1),
      score: Number(x.score ?? defaultScore),
    };
  }
  function normBomb(x) {
    if (typeof x === "string") x = { src: x };
    return {
      kind: "bomb",
      src: String(x.src || ""),
      label: x.label || "Bomb",
      weight: Number(x.weight ?? 1),
      width: Number(x.width ?? x.size ?? 128),
      height: Number(x.height ?? x.size ?? 128),
      speedMul: Number(x.speedMul ?? 1),
      penalty: Number(x.penalty ?? defaultPenalty),
    };
  }

  const itemsCfg = rawItems.map(normItem).filter(o => o.src);
  const bombsCfg = rawBombs.map(normBomb).filter(o => o.src);
  const candidates = [...itemsCfg, ...bombsCfg];

  if (!candidates.length) {
    console.warn("No spawn candidates found. Check config.graphics.items/bombs.");
  }

  // ---- Preload semua gambar (URL string)
  const preloadTargets = [cartSrc, ...candidates.map(candidate => candidate.src)].filter(Boolean);
  await Promise.allSettled(preloadTargets.map(preloadImage));

  // ---- Cart (1:1 box + image fit)
  const CART_BOX_SIZE     = Number(cfg?.graphics?.cartBoxSize ?? 250);
  const CART_MARGIN_BOTTOM= 100;
  let cartBoxX = (VB_WIDTH - CART_BOX_SIZE) / 2;
  let cartBoxY = VB_HEIGHT - CART_BOX_SIZE - CART_MARGIN_BOTTOM;

  const cartImgScale = Number(cfg?.graphics?.cartImgScale ?? 0.9);
  const cartImgW = CART_BOX_SIZE * cartImgScale;
  const cartImgH = CART_BOX_SIZE * cartImgScale;

  const cartEl = document.createElementNS(SVG_NS, "image");
  setImageHref(cartEl, cartSrc);
  svg.appendChild(cartEl);

  function layoutCart() {
    const imgX = cartBoxX + (CART_BOX_SIZE - cartImgW) / 2;
    const imgY = cartBoxY + (CART_BOX_SIZE - cartImgH) / 2 + 10;
    cartEl.setAttribute("x", String(imgX));
    cartEl.setAttribute("y", String(imgY));
    cartEl.setAttribute("width", String(cartImgW));
    cartEl.setAttribute("height", String(cartImgH));
  }
  layoutCart();

  function moveCartToClientX(clientX) {
    const rect = svg.getBoundingClientRect();
    const normalizedX = (clientX - rect.left) / rect.width; // 0..1
    const centerX = normalizedX * VB_WIDTH;
    cartBoxX = clamp(centerX - CART_BOX_SIZE / 2, 0, VB_WIDTH - CART_BOX_SIZE);
    layoutCart();
  }

  // ---- Pool & active objects (pakai ukuran per item)
  const pool = [];
  const activeItems = []; // {el, x, y, width, height, velocityY, isBomb, score, penalty}

  function createItemEl() {
    const el = document.createElementNS(SVG_NS, "image");
    return el;
  }
  function acquireItem() {
    return pool.length ? pool.pop() : createItemEl();
  }
  function releaseItem(node) {
    try { svg.removeChild(node); } catch {}
    pool.push(node);
  }

  function setImageHref(el, url) {
    el.setAttributeNS(null, "href", url);
    el.setAttributeNS(XLINK_NS, "xlink:href", url);
  }

  function pickWeighted(arr) {
    const totalWeight = arr.reduce((sum, entry) => sum + (entry.weight || 0), 0);
    if (totalWeight <= 0) return arr[0];
    let remaining = Math.random() * totalWeight;
    for (const entry of arr) {
      remaining -= entry.weight || 0;
      if (remaining <= 0) return entry;
    }
    return arr[arr.length - 1];
  }

  function spawnItem() {
    if (!candidates.length) return;
    if (activeItems.length >= MAX_ITEMS) return;

    const candidate = pickWeighted(candidates);
    const el = acquireItem();
    setImageHref(el, candidate.src);

    const itemWidth = candidate.width;
    const itemHeight = candidate.height;

    const spawnX = Math.random() * (VB_WIDTH - itemWidth);
    const spawnY = -itemHeight - 20;

    const baseSpeed = 300 + Math.random() * 120;
    const velocityY = baseSpeed * globalSpeed * (candidate.speedMul || 1);

    el.setAttribute("x", String(spawnX));
    el.setAttribute("y", String(spawnY));
    el.setAttribute("width", String(itemWidth));
    el.setAttribute("height", String(itemHeight));

    if (candidate.kind === "bomb") {
      el.setAttribute("data-bomb", "1");
    } else {
      el.removeAttribute("data-bomb");
    }

    svg.appendChild(el);

    activeItems.push({
      el, x: spawnX, y: spawnY, width: itemWidth, height: itemHeight, velocityY,
      isBomb: candidate.kind === "bomb",
      score: candidate.score ?? 0,
      penalty: candidate.penalty ?? 0,
    });
  }

// ------- DRAG CONTROL (A + B): must start on cart + grip offset -------
let isDragging = false;
let activePointerId = null;
let gripOffsetX = 0; // selisih antara titik sentuh & pusat cart saat mulai

const HIT_TOL = 12; // toleransi hit cart (px koordinat viewBox)

// hit-test: apakah pointerdown dimulai di area cart (dengan toleransi)
function isPointerOnCart(clientX, clientY) {
  const rect = svg.getBoundingClientRect(); // selalu pakai rect SVG
  const normalizedX = (clientX - rect.left) / rect.width;   // 0..1
  const normalizedY = (clientY - rect.top) / rect.height;   // 0..1
  const x = normalizedX * VB_WIDTH;
  const y = normalizedY * VB_HEIGHT;
  return (
    x >= (cartBoxX - HIT_TOL) &&
    x <= (cartBoxX + CART_BOX_SIZE + HIT_TOL) &&
    y >= (cartBoxY - HIT_TOL) &&
    y <= (cartBoxY + CART_BOX_SIZE + HIT_TOL)
  );
}

// pindahkan cart berdasarkan pusat yang diinginkan (bukan clientX langsung)
function moveCartCenterTo(centerX) {
  cartBoxX = clamp(centerX - CART_BOX_SIZE / 2, 0, VB_WIDTH - CART_BOX_SIZE);
  layoutCart();
}

// Pasang listener di KEDUANYA: svg dan control-zone
[svg, control].forEach((target) => {
  target.addEventListener("pointerdown", onPointerDown, { passive: false });
});

function onPointerDown(e) {
  // hanya pointer utama
  if (e.button !== undefined && e.button !== 0) return;

  // wajib mulai di cart; kalau tidak, abaikan (tidak teleport)
  if (!isPointerOnCart(e.clientX, e.clientY)) return;

  isDragging = true;
  activePointerId = e.pointerId;

  // hitung grip offset supaya tidak lompat
  const rect = svg.getBoundingClientRect();
  const normalizedX = (e.clientX - rect.left) / rect.width;
  const pointerX = normalizedX * VB_WIDTH;
  const cartCenterX = cartBoxX + CART_BOX_SIZE / 2;
  gripOffsetX = pointerX - cartCenterX;

  e.preventDefault();
  (e.currentTarget).setPointerCapture?.(activePointerId);

  // listen global selama drag
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  window.addEventListener("lostpointercapture", onPointerUp, { passive: true });
}

function onPointerMove(e) {
  if (!isDragging || e.pointerId !== activePointerId) return;
  e.preventDefault();

  const rect = svg.getBoundingClientRect();
  const normalizedX = (e.clientX - rect.left) / rect.width;
  const pointerX = normalizedX * VB_WIDTH;

  const desiredCenterX = pointerX - gripOffsetX;
  moveCartCenterTo(desiredCenterX);
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  isDragging = false;
  activePointerId = null;
  gripOffsetX = 0;

  try { (e.currentTarget)?.releasePointerCapture?.(e.pointerId); } catch {}

  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
  window.removeEventListener("lostpointercapture", onPointerUp);
}



  // === FEEDBACK HELPERS ===
  function flashHudForBomb() {
    const hud = document.querySelector(".hud");
    if (!hud) return;
    hud.classList.add("hud-flash");
    setTimeout(() => hud.classList.remove("hud-flash"), 150);
  }
  function shakeCart() {
    if (!cartEl) return;
    cartEl.classList.add("cart-hit");
    setTimeout(() => cartEl.classList.remove("cart-hit"), 170);
  }
  const scoreDeltaEl = document.getElementById("score-delta");
  function showScoreDelta(amount) {
    if (!scoreDeltaEl) return;
    const text = amount > 0 ? `+${amount}` : `${amount}`;
    scoreDeltaEl.textContent = text;
    scoreDeltaEl.style.color = amount < 0 ? "#ff4d4f" : "#66ff66";

    // posisi mengikuti cart
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / VB_WIDTH;
    const scaleY = rect.height / VB_HEIGHT;
    const cartCenterClientX = rect.left + (cartBoxX + CART_BOX_SIZE / 2) * scaleX;
    const cartTopClientY = rect.top + (cartBoxY - 60) * scaleY;
    scoreDeltaEl.style.left = `${cartCenterClientX}px`;
    scoreDeltaEl.style.top = `${cartTopClientY}px`;

    scoreDeltaEl.classList.remove("show");
    // eslint-disable-next-line no-unused-expressions
    scoreDeltaEl.offsetWidth;
    scoreDeltaEl.classList.add("show");
  }

  // ---- Main loop
  let running = true;
  let score = 0;
  let remaining = durationSec;
  let spawnAccumulator = 0;
  const spawnInterval = 1 / spawnRate;
  let lastFrameTime = performance.now();
  let rafId = 0;

  scoreEl.textContent = "0";
  timerEl.textContent = String(remaining);

  const timerId = setInterval(() => {
    remaining -= 1;
    if (remaining < 0) remaining = 0;
    timerEl.textContent = String(remaining);
    if (remaining <= 0) endGame();
  }, 1000);

  function onVisibilityChange() {
    if (document.hidden) {
      running = false;
    } else if (remaining > 0) {
      lastFrameTime = performance.now();
      running = true;
      rafId = requestAnimationFrame(loop);
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  rafId = requestAnimationFrame(loop);

  function loop(timestamp) {
    if (!running) return;
    const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.033);
    lastFrameTime = timestamp;

    // Spawn logic
    spawnAccumulator += deltaTime;
    while (spawnAccumulator >= spawnInterval) {
      spawnAccumulator -= spawnInterval;
      spawnItem();
    }

    // Move items & collisions
    for (let i = activeItems.length - 1; i >= 0; i--) {
      const item = activeItems[i];
      item.y += item.velocityY * deltaTime;
      item.el.setAttribute("y", String(item.y));

      // Collision (AABB) terhadap cart box 1:1
      if (aabb(item.x, item.y, item.width, item.height, cartBoxX, cartBoxY, CART_BOX_SIZE, CART_BOX_SIZE)) {
        if (item.isBomb) {
          const penalty = item.penalty || defaultPenalty;
          score = Math.max(0, score - penalty);
          flashHudForBomb(); shakeCart(); showScoreDelta(-penalty);
        } else {
          const gain = item.score || defaultScore;
          score += gain;
          showScoreDelta(+gain);
        }
        scoreEl.textContent = String(score);

        releaseItem(item.el);
        activeItems.splice(i, 1);
        continue;
      }

      // Out of screen
      if (item.y > VB_HEIGHT + item.height) {
        releaseItem(item.el);
        activeItems.splice(i, 1);
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ---- End game & cleanup
  function endGame() {
    if (!running) return;
    running = false;
    clearInterval(timerId);
    cancelAnimationFrame(rafId);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    unlockPageGestures();

    while (activeItems.length) {
      const item = activeItems.pop();
      if (item) releaseItem(item.el);
    }

    finishScore.value = String(score);
    finishForm.submit();
  }

  // ---- Operator panic reset (long-press top-right corner 3s)
  let panicPressTimestamp = 0;
  document.addEventListener("pointerdown", (e) => {
    const screenWidth = window.innerWidth;
    const atTopRight = e.clientX > screenWidth - 100 && e.clientY < 100;
    if (atTopRight) panicPressTimestamp = Date.now();
  });
  document.addEventListener("pointerup", () => {
    if (panicPressTimestamp && Date.now() - panicPressTimestamp > 3000) window.location.href = "/";
    panicPressTimestamp = 0;
  });
}
})();
