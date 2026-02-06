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
  // Boot (no terminal background FX)
  // ==============================
  function boot() {
    startRain();
    initVideo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
