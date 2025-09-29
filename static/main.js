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

  // Cache config across pages
  async function loadConfigOnce() {
    if (window.__CFG) return window.__CFG;
    const res = await fetch("/config", { cache: "no-store" });
    const cfg = await res.json();
    window.__CFG = cfg;
    return cfg;
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
  function lockPageGestures() {
    window.addEventListener(
      "gesturestart",
      (e) => {
        e.preventDefault();
        document.body.style.zoom = 1;
      },
      { passive: false }
    );
    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) e.preventDefault();
      },
      { passive: false }
    );
    document.addEventListener(
      "touchmove",
      (e) => {
        // allow moves inside our control zone only (we'll attach listeners there)
        // otherwise prevent scroll
        if (!e.target.closest("#control-zone")) e.preventDefault();
      },
      { passive: false }
    );
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
    const defs = document.getElementById("svg-defs");
    const control = document.getElementById("control-zone");
    const scoreEl = document.getElementById("score");
    const timerEl = document.getElementById("timer");
    const finishForm = document.getElementById("finish-form");
    const finishScore = document.getElementById("finish-score");

    // ---- Gameplay config
    const durationSec = cfg?.gameplay?.duration ?? 35;
    const spawnRate = cfg?.gameplay?.spawnRate ?? 0.8; // items per second
    const speedMul = cfg?.gameplay?.speed ?? 1.0;
    const baseScore = cfg?.gameplay?.scoring?.default ?? 10;

    // ---- Assets
    const cartSrc = cfg?.graphics?.cart;
    const itemSrcs = Array.isArray(cfg?.graphics?.items)
      ? cfg.graphics.items
      : [];
    // Preload PNGs (ignore errors to avoid blocking)
    const preloadTargets = [cartSrc, ...itemSrcs].filter(Boolean);
    await Promise.allSettled(preloadTargets.map(preloadImage));

    // ---- Cart (PNG or SVG <image>)
// ---- Cart (1:1 box + image fit) ----
const CART_BOX_SIZE = Number(cfg?.graphics?.cartBoxSize ?? 250);        // ukuran kotak cart (width=height)
const CART_MARGIN_BOTTOM = 10;    // jarak dari bawah

// posisi awal cart (kiri-atas kotak)
let cartBoxX = (VB_WIDTH - CART_BOX_SIZE) / 2;
let cartBoxY = VB_HEIGHT - CART_BOX_SIZE - CART_MARGIN_BOTTOM;

// cart image (PNG/SVG) di-fit ke dalam box (sedikit scaling biar tidak mepet)
const cartImgScale  = Number(cfg?.graphics?.cartImgScale ?? 0.9); // 90% dari box
const cartImgW = CART_BOX_SIZE * cartImgScale;
const cartImgH = CART_BOX_SIZE * cartImgScale;

// elemen gambar cart
const cartEl = document.createElementNS(SVG_NS, "image");
setImageHref(cartEl, cartSrc);
svg.appendChild(cartEl);

// fungsi update posisi cart (gambar dipusatkan dalam box)
function layoutCart() {
  const imgX = cartBoxX + (CART_BOX_SIZE - cartImgW) / 2;
  const imgY = cartBoxY + (CART_BOX_SIZE - cartImgH) / 2;
  cartEl.setAttribute("x", String(imgX));
  cartEl.setAttribute("y", String(imgY));
  cartEl.setAttribute("width", String(cartImgW));
  cartEl.setAttribute("height", String(cartImgH));
}
layoutCart();

// helper: pindahkan cart berdasarkan clientX (drag) — VERSI BARU
function moveCartToClientX(clientX) {
  const rect = svg.getBoundingClientRect();
  const rel = (clientX - rect.left) / rect.width; // 0..1
  const centerX = rel * VB_WIDTH;
  cartBoxX = clamp(centerX - CART_BOX_SIZE / 2, 0, VB_WIDTH - CART_BOX_SIZE);
  layoutCart(); // ini yang update posisi <image> cart
}

    // ---- Items pool (object pool to avoid GC thrash)
    const ITEM_W = 128;
    const ITEM_H = 128;
    const MAX_ITEMS = 64; // cap to avoid too many nodes

    const pool = [];
    const active = []; // {el,x,y,vy}
    function createItemEl() {
      const el = document.createElementNS(SVG_NS, "image");
      el.setAttribute("width", ITEM_W);
      el.setAttribute("height", ITEM_H);
      return el;
    }
    function acquireItem() {
      return pool.length ? pool.pop() : createItemEl();
    }
    function releaseItem(node) {
      try {
        svg.removeChild(node);
      } catch (_) {}
      pool.push(node);
    }

    function spawnItem() {
      if (!itemSrcs.length) return;
      if (active.length >= MAX_ITEMS) return;

      // Bomb chance & penalty from config
      const bombChance = Number(cfg?.gameplay?.bombChance ?? 0.15);
      const isBomb = Math.random() < bombChance;

      // choose source: bomb image (if configured) else a random normal item
      const src = isBomb
        ? cfg?.graphics?.bomb || itemSrcs[(Math.random() * itemSrcs.length) | 0]
        : itemSrcs[(Math.random() * itemSrcs.length) | 0];

      const el = acquireItem();
      setImageHref(el, src);

      // visually tag bomb (data attr) so you can style it via CSS or add effects later
      if (isBomb) {
        el.setAttribute("data-bomb", "1");
        // Optional: add rotation or CSS class via SVG <image> not trivial — leave data attr for now
      } else {
        el.removeAttribute("data-bomb");
      }

      const x = Math.random() * (VB_WIDTH - ITEM_W);
      const y = -ITEM_H - 20;
      const vy = 300 * speedMul + Math.random() * 120 * speedMul;

      el.setAttribute("x", String(x));
      el.setAttribute("y", String(y));
      svg.appendChild(el);

      active.push({ el, x, y, vy, isBomb });
    }

    function setImageHref(el, url) {
      // SVG2 'href' + legacy xlink for safety
      el.setAttributeNS(null, "href", url);
      el.setAttributeNS(XLINK_NS, "xlink:href", url);
    }

    // ------- DRAG CONTROL (press & hold to move) -------
    let isDragging = false;
    let activePointerId = null;

    // Start drag on either layer (SVG or control zone)
    [control, svg].forEach((el) => {
      el.addEventListener("pointerdown", onPointerDown, { passive: false });
    });

    function onPointerDown(e) {
      // Only primary pointer (mouse left button or a touch)
      if (e.button !== undefined && e.button !== 0) return;

      activePointerId = e.pointerId;
      isDragging = true;

      // Capture so we keep receiving events initially
      e.currentTarget.setPointerCapture?.(activePointerId);
      e.preventDefault();

      // Move immediately on initial press
      moveCartToClientX(e.clientX);

      // While dragging, listen globally so we don't miss moves
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp, { passive: true });
      window.addEventListener("pointercancel", onPointerUp, { passive: true });
      window.addEventListener("lostpointercapture", onPointerUp, {
        passive: true,
      });
    }

    function onPointerMove(e) {
      if (!isDragging || e.pointerId !== activePointerId) return;
      // Prevent page scroll/gestures on touch
      e.preventDefault();
      moveCartToClientX(e.clientX);
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointerId) return;

      isDragging = false;
      activePointerId = null;

      try {
        document.releasePointerCapture?.(e.pointerId);
      } catch {}

      // Remove global listeners
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("lostpointercapture", onPointerUp);
    }

    // ---- Main loop
    let running = true;
    let score = 0;
    let remaining = durationSec;
    let spawnAcc = 0;
    const spawnInterval = 1 / spawnRate;
    let lastT = performance.now();

    // Update HUD initially
    scoreEl.textContent = "0";
    timerEl.textContent = String(remaining);

    // === FEEDBACK HELPERS ===

    // 1) HUD flash merah singkat
    function flashHudForBomb() {
      const hud = document.querySelector(".hud");
      if (!hud) return;
      hud.classList.add("hud-flash");
      setTimeout(() => hud.classList.remove("hud-flash"), 150);
    }

    // 2) Cart shake
    function shakeCart() {
      if (!cartEl) return;
      cartEl.classList.add("cart-hit");
      setTimeout(() => cartEl.classList.remove("cart-hit"), 170);
    }

    // 3) Tampilkan delta skor (mis. −10) melayang
    const scoreDeltaEl = document.getElementById("score-delta");
    function showScoreDelta(amount) {
      if (!scoreDeltaEl) return;
      // amount negatif untuk bomb
      const text = amount > 0 ? `+${amount}` : `${amount}`;
      scoreDeltaEl.textContent = text;
      scoreDeltaEl.style.color = amount < 0 ? "#ff4d4f" : "#66ff66";
      scoreDeltaEl.classList.remove("show"); // reset anim kalau beruntun
      // force reflow agar animasi bisa restart
      // eslint-disable-next-line no-unused-expressions
      scoreDeltaEl.offsetWidth;
      scoreDeltaEl.classList.add("show");
    }

    // Second-based timer separate from rAF
    const timerId = setInterval(() => {
      remaining -= 1;
      if (remaining < 0) remaining = 0;
      timerEl.textContent = String(remaining);
      if (remaining <= 0) endGame();
    }, 1000);

    // Visibility pause (avoid runaway when tab loses focus)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        running = false;
      } else if (remaining > 0) {
        // resume
        lastT = performance.now();
        running = true;
        requestAnimationFrame(loop);
      }
    });

    requestAnimationFrame(loop);

    function loop(t) {
      if (!running) return;
      const dt = Math.min((t - lastT) / 1000, 0.033); // cap at ~33ms
      lastT = t;

      // Spawn logic
      spawnAcc += dt;
      while (spawnAcc >= spawnInterval) {
        spawnAcc -= spawnInterval;
        spawnItem();
      }

      // Move items & collisions
      for (let i = active.length - 1; i >= 0; i--) {
        const it = active[i];
        it.y += it.vy * dt;
        it.el.setAttribute("y", String(it.y));

        // Collision (AABB)
        if (aabb(it.x, it.y, ITEM_W, ITEM_H, cartBoxX, cartBoxY, CART_BOX_SIZE, CART_BOX_SIZE)) {
          if (it.isBomb) {
            const penalty = Number(cfg?.gameplay?.bombPenalty ?? 10);
            score = Math.max(0, score - penalty); // clamp ke 0
            flashHudForBomb(); // <<< HUD flash merah
            shakeCart(); // <<< cart shake
            showScoreDelta(-penalty); // <<< badge -10 melayang
          } else {
            score += baseScore;
            showScoreDelta(+baseScore); // opsional: tampilin +10 juga
          }

          scoreEl.textContent = String(score);

          releaseItem(it.el);
          active.splice(i, 1);
          continue;
        }

        // Out of screen
        if (it.y > VB_HEIGHT + ITEM_H) {
          releaseItem(it.el);
          active.splice(i, 1);
        }
      }

      requestAnimationFrame(loop);
    }

    function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
      // Axis-Aligned Bounding Box overlap
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    // ---- End game & cleanup
    function endGame() {
      if (!running) return;
      running = false;
      clearInterval(timerId);

      // cleanup active items
      while (active.length) {
        const it = active.pop();
        if (it) releaseItem(it.el);
      }

      finishScore.value = String(score);
      finishForm.submit();
    }

    // ---- Operator panic reset (long-press top-right corner 3s)
    let pressT = 0;
    document.addEventListener("pointerdown", (e) => {
      const w = window.innerWidth,
        h = window.innerHeight;
      const atTopRight = e.clientX > w - 100 && e.clientY < 100;
      if (atTopRight) pressT = Date.now();
    });
    document.addEventListener("pointerup", () => {
      if (pressT && Date.now() - pressT > 3000) {
        window.location.href = "/";
      }
      pressT = 0;
    });
  }
})();
