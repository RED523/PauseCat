(function () {
  const OVERLAY_ID = "cat-gatekeeper-overlay";
  const HEARTBEAT_INTERVAL_MS = 5_000;

  let overlay = null;
  let countdownTimer = 0;
  let heartbeatTimer = 0;
  let stopCompositor = null;
  let resizeHandler = null;
  let motionTimer = 0;

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "show-break") {
      showBreak(message.breakEndAt);
    }
    if (message.type === "hide-break") {
      hideBreak();
    }
  });

  document.addEventListener("visibilitychange", sendHeartbeatSoon, true);
  window.addEventListener("focus", sendHeartbeatSoon, true);
  window.addEventListener("pageshow", sendHeartbeatSoon, true);

  heartbeatTimer = window.setInterval(sendHeartbeatSoon, HEARTBEAT_INTERVAL_MS);
  sendHeartbeatSoon();

  function sendHeartbeatSoon() {
    if (!chrome.runtime || !chrome.runtime.id) return;
    chrome.runtime.sendMessage({ type: "heartbeat" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) return;
      if (response.active) {
        showBreak(response.breakEndAt);
      } else {
        hideBreak();
      }
    });
  }

  function showBreak(breakEndAt) {
    if (!breakEndAt || breakEndAt <= Date.now()) {
      hideBreak();
      return;
    }

    if (!overlay) {
      overlay = buildOverlay();
      document.documentElement.appendChild(overlay);
      resizeHandler = () => updateCatLayout(overlay.__catGatekeeperShadow);
      window.addEventListener("resize", resizeHandler, { passive: true });
      updateCatLayout(overlay.__catGatekeeperShadow);
      startCatMotion(overlay.__catGatekeeperShadow);
      installBlockers();
      startVideo();
    }

    overlay.dataset.breakEndAt = String(breakEndAt);
    updateCountdown();
    window.clearInterval(countdownTimer);
    countdownTimer = window.setInterval(updateCountdown, 1_000);
  }

  function hideBreak() {
    window.clearInterval(countdownTimer);
    countdownTimer = 0;
    if (stopCompositor) {
      stopCompositor();
      stopCompositor = null;
    }
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    if (motionTimer) {
      window.clearInterval(motionTimer);
      motionTimer = 0;
    }
    removeBlockers();
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  function buildOverlay() {
    const root = document.createElement("div");
    root.id = OVERLAY_ID;

    const shadow = root.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: block;
          color-scheme: dark;
          pointer-events: auto;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .gate {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: transparent;
          cursor: wait;
        }

        .countdown {
          position: fixed;
          top: 18px;
          right: 20px;
          padding: 7px 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          background: rgba(10, 10, 10, 0.5);
          color: rgba(255, 255, 255, 0.72);
          font-size: 13px;
          line-height: 1;
          letter-spacing: 0;
          user-select: none;
          z-index: 4;
        }

        .cat-wrap {
          position: fixed;
          right: clamp(-120px, -6.5vw, -48px);
          bottom: clamp(-52px, -4.6vh, -20px);
          width: 1200px;
          height: 980px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          pointer-events: none;
          transform-origin: 100% 100%;
          transform-style: preserve-3d;
          --breathe-ms: 3800ms;
          animation:
            squeeze-in 1100ms cubic-bezier(.16,.9,.2,1) both,
            settle-breathe var(--breathe-ms) ease-in-out 1100ms infinite;
          z-index: 1;
        }

        .cat-wrap::after {
          content: "";
          position: absolute;
          left: 16%;
          right: 10%;
          bottom: 2.6%;
          height: 9%;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(ellipse, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0) 72%);
          filter: blur(8px);
          opacity: 0.85;
        }

        .cat-source {
          display: none;
        }

        .cat-composite {
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0;
          transform:
            perspective(900px)
            rotateY(-7deg)
            rotateZ(-0.8deg)
            skewY(-0.6deg);
          transform-origin: 100% 100%;
          filter:
            saturate(0.86)
            contrast(0.94)
            brightness(0.88)
            sepia(0.035);
          transition: opacity 280ms ease;
          will-change: transform, opacity;
        }

        .cat-composite.ready {
          opacity: 1;
        }

        .fallback-cat {
          width: min(80vw, 680px);
          aspect-ratio: 1.4;
          display: none;
          position: relative;
          animation: breathe 2s ease-in-out infinite;
        }

        .fallback-cat::before,
        .fallback-cat::after {
          content: "";
          position: absolute;
          background: #d8c0a2;
        }

        .fallback-cat::before {
          left: 18%;
          right: 18%;
          bottom: 0;
          height: 62%;
          border-radius: 44% 44% 30% 30%;
        }

        .fallback-cat::after {
          left: 33%;
          right: 33%;
          top: 8%;
          height: 42%;
          border-radius: 48% 48% 42% 42%;
          box-shadow:
            -56px -24px 0 -28px #d8c0a2,
            56px -24px 0 -28px #d8c0a2,
            0 55px 0 85px rgba(216, 192, 162, 0.12);
        }

        .video-failed .cat-composite,
        .video-failed .cat-source {
          display: none;
        }

        .video-failed .fallback-cat {
          display: block;
        }

        @keyframes squeeze-in {
          from {
            transform:
              translateX(42%)
              translateY(7%)
              scale(1.03)
              perspective(900px)
              rotateY(-9deg);
            opacity: 0;
          }
          to {
            transform:
              translateX(0)
              translateY(0)
              scale(1)
              perspective(900px)
              rotateY(-3deg);
            opacity: 1;
          }
        }

        @keyframes settle-breathe {
          0%, 100% {
            transform:
              translateX(0)
              translateY(0)
              scale(1)
              perspective(900px)
              rotateY(-3deg);
          }
          50% {
            transform:
              translateX(-0.56%)
              translateY(0.64%)
              scale(1.0048)
              perspective(900px)
              rotateY(-2deg);
          }
        }

        @keyframes breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(8px) scale(1.015); }
        }
      </style>
      <div class="gate" role="dialog" aria-modal="true" aria-label="Cat Gatekeeper break">
        <div class="countdown">05:00</div>
        <div class="cat-wrap">
          <video class="cat-source" autoplay loop muted playsinline data-src="${chrome.runtime.getURL("assets/cat_8.mp4")}">
            <source src="${chrome.runtime.getURL("assets/cat_8.mp4")}" type="video/mp4">
          </video>
          <canvas class="cat-composite" aria-hidden="true"></canvas>
          <div class="fallback-cat" aria-hidden="true"></div>
        </div>
      </div>
    `;

    const video = shadow.querySelector("video");
    const catWrap = shadow.querySelector(".cat-wrap");
    video.addEventListener("error", () => catWrap.classList.add("video-failed"), true);
    video.addEventListener("loadeddata", () => catWrap.classList.remove("video-failed"), { once: true });

    root.__catGatekeeperShadow = shadow;
    return root;
  }

  function updateCatLayout(shadowRoot) {
    if (!shadowRoot) return;
    const catWrap = shadowRoot.querySelector(".cat-wrap");
    if (!catWrap) return;

    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const scale = vw < 768 ? 1.35 : vw < 1280 ? 1.7 : vw < 1720 ? 1.85 : 2.0;

    const width = Math.min(vw * 0.84 * scale, 1080 * scale);
    const height = Math.min(vh * 0.94 * scale, 880 * scale);
    catWrap.style.width = `${Math.round(width)}px`;
    catWrap.style.height = `${Math.round(height)}px`;
  }

  function startCatMotion(shadowRoot) {
    if (!shadowRoot) return;
    const catWrap = shadowRoot.querySelector(".cat-wrap");
    if (!catWrap) return;

    const setDuration = () => {
      const ms = Math.round(3200 + Math.random() * 1400);
      catWrap.style.setProperty("--breathe-ms", `${ms}ms`);
    };

    setDuration();
    motionTimer = window.setInterval(setDuration, 3300);
  }

  function updateCountdown() {
    if (!overlay) return;
    const breakEndAt = Number(overlay.dataset.breakEndAt || 0);
    const remainingMs = Math.max(0, breakEndAt - Date.now());
    if (remainingMs <= 0) {
      hideBreak();
      return;
    }

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const text = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const countdown = overlay.__catGatekeeperShadow.querySelector(".countdown");
    countdown.textContent = text;
  }

  function startVideo() {
    if (!overlay) return;
    const shadow = overlay.__catGatekeeperShadow;
    const video = shadow.querySelector("video");
    const catWrap = shadow.querySelector(".cat-wrap");
    video.load();
    window.setTimeout(() => {
      video.play().catch(() => {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          catWrap.classList.add("video-failed");
        }
      });
    }, 0);
    stopCompositor = startCatCompositor(shadow);
  }

  function startCatCompositor(shadow) {
    const video = shadow.querySelector(".cat-source");
    const canvas = shadow.querySelector(".cat-composite");
    const catWrap = shadow.querySelector(".cat-wrap");
    const output = canvas.getContext("2d", { willReadFrequently: true });
    const sourceCanvas = document.createElement("canvas");
    const source = sourceCanvas.getContext("2d", { willReadFrequently: true });
    let frameId = 0;
    let stopped = false;
    let lastVideoTime = -1;
    let alphaBuffer = null;
    let smoothBuffer = null;

    function configureCanvas() {
      if (!video.videoWidth || !video.videoHeight) return false;
      const maxWidth = 720;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const width = Math.max(2, Math.round(video.videoWidth * scale));
      const height = Math.max(2, Math.round(video.videoHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        alphaBuffer = new Uint8ClampedArray(width * height);
        smoothBuffer = new Uint8ClampedArray(width * height);
      }
      return true;
    }

    function render() {
      if (stopped) return;
      frameId = window.requestAnimationFrame(render);
      if (!configureCanvas() || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const width = sourceCanvas.width;
      const height = sourceCanvas.height;
      source.clearRect(0, 0, width, height);
      source.drawImage(video, 0, 0, width, height);
      let frame;
      try {
        frame = source.getImageData(0, 0, width, height);
      } catch {
        reloadVideoAsBlob(video);
        return;
      }
      const data = frame.data;

      const hasNativeAlpha = buildNativeAlpha(data, alphaBuffer);
      const bg = hasNativeAlpha ? null : estimateBackground(data, width, height);
      if (!hasNativeAlpha) {
        buildAlpha(data, width, height, bg, alphaBuffer);
      }
      featherAlpha(width, height, alphaBuffer, smoothBuffer);
      applyComposite(data, alphaBuffer, bg);

      output.clearRect(0, 0, width, height);
      output.putImageData(frame, 0, 0);
      canvas.classList.add("ready");
      catWrap.classList.remove("video-failed");
    }

    frameId = window.requestAnimationFrame(render);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
      revokeBlobUrl(video);
      output.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.remove("ready");
    };
  }

  async function reloadVideoAsBlob(video) {
    if (video.dataset.blobLoading || video.dataset.blobReady) return;
    video.dataset.blobLoading = "true";
    try {
      const response = await fetch(video.dataset.src);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      video.dataset.blobReady = "true";
      video.dataset.blobUrl = blobUrl;
      video.src = blobUrl;
      video.load();
      await video.play();
    } catch {
      const catWrap = video.getRootNode().querySelector(".cat-wrap");
      if (catWrap) catWrap.classList.add("video-failed");
    } finally {
      delete video.dataset.blobLoading;
    }
  }

  function revokeBlobUrl(video) {
    if (!video || !video.dataset.blobUrl) return;
    URL.revokeObjectURL(video.dataset.blobUrl);
    delete video.dataset.blobUrl;
    delete video.dataset.blobReady;
  }

  function estimateBackground(data, width, height) {
    const samples = [];
    const step = Math.max(6, Math.floor(Math.min(width, height) / 40));
    const edge = Math.max(4, Math.floor(Math.min(width, height) * 0.08));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (x > edge && x < width - edge && y > edge && y < height - edge) continue;
        const index = (y * width + x) * 4;
        samples.push([data[index], data[index + 1], data[index + 2]]);
      }
    }

    const avg = samples.reduce(
      (sum, color) => {
        sum.r += color[0];
        sum.g += color[1];
        sum.b += color[2];
        return sum;
      },
      { r: 0, g: 0, b: 0 }
    );

    const count = Math.max(1, samples.length);
    return {
      r: avg.r / count,
      g: avg.g / count,
      b: avg.b / count
    };
  }

  function buildNativeAlpha(data, alpha) {
    let transparentPixels = 0;
    let translucentPixels = 0;
    for (let i = 3, pixel = 0; i < data.length; i += 4, pixel += 1) {
      const value = data[i];
      alpha[pixel] = value < 18 ? 0 : value;
      if (value < 250) translucentPixels += 1;
      if (value < 18) transparentPixels += 1;
    }

    return transparentPixels > 0 || translucentPixels > alpha.length * 0.015;
  }

  function buildAlpha(data, width, height, bg, alpha) {
    const keyIsGreen = bg.g > bg.r * 1.12 && bg.g > bg.b * 1.12;
    const low = keyIsGreen ? 34 : 28;
    const high = keyIsGreen ? 96 : 74;

    for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const bgDistance = colorDistance(r, g, b, bg.r, bg.g, bg.b);
      const greenSpill = g - Math.max(r, b);
      const bgAlpha = smoothstep(low, high, bgDistance);
      const greenAlpha = greenSpill > 18 && g > 70 ? 1 - smoothstep(18, 78, greenSpill) : 1;
      const brightness = (r + g + b) / 3;
      const lowDetailAlpha = Math.abs(brightness - ((bg.r + bg.g + bg.b) / 3)) < 8 ? 0.72 : 1;
      alpha[pixel] = Math.round(255 * Math.max(0, Math.min(1, bgAlpha * greenAlpha * lowDetailAlpha)));
    }
  }

  function featherAlpha(width, height, alpha, smooth) {
    smooth.set(alpha);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const value = alpha[index];
        if (value < 8 || value > 248) continue;
        let total = 0;
        for (let yy = -1; yy <= 1; yy += 1) {
          for (let xx = -1; xx <= 1; xx += 1) {
            total += alpha[index + yy * width + xx];
          }
        }
        smooth[index] = Math.round(total / 9);
      }
    }
    alpha.set(smooth);
  }

  function applyComposite(data, alpha, bg) {
    for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
      const rawAlpha = alpha[pixel];
      const a = rawAlpha >= 170 ? 255 : rawAlpha >= 90 ? Math.min(255, rawAlpha + 70) : rawAlpha;
      if (a <= 2) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }

      if (bg) {
        const edge = 1 - a / 255;
        data[i] = clampChannel(data[i] + (data[i] - bg.r) * 0.18 * edge);
        data[i + 1] = clampChannel(data[i + 1] + (data[i + 1] - bg.g) * 0.14 * edge);
        data[i + 2] = clampChannel(data[i + 2] + (data[i + 2] - bg.b) * 0.16 * edge);
      }

      const edge = 1 - a / 255;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dominant = Math.max(r, b);
      if (g > dominant * 1.04) {
        const spill = (g - dominant) * (0.38 + 0.42 * edge);
        data[i + 1] = clampChannel(g - spill);
        data[i] = clampChannel(r + spill * 0.18);
        data[i + 2] = clampChannel(b + spill * 0.14);
      }

      data[i + 3] = a;
    }
  }

  function colorDistance(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr * 0.78 + dg * dg * 1.14 + db * db * 0.9);
  }

  function smoothstep(edge0, edge1, value) {
    const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return x * x * (3 - 2 * x);
  }

  function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function installBlockers() {
    window.addEventListener("keydown", blockEvent, true);
    window.addEventListener("keypress", blockEvent, true);
    window.addEventListener("keyup", blockEvent, true);
    window.addEventListener("wheel", blockEvent, { capture: true, passive: false });
    window.addEventListener("touchmove", blockEvent, { capture: true, passive: false });
  }

  function removeBlockers() {
    window.removeEventListener("keydown", blockEvent, true);
    window.removeEventListener("keypress", blockEvent, true);
    window.removeEventListener("keyup", blockEvent, true);
    window.removeEventListener("wheel", blockEvent, true);
    window.removeEventListener("touchmove", blockEvent, true);
  }

  function blockEvent(event) {
    if (!overlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
})();
