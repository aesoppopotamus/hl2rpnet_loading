(function () {
  "use strict";

  // ==============================
  // DOM refs
  // ==============================
  var el = {
    status: document.getElementById("status"),
    node: document.getElementById("node"),
    sector: document.getElementById("sector"),
    mode: document.getElementById("mode"),
    cap: document.getElementById("cap"),
    bgVideo: document.getElementById("bg"),
    startGate: document.getElementById("startGate"),
    terminal: document.querySelector(".card.terminal") || document.querySelector(".terminal")
  };

  function setText(target, txt) {
    if (!target) return;
    target.textContent = (txt == null) ? "" : String(txt);
  }

  function norm(s) { return String(s || "").toLowerCase(); }

  // ==============================
  // Status mapping (GMod hook -> Combine-ish text)
  // ==============================
  function mapStatus(raw) {
    var s = raw || "";
    var n = norm(s);

    if (n.indexOf("retrieving server info") !== -1) return "HANDSHAKE…";
    if (n.indexOf("sending client info") !== -1) return "IDENTITY SUBMITTED…";
    if (n.indexOf("receiving client info") !== -1) return "IDENTITY CONFIRMED…";
    if (n.indexOf("signon") !== -1) return "SESSION NEGOTIATION…";

    if (n.indexOf("workshop") !== -1) return "ASSET INTAKE…";
    if (n.indexOf("downloading") !== -1) return "ASSET INTAKE…";
    if (n.indexOf("mounting") !== -1) return "ASSEMBLY…";
    if (n.indexOf("precaching") !== -1) return "STAGING…";

    if (n.indexOf("lua") !== -1) return "RUNTIME INITIALIZING…";

    return s || "PROCESSING…";
  }

  // ==============================
  // Rare "historical echo" overlay
  // ==============================
  var ECHO = {
    lines: [
      "ARCHIVAL NOTICE: CITY DORMANT · 14 CYCLES",
      "PRIOR DESIGNATION: VLADIVOSTOK",
      "POST-STORM ACTIVATION CONFIRMED",
      "REPOPULATION PHASE IN PROGRESS",
      "RESOURCE PROCESSING NODE · RES-77R"
    ],
    chance: 0.08,
    minMs: 8000,
    showMs: 2200,
    lastAt: 0,
    timer: null
  };

  function maybeEcho(currentMappedStatus) {
    if (!el.status) return;

    var now = Date.now();
    if ((now - ECHO.lastAt) < ECHO.minMs) return;
    if (Math.random() > ECHO.chance) return;

    ECHO.lastAt = now;

    var line = ECHO.lines[(Math.random() * ECHO.lines.length) | 0];
    setText(el.status, line);

    if (ECHO.timer) clearTimeout(ECHO.timer);
    ECHO.timer = setTimeout(function () {
      setText(el.status, currentMappedStatus);
      ECHO.timer = null;
    }, ECHO.showMs);
  }

  // ==============================
  // GMod hooks (exposed globally)
  // ==============================
  window.GameDetails = function (servername, serverurl, mapname, maxplayers, steamid, gamemode) {
    setText(el.node, servername || "UNSPECIFIED");
    setText(el.sector, mapname || "UNKNOWN");
    setText(el.mode, gamemode || "UNDEFINED");
    setText(el.cap, maxplayers ? String(maxplayers) : "—");

    // Hide any audio UI in real GMod context (if you have it)
    var audioBtn = document.getElementById("audioToggle");
    if (audioBtn) audioBtn.style.display = "none";
  };

  window.SetStatusChanged = function (s) {
    var mapped = mapStatus(s);
    setText(el.status, mapped);
    maybeEcho(mapped);
  };

  // Seed status
  setText(el.status, "CONNECTION INITIALIZATION…");

  // ==============================
  // Right-side number pool (DOM <pre id="rain"> if present, else created)
  // ==============================
  var RAIN = {
    rows: 22,
    cols: 14,
    tickMs: 140,
    charset: "0123456789",
    buf: [],
    timer: null
  };

  function ensureRainPre() {
    var pre = document.getElementById("rain");
    if (pre) return pre;

    if (!el.terminal) return null;

    var wrap = document.createElement("div");
    wrap.className = "terminal__rain";
    wrap.setAttribute("aria-hidden", "true");

    pre = document.createElement("pre");
    pre.id = "rain";

    wrap.appendChild(pre);
    el.terminal.appendChild(wrap);
    return pre;
  }

  function rainLine() {
    var s = "";
    for (var c = 0; c < RAIN.cols; c++) {
      s += RAIN.charset[(Math.random() * RAIN.charset.length) | 0];
      if ((c % 4) === 3) s += " ";
    }
    return s;
  }

  function startRain() {
    var pre = ensureRainPre();
    if (!pre) return;

    // seed
    RAIN.buf.length = 0;
    for (var r = 0; r < RAIN.rows; r++) RAIN.buf.push(rainLine());
    pre.textContent = RAIN.buf.join("\n");

    if (RAIN.timer) clearInterval(RAIN.timer);
    RAIN.timer = setInterval(function () {
      RAIN.buf.shift();
      RAIN.buf.push(rainLine());
      pre.textContent = RAIN.buf.join("\n");
    }, RAIN.tickMs);
  }

  // ==============================
  // Video selection + autoplay gate
  // ==============================
  var VIDEO = {
    list: [
      "assets/plaza.webm",
      "assets/train1.webm",
      "assets/citadel.webm",
      "assets/cp1.webm",
      "assets/c17.webm",
      "assets/hideout.webm",
      "assets/street.webm",
      "assets/cm1.webm",
      "assets/ruinbreen1.webm"
    ],
    vol: 0.4
  };

  function pickVideo() {
    return VIDEO.list[(Math.random() * VIDEO.list.length) | 0];
  }

  function hideGate() {
    if (!el.startGate) return;
    el.startGate.style.display = "none";
    el.startGate.onclick = null;
  }

  function showGate() {
    if (!el.startGate) return;

    el.startGate.style.display = "block";
    el.startGate.onclick = function () {
      try {
        el.bgVideo.muted = false;
        el.bgVideo.volume = VIDEO.vol;
        el.bgVideo.play();
      } catch (e) {}

      setTimeout(function () {
        if (el.bgVideo && !el.bgVideo.paused) hideGate();
      }, 120);
    };
  }

  function tryStartPlayback() {
    var p = null;
    try { p = el.bgVideo.play(); } catch (e) { p = null; }

    if (p && typeof p.then === "function") {
      p.then(hideGate).catch(showGate);
    } else {
      setTimeout(function () {
        if (!el.bgVideo || el.bgVideo.paused) showGate();
        else hideGate();
      }, 250);
    }
  }

  function initVideo() {
    if (!el.bgVideo) return;

    el.bgVideo.src = pickVideo();
    try { el.bgVideo.load(); } catch (e) {}

    el.bgVideo.loop = true;
    el.bgVideo.playsInline = true;

    // Attempt unmuted autoplay (may be blocked)
    el.bgVideo.muted = false;
    el.bgVideo.volume = VIDEO.vol;

    el.bgVideo.setAttribute("playsinline", "");
    el.bgVideo.setAttribute("autoplay", "");

    tryStartPlayback();
  }

  // ==============================
  // CEF-safe terminal background (canvas)
  // - No pseudo-elements
  // - No reliance on CSS gradients
  // ==============================
  var FX = {
    enabled: true,
    fps: 30,
    // teal bias / brightness
    glowAlpha: 0.42,
    shimmerAlpha: 0.14,
    scanAlpha: 0.08,
    bandAlpha: 0.05,
    gritBase: 0.02,
    vignette: 0.42,
    multiplyDark: 0.10,
    driftPxPerSec: 10,
    shimmerPeriodMs: 4200
  };

  function clamp(n, a, b) { return n < a ? a : (n > b ? b : n); }

  function ensureCanvas() {
    if (!el.terminal) return null;

    var c = document.getElementById("termBg");
    if (c) return c;

    c = document.createElement("canvas");
    c.id = "termBg";
    c.setAttribute("aria-hidden", "true");
    c.style.position = "absolute"
    c.style.inset = "0";
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.pointerEvents = "none";
    c.style.zIndex = "0";
    c.style.opacity = ".3";

    // Insert behind everything inside terminal
    el.terminal.insertBefore(c, el.terminal.firstChild);
    return c;
  }

  function sizeCanvas(canvas) {
    if (!canvas || !el.terminal) return { w: 1, h: 1, dpr: 1 };

    var r = el.terminal.getBoundingClientRect();
    var dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    var w = Math.max(1, Math.floor(r.width));
    var h = Math.max(1, Math.floor(r.height));
    var bw = Math.floor(w * dpr);
    var bh = Math.floor(h * dpr);

    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      canvas._cssW = w;
      canvas._cssH = h;
      canvas._dpr = dpr;
    }
    return { w: w, h: h, dpr: dpr };
  }

  function drawGlow(ctx, w, h, t) {
    var cx = w * 0.32, cy = h * 0.40;
  
    // main bloom
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.95);
    g.addColorStop(0.00, "rgba(140,255,255," + FX.glowAlpha + ")");
    g.addColorStop(0.40, "rgba(80,220,230," + (FX.glowAlpha * 0.65) + ")");
    g.addColorStop(1.00, "rgba(0,0,0,0)");
  
    // normal over (no blend mode)
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  
    // shimmer sweep
    var phase = (t % FX.shimmerPeriodMs) / FX.shimmerPeriodMs;
    var sx = -w * 0.6 + (w * 1.8) * phase;
  
    ctx.save();
    ctx.globalAlpha = FX.shimmerAlpha;
    ctx.translate(sx, 0);
    ctx.transform(1, 0, -0.22, 1, 0, 0);
  
    var g2 = ctx.createLinearGradient(0, 0, w * 0.7, 0);
    g2.addColorStop(0.0, "rgba(0,0,0,0)");
    g2.addColorStop(0.5, "rgba(180,255,255,0.55)");
    g2.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w * 0.7, h);
    ctx.restore();
  }

  function drawScan(ctx, w, h, drift) {
    ctx.save();
    ctx.globalAlpha = FX.scanAlpha;
    ctx.fillStyle = "rgba(180,255,255,1)";
    for (var y = (drift % 4); y < h; y += 4) ctx.fillRect(0, y, w, 1);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = FX.bandAlpha;
    ctx.fillStyle = "rgba(255,255,255,1)";
    for (var y2 = (drift % 48); y2 < h; y2 += 48) ctx.fillRect(0, y2, w, 2);
    ctx.restore();
  }

  function drawGrit(ctx, w, h) {
    // Cheap sprinkle noise
    var n = Math.floor((w * h) / 6500);
    ctx.save();
    for (var i = 0; i < n; i++) {
      var a = (Math.random() * 0.05) + FX.gritBase;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    ctx.restore();
  }

  function drawVignette(ctx, w, h) {
    var g = ctx.createRadialGradient(
      w * 0.5, h * 0.45, Math.min(w, h) * 0.18,
      w * 0.5, h * 0.45, Math.max(w, h) * 0.95
    );
    g.addColorStop(0.0, "rgba(0,0,0,0)");
    g.addColorStop(0.6, "rgba(0,0,0,0.18)");
    g.addColorStop(1.0, "rgba(0,0,0," + FX.vignette + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawBasePlate(ctx, w, h) {
    // Deep blue-green tint base
    ctx.fillStyle = "rgba(0, 18, 24, 0.62)";
    ctx.fillRect(0, 0, w, h);
  }

  var fxState = {
    canvas: null,
    ctx: null,
    drift: 0,
    lastT: 0,
    raf: null
  };

  function renderFX(t) {
    if (!FX.enabled || !fxState.ctx || !fxState.canvas) return;

    var w = fxState.canvas._cssW || fxState.canvas.clientWidth || 1;
    var h = fxState.canvas._cssH || fxState.canvas.clientHeight || 1;
    var dpr = fxState.canvas._dpr || 1;

    // drift
    if (!fxState.lastT) fxState.lastT = t;
    var dt = (t - fxState.lastT) / 1000;
    fxState.lastT = t;
    fxState.drift += dt * FX.driftPxPerSec;

    var ctx = fxState.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawBasePlate(ctx, w, h);
    drawGlow(ctx, w, h, t);
    drawScan(ctx, w, h, fxState.drift);
    drawGrit(ctx, w, h);
    drawVignette(ctx, w, h);

    // gentle dark tuck without blend modes
    ctx.save();
    ctx.globalAlpha = FX.multiplyDark;
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();


    fxState.raf = requestAnimationFrame(renderFX);
  }

  function initTerminalFX() {
    if (!FX.enabled || !el.terminal) return;
    try { el.terminal.style.overflow = "hidden"; } catch (e) {}

    var c = ensureCanvas();
    if (!c) return;

    fxState.canvas = c;
    fxState.ctx = c.getContext("2d", { alpha: true, desynchronized: true });

    sizeCanvas(c);
    setTimeout(function () { sizeCanvas(c); }, 60);
    setTimeout(function () { sizeCanvas(c); }, 220);

    window.addEventListener("resize", function () { sizeCanvas(c); });

    if (fxState.raf) cancelAnimationFrame(fxState.raf);
    fxState.lastT = 0;
    fxState.drift = 0;
    fxState.raf = requestAnimationFrame(renderFX);
  }

  // ==============================
  // Boot
  // ==============================
  function boot() {
    startRain();
    initTerminalFX();
    initVideo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
