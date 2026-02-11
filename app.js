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
    bgm: document.getElementById("bgm"),
    startGate: document.getElementById("startGate"),
    terminal: document.querySelector(".card.terminal") || document.querySelector(".terminal")
  };

  function setText(target, txt) {
    if (!target) return;
    target.textContent = (txt == null) ? "" : String(txt);
  }

  function norm(s) { return String(s || "").toLowerCase(); }
  function isFn(v) { return typeof v === "function"; }

  var STATE = {
    inGMod: false,
    allowGateAt: 0
  };

  function detectGModContext() {
    var proto = norm(window.location && window.location.protocol);
    var ua = norm(window.navigator && window.navigator.userAgent);

    if (proto === "asset:" || proto === "gmod:") return true;
    if (ua.indexOf("gmod") !== -1) return true;
    if (ua.indexOf("awesomium") !== -1) return true;

    return false;
  }

  function clampVol(v) {
    var n = Number(v);
    if (isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  function applyVideoVolume() {
    if (!el.bgVideo) return;
    try { el.bgVideo.volume = clampVol(VIDEO.vol); } catch (e) {}
  }

  function applyMusicVolume() {
    if (!el.bgm) return;
    try { el.bgm.volume = clampVol(MUSIC.vol); } catch (e) {}
  }

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
    STATE.inGMod = true;
    hideGate();

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
    ],
    vol: 0.1
  };

  var MUSIC = {
    list: [
      "assets/background.mp3",
      "assets/godspeed.mp3",
      "assets/goteberg.mp3",
      "assets/scum.mp3",
      "assets/bones.mp3",
      "assets/precipice.mp3",
    ],
    vol: 0.1
  };

  function pickVideo() {
    return VIDEO.list[(Math.random() * VIDEO.list.length) | 0];
  }

  function pickMusic() {
    return MUSIC.list[(Math.random() * MUSIC.list.length) | 0];
  }

  function pickNextMusic(currentSrc) {
    var list = MUSIC.list;
    if (!list.length) return "";
    if (list.length === 1) return list[0];

    var currentName = String(currentSrc || "").split("/").pop();
    var next = "";

    do {
      next = list[(Math.random() * list.length) | 0];
    } while (next.split("/").pop() === currentName);

    return next;
  }

  function hideGate() {
    if (!el.startGate) return;
    el.startGate.style.display = "none";
    el.startGate.onclick = null;
  }

  function showGate() {
    if (STATE.inGMod) return;
    if (Date.now() < STATE.allowGateAt) return;
    if (!el.startGate) return;

    el.startGate.style.display = "block";
    el.startGate.onclick = function () {
      try {
        el.bgVideo.muted = false;
        applyVideoVolume();
        el.bgVideo.play();
      } catch (e) {}

      try {
        if (el.bgm) {
          el.bgm.muted = false;
          applyMusicVolume();
          el.bgm.play();
        }
      } catch (e) {}

      setTimeout(function () {
        var videoOk = !el.bgVideo || !el.bgVideo.paused;
        var audioOk = !el.bgm || !el.bgm.paused;
        if (videoOk && audioOk) hideGate();
      }, 120);
    };
  }

  function tryStartPlayback() {
    var videoPromise = null;
    var audioPromise = null;

    try { videoPromise = el.bgVideo.play(); } catch (e) { videoPromise = null; }
    try { if (el.bgm) audioPromise = el.bgm.play(); } catch (e) { audioPromise = null; }

    var promises = [];
    if (videoPromise && typeof videoPromise.then === "function") promises.push(videoPromise);
    if (audioPromise && typeof audioPromise.then === "function") promises.push(audioPromise);

    if (promises.length) {
      Promise.all(promises).then(hideGate).catch(function () {
        if (!STATE.inGMod) showGate();
      });
    } else {
      setTimeout(function () {
        var videoBlocked = el.bgVideo && el.bgVideo.paused;
        var audioBlocked = el.bgm && el.bgm.paused;
        if ((videoBlocked || audioBlocked) && !STATE.inGMod) showGate();
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
    applyVideoVolume();

    if (isFn(el.bgVideo.addEventListener)) {
      el.bgVideo.addEventListener("loadedmetadata", applyVideoVolume);
      el.bgVideo.addEventListener("canplay", applyVideoVolume);
      el.bgVideo.addEventListener("play", applyVideoVolume);
    }

    el.bgVideo.setAttribute("playsinline", "");
    el.bgVideo.setAttribute("autoplay", "");

    tryStartPlayback();
  }

  function initAudio() {
    if (!el.bgm) return;

    el.bgm.src = pickMusic();
    try { el.bgm.load(); } catch (e) {}

    el.bgm.loop = false;
    el.bgm.preload = "auto";
    el.bgm.muted = false;
    applyMusicVolume();
    el.bgm.setAttribute("autoplay", "");

    if (isFn(el.bgm.addEventListener)) {
      el.bgm.addEventListener("loadedmetadata", applyMusicVolume);
      el.bgm.addEventListener("canplay", applyMusicVolume);
      el.bgm.addEventListener("play", applyMusicVolume);
    }

    el.bgm.onended = function () {
      var next = pickNextMusic(el.bgm.currentSrc);
      if (!next) return;

      el.bgm.src = next;
      try { el.bgm.load(); } catch (e) {}
      applyMusicVolume();
      try { el.bgm.play(); } catch (e) {}
    };
  }

  // ==============================
  // Boot (no terminal background FX)
  // ==============================
  function boot() {
    STATE.inGMod = detectGModContext();
    STATE.allowGateAt = Date.now() + 2500;
    if (STATE.inGMod) hideGate();
    startRain();
    initAudio();
    initVideo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
