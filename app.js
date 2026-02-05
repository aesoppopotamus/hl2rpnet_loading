// ==============================
// Progress / GMod loading hooks
// ==============================
const fill = document.getElementById("fill");
const status = document.getElementById("status");

function setProgress(p) {
  if (!fill) return;
  const pct = Math.max(0, Math.min(1, p)) * 100;
  fill.style.width = pct.toFixed(1) + "%";
}

window.__filesTotal = 0;
window.__isGmod = false;

window.GameDetails = function (servername, serverurl, mapname, maxplayers, steamid, gamemode) {
  // This function being called is a strong signal we are inside GMod's loading screen context.
  window.__isGmod = true;

  // If you have an audio toggle button, never show it in GMod.
  const audioBtn = document.getElementById("audioToggle");
  if (audioBtn) audioBtn.style.display = "none";
};

window.SetStatusChanged = function (s) {
  if (status) status.textContent = s || "Loading…";
};

window.SetFilesTotal = function (total) {
  window.__filesTotal = total || 0;
};

window.SetFilesNeeded = function (needed) {
  const total = window.__filesTotal || 0;
  if (total > 0) setProgress((total - needed) / total);
};

setProgress(0.02);

// ==============================
// Video selection + playback
// ==============================
const v = document.getElementById("bg");
const startGate = document.getElementById("startGate");
const audioBtn = document.getElementById("audioToggle");

// Keep this static.
const VIDEOS = [
  "assets/checkpointloop.webm",
  "assets/trainrideloop.webm",
  "assets/checkpointloop2.webm",
  "assets/citadel.webm",
];

function pickVideo() {
  // Persist per-tab so refreshes don't flicker choices
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

function isRealChromeDesktop() {
  const ua = navigator.userAgent || "";
  const isChromium = /Chrome\/\d+/i.test(ua);
  const isEdge = /Edg\//i.test(ua);
  const isOpera = /OPR\//i.test(ua);
  return isChromium && !isEdge && !isOpera;
}

function setAudioBtnState(enabled) {
  if (!audioBtn) return;
  audioBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
  audioBtn.textContent = enabled ? "Disable audio" : "Enable audio";
}

async function tryPlayMuted() {
  if (!v) return true;

  // Force autoplay-friendly state
  v.muted = true;
  v.volume = 1.0;
  v.loop = true;
  v.playsInline = true;

  // Some CEF builds behave better if these are also reflected as attributes
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.setAttribute("autoplay", "");

  // Try now
  try { await v.play(); } catch {}

  // If paused, wait for readiness and retry
  if (v.paused) {
    await new Promise((resolve) => {
      const done = () => resolve();
      v.addEventListener("loadeddata", done, { once: true });
      v.addEventListener("canplay", done, { once: true });
      setTimeout(done, 1000);
    });
    try { await v.play(); } catch {}
  }

  // One more microtask retry
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

  // Muted autoplay failed: require a click to start muted playback.
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

  // Default hidden. Only show in real Chrome AND not in GMod.
  audioBtn.style.display = "none";

  // GMod will flip __isGmod true after GameDetails is called; also keep it hidden if that happens later.
  const shouldShow = isRealChromeDesktop() && !window.__isGmod;
  if (!shouldShow) return;

  audioBtn.style.display = "block";
  setAudioBtnState(false);

  audioBtn.addEventListener("click", async () => {
    const enabled = audioBtn.getAttribute("aria-pressed") === "true";

    if (enabled) {
      v.muted = true;
      setAudioBtnState(false);
      try { await v.play(); } catch {}
      return;
    }

    v.muted = false;
    v.volume = 1.0;
    try {
      await v.play();
      setAudioBtnState(true);
    } catch {
      v.muted = true;
      setAudioBtnState(false);
      try { await v.play(); } catch {}
    }
  });
}

function initVideo() {
  if (!v) return;

  // Assign randomized video, then force a load cycle.
  v.src = pickVideo();
  try { v.load(); } catch {}

  // Always attempt muted playback and show start gate only if needed.
  forceStartGateIfNeeded();

  // Audio toggle is dev/testing only; will be suppressed in GMod once GameDetails fires.
  setupAudioToggle();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVideo);
} else {
  initVideo();
}
