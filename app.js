// ==============================
// Progress / GMod loading hooks
// ==============================
var fill = document.getElementById("fill");
var statusEl = document.getElementById("status");

// ADD: status mapping helpers (minimal)
function norm(s) {
  return (s || "").toLowerCase();
}

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

  if (n.indexOf("starting lua") !== -1) return "RUNTIME INITIALIZING…";
  if (n.indexOf("lua") !== -1) return "RUNTIME INITIALIZING…";

  if (n.indexOf("sending") !== -1) return "UPLINK…";
  if (n.indexOf("receiving") !== -1) return "DOWNLINK…";

  return s || "PROCESSING…";
}

function setProgress(p) {
  if (!fill) return;
  if (p < 0) p = 0;
  if (p > 1) p = 1;

  // Never show 100% until it actually finishes
  var pct = Math.floor(p * 98) + 2; // 2%..100% (but not visually “done” too early)
  fill.style.width = pct + "%";
}

var filesTotal = 0;
var isGmod = false;

window.GameDetails = function () {
  isGmod = true;

  // Hide any audio UI in real GMod context
  var audioBtn = document.getElementById("audioToggle");
  if (audioBtn) audioBtn.style.display = "none";
};

window.SetStatusChanged = function (s) {
  // CHANGE: apply mapping
  var mapped = mapStatus(s);
  if (statusEl) statusEl.textContent = mapped || "LOADING…";
};

window.SetFilesTotal = function (total) {
  filesTotal = total || 0;
};

window.SetFilesNeeded = function (needed) {
  if (!filesTotal) return;
  setProgress((filesTotal - needed) / filesTotal);
};

// Small non-zero start so it doesn't look dead
setProgress(0.02);

// ==============================
// Video selection + playback
// ==============================
var v = document.getElementById("bg");
var startGate = document.getElementById("startGate");

var VIDEOS = [
  "assets/train2.webm",
];

function pickVideo() {
  // Keep choice stable for the tab so refresh doesn’t flicker
  try {
    var key = "gmod_loading_pick";
    var existing = sessionStorage.getItem(key);
    if (existing && arrayIncludes(VIDEOS, existing)) return existing;

    var chosen = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    sessionStorage.setItem(key, chosen);
    return chosen;
  } catch (e) {
    return VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
  }
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
