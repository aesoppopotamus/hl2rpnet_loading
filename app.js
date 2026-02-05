const fill = document.getElementById("fill");
const status = document.getElementById("status");

function setProgress(p) {
  const pct = Math.max(0, Math.min(1, p)) * 100;
  fill.style.width = pct.toFixed(1) + "%";
}

window.GameDetails = function(servername, serverurl, mapname, maxplayers, steamid, gamemode) {
  // Optional: show server/map info if you want
};

window.SetStatusChanged = function(s) {
  if (status) status.textContent = s || "Loading…";
};

window.SetFilesTotal = function(total) {
  window.__filesTotal = total;
};

window.SetFilesNeeded = function(needed) {
  const total = window.__filesTotal || 0;
  if (total > 0) setProgress((total - needed) / total);
};

setProgress(0.02);



const v = document.getElementById("bg");
const startGate = document.getElementById("startGate");
const btn = document.getElementById("audioToggle");

// Keep this static. Do not generate dynamically.
const VIDEOS = [
  "assets/checkpointloop.mp4",
  "assets/trainrideloop.mp4",
  "assets/checkpointloop2.mp4",
];

// Pick once per page load
const pick = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
v.src = pick;

// Always start muted
v.muted = true;
v.volume = 1.0;

// Try hard to start playback (reuses your working pattern)
async function startMuted() {
  try { await v.play(); } catch {}
  if (!v.paused) return;

  await new Promise(r => {
    const done = () => r();
    v.addEventListener("loadeddata", done, { once: true });
    v.addEventListener("canplay", done, { once: true });
    setTimeout(done, 800);
  });

  try { await v.play(); } catch {}
}

startMuted();

function isChromeBrowser() {
  const ua = navigator.userAgent || "";
  const isChromium = /Chrome\/\d+/.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isOpera = /OPR\//.test(ua);
  return isChromium && !isEdge && !isOpera;
}

function setBtnState(enabled) {
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.textContent = enabled ? "Disable audio" : "Enable audio";
}

async function tryPlayMuted() {
  v.muted = true;
  v.volume = 1.0;

  // Try immediately
  try { await v.play(); } catch {}

  // If still paused, wait for readiness events and retry
  if (v.paused) {
    await new Promise(resolve => {
      const done = () => resolve();
      v.addEventListener("loadeddata", done, { once: true });
      v.addEventListener("canplay", done, { once: true });
      setTimeout(done, 800); // safety timeout
    });
    try { await v.play(); } catch {}
  }

  // One more retry on next tick (some CEF builds need it)
  if (v.paused) {
    await new Promise(r => setTimeout(r, 0));
    try { await v.play(); } catch {}
  }

  return !v.paused;
}

async function forceStartGateIfNeeded() {
  const started = await tryPlayMuted();
  if (started) return;

  // Muted autoplay failed. Require one click to start muted playback.
  startGate.style.display = "block";
  startGate.addEventListener("click", async () => {
    v.muted = true;
    try { await v.play(); } catch {}
    if (!v.paused) startGate.style.display = "none";
  }, { once: false });
}

async function setupAudioToggleChromeOnly() {
  if (!isChromeBrowser()) return;

  btn.style.display = "block";
  setBtnState(false);

  btn.addEventListener("click", async () => {
    const enabled = btn.getAttribute("aria-pressed") === "true";
    if (enabled) {
      v.muted = true;
      setBtnState(false);
      return;
    }

    // This is a user gesture, so Chrome will allow audio if it’s going to allow it at all.
    v.muted = false;
    v.volume = 1.0;
    try { await v.play(); setBtnState(true); }
    catch { v.muted = true; setBtnState(false); }
  });
}

(async () => {
  // Always attempt to start muted on load.
  await forceStartGateIfNeeded();

  // Audio toggle is optional and Chrome-only.
  await setupAudioToggleChromeOnly();
})();