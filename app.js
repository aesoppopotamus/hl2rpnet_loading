// ==============================
// Combine terminal HUD hooks
// ==============================
var statusEl = document.getElementById("status");
var nodeEl   = document.getElementById("node");
var sectorEl = document.getElementById("sector");
var modeEl   = document.getElementById("mode");
var capEl    = document.getElementById("cap");
var scanEl   = document.getElementById("scan");

function setText(el, txt) {
  if (!el) return;
  el.textContent = txt || "";
}

function norm(s) { return (s || "").toLowerCase(); }

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

window.GameDetails = function (servername, serverurl, mapname, maxplayers, steamid, gamemode) {
  setText(nodeEl,   servername || "UNSPECIFIED");
  setText(sectorEl, mapname || "UNKNOWN");
  setText(modeEl,   gamemode || "UNDEFINED");
  setText(capEl,    maxplayers ? String(maxplayers) : "—");

  // Hide any audio UI in real GMod context
  var audioBtn = document.getElementById("audioToggle");
  if (audioBtn) audioBtn.style.display = "none";
};

window.SetStatusChanged = function (s) {
  setText(statusEl, mapStatus(s));
  maybeEcho();
};

// Cosmetic scan animation (NOT progress)
(function startScan() {
  if (!scanEl) return;
  var t0 = new Date().getTime();

  function tick() {
    var t = (new Date().getTime() - t0) / 1400;
    var p = t % 1;
    scanEl.style.width = Math.round(p * 100) + "%";
    setTimeout(tick, 33);
  }
  tick();
})();

setText(statusEl, "CONNECTION INITIALIZATION…");

// ==============================
// Historical echo (rare overlay)
// ==============================
var ECHO_LINES = [
  "ARCHIVAL NOTICE: CITY DORMANT · 14 CYCLES",
  "PRIOR DESIGNATION: VLADIVOSTOK",
  "POST-STORM ACTIVATION CONFIRMED",
  "REPOPULATION PHASE IN PROGRESS",
  "RESOURCE PROCESSING NODE · RES-77R"
];

// Tunables
var ECHO_CHANCE = 0.08;      // 8% per eligible status update
var ECHO_MIN_MS = 8000;      // at least 8s between echoes
var ECHO_SHOW_MS = 2200;     // echo visible for 2.2s

var _lastEchoAt = 0;
var _echoTimer = null;

function maybeEcho() {
  if (!statusEl) return;

  var now = Date.now();
  if (now - _lastEchoAt < ECHO_MIN_MS) return;
  if (Math.random() > ECHO_CHANCE) return;

  _lastEchoAt = now;

  var line = ECHO_LINES[Math.floor(Math.random() * ECHO_LINES.length)];
  var prev = statusEl.textContent;

  statusEl.textContent = line;

  if (_echoTimer) clearTimeout(_echoTimer);
  _echoTimer = setTimeout(function () {
    // restore whatever the current mapped status should be
    statusEl.textContent = prev;
    _echoTimer = null;
  }, ECHO_SHOW_MS);
}


// ==============================
// Video selection + playback
// ==============================
var v = document.getElementById("bg");
var startGate = document.getElementById("startGate");

var VIDEOS = [
  "assets/plaza.webm",
  "assets/train2.webm",
  "assets/citadel.webm",
  "assets/cp1.webm",
  "assets/c17.webm",
];

function pickVideo() {
  return VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
}

function arrayIncludes(arr, val) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === val) return true;
  }
  return false;
}

function initVideo() {
  if (!v) return;

  // Assign randomized video and force a load cycle.
  v.src = pickVideo();
  try { v.load(); } catch (e) {}

  v.loop = true;
  v.playsInline = true;

  // ATTEMPT: autoplay UNMUTED (often blocked by Chromium policy)
  v.muted = false;
  v.volume = 0.4;

  // Some embedded builds behave better if reflected as attributes
  v.setAttribute("playsinline", "");
  v.setAttribute("autoplay", "");

  tryStartPlayback();
}

function tryStartPlayback() {
  var p = null;

  try {
    p = v.play();
  } catch (e) {
    p = null;
  }

  // If promise-capable, use it. Otherwise check paused after a beat.
  if (p && typeof p.then === "function") {
    p.then(function () {
      hideGate();
    }).catch(function () {
      showGate();
    });
  } else {
    setTimeout(function () {
      if (v.paused) showGate();
      else hideGate();
    }, 250);
  }
}

function showGate() {
  if (!startGate) return;

  // Chromium blocked unmuted autoplay — user gesture required.
  startGate.style.display = "block";

  startGate.onclick = function () {
    // Try again, still unmuted
    try {
      v.muted = false;
      v.volume = 0.4;
      v.play();
    } catch (e) {}

    // Hide if it actually started
    setTimeout(function () {
      if (!v.paused) hideGate();
    }, 100);
  };
}

function hideGate() {
  if (!startGate) return;
  startGate.style.display = "none";
}

// ==============================
// Boot
// ==============================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVideo);
} else {
  initVideo();
}
