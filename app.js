// ==============================
// Progress / GMod loading hooks
// ==============================
var fill = document.getElementById("fill");
var statusEl = document.getElementById("status");

function setProgress(p) {
  if (!fill) return;
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  fill.style.width = Math.round(p * 100) + "%";
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
  if (statusEl) statusEl.textContent = s || "Loading…";
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
  "assets/checkpointloop.webm",
  "assets/trainrideloop.webm",
  "assets/checkpointloop2.webm",
  "assets/citadel.webm"
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