// ===== GMod loading hooks =====
const fill = document.getElementById("fill");
const status = document.getElementById("status");

function setProgress(p) {
  if (!fill) return;
  const pct = Math.max(0, Math.min(1, p)) * 100;
  fill.style.width = pct.toFixed(1) + "%";
}

window.GameDetails = function (servername, serverurl, mapname, maxplayers, steamid, gamemode) {
  // Optional: show server/map info if you want
};

window.SetStatusChanged = function (s) {
  if (status) status.textContent = s || "Loading…";
};

window.SetFilesTotal = function (total) {
  window.__filesTotal = total;
};

window.SetFilesNeeded = function (needed) {
  const total = window.__filesTotal || 0;
  if (total > 0) setProgress((total - needed) / total);
};

setProgress(0.02);

// ===== Video + gates =====
const v = document.getElementById("bg");
const startGate = document.getElementById("startGate");
const audioBtn = document.getElementById("audioToggle");

// Keep this static. Do not generate dynamically.
const VIDEOS = [
  "assets/checkpointloop.mp4",
  "assets/trainrideloop.mp4",
  "assets/checkpointloop2.mp4",
  "assets/citadel.mp4",
];

// Pick once per page load (optionally persist per session)
function pickVideo() {
  try {
    const key = "gmod_loading_pick";
    const existing = sessionStorage.getItem(key);
    if (existing && VIDEOS.includes(existing)) return existing;
    const chosen = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    sessionStorage.setItem(key, chosen);
    return chosen;
  } catch {
    return VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
  }
}

if (v) {
  v.src = pickVideo();
  v.muted = true;
  v.volume = 1.0;
}

// Detect GMod CEF vs real Chrome
function isGModCEF() {
  const ua = navigator.userAgent || "";
  return /GarrysMod|GMod|Valve|Source/i.test(ua);
}

function isRealChromeDesktop() {
  const ua = navigator.userAgent || "";
  const isChromium = /Chrome\/\d+/i.test(ua);
  const isEdge = /Edg\//i.test(ua);
  const isOpera = /OPR\//i.test(ua);
  return isChromium && !isEdge && !isOpera;
}

function showAudioToggle() {
  // Only show in real Chrome, never in GMod
  return isRealChromeDesktop() && !isGModCEF();
}

function setAudioBtnState(enabled) {
  if (!audioBtn) return;
  audioBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
  audioBtn.textContent = enabled ? "Disable audio" : "Enable audio";
}

async function tryPlayMuted() {
  if (!v) return true;

  v.muted = true;
  v.volume = 1.0;

  // Attempt immediately
  try { await v.play(); } catch {}

  // If still paused, wait briefly for readiness and retry
  if (v.paused) {
    await new Promise((resolve) => {
      const done = () => resolve();
      v.addEventListener("loadeddata", done, { once: true });
      v.addEventListener("canplay", done, { once: true });
      setTimeout(done, 800);
    });
    try { await v.play(); } catch {}
  }

  // One more retry on next tick
  if (v.paused) {
    await new Promise((r) => setTimeout(r, 0));
    try { await v.play(); } catch {}
  }

  return !v.paused;
}

async function forceStartGateIfNeeded() {
  if (!v || !startGate) return;

  const started = await tryPlayMuted();
  if (started) {
    startGate.style.display = "none";
    return;
  }

  // Muted autoplay failed. Require one click to start muted playback.
  startGate.style.display = "block";
  startGate.addEventListener("click", async () => {
    v.muted = true;
    v.volume = 1.0;
    try { await v.play(); } catch {}
    if (!v.paused) startGate.style.display = "none";
  });
}

function setupAudioToggle() {
  if (!audioBtn || !v) return;

  if (!showAudioToggle()) {
    audioBtn.style.display = "none";
    return;
  }

  audioBtn.style.display = "block";
  setAudioBtnState(false);

  audioBtn.addEventListener("click", async () => {
    const enabled = audioBtn.getAttribute("aria-pressed") === "true";

    if (enabled) {
      v.muted = true;
      setAudioBtnState(false);
      // Keep playback going
      try { await v.play(); } catch {}
      return;
    }

    // User gesture: attempt to enable audio
    v.muted = false;
    v.volume = 1.0;

    try {
      await v.play();
      setAudioBtnState(true);
    } catch {
      // Still blocked; revert to muted
      v.muted = true;
      setAudioBtnState(false);
      try { await v.play(); } catch {}
    }
  });
}

(async () => {
  // Ensure we try to autoplay muted; if it fails, show click-to-start gate.
  await forceStartGateIfNeeded();

  // Audio toggle: real Chrome only; hidden in GMod.
  setupAudioToggle();
})();
