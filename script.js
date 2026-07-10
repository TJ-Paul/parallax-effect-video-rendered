(function () {
  "use strict";

  const video = document.getElementById("scroll-video");
  const canvas = document.getElementById("video-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const scrollRoot = document.getElementById("scroll-root");
  const stage = document.getElementById("scroll-stage");
  const loader = document.getElementById("loader");
  const loaderFill = document.getElementById("loader-fill");
  const loaderText = loader.querySelector(".loader-text");

  const detailsStage = document.getElementById("details-stage");
  const dJoinUs = document.getElementById("d-joinus");
  const dDate = document.getElementById("d-date");
  const dTime = document.getElementById("d-time");
  const dNames = document.getElementById("d-names");
  const dAddress = document.getElementById("d-address");

  // Portion of the single pinned stage's scroll range reserved for the
  // text reveal. The reveal starts while the video is still playing (at
  // REVEAL_START_FRACTION of the way through video playback) so the text
  // begins appearing as the video is winding down, not after it stops.
  const REVEAL_FRACTION = 0.35;
  const REVEAL_START_FRACTION = 0.15;
  let videoFraction = 1 - REVEAL_FRACTION;
  let revealStartProgress = REVEAL_START_FRACTION * videoFraction;

  const VIDEO_SRC = "shakyshaky.mp4";
  const DEFAULT_FPS = 30;

  let duration = 0;
  let fps = DEFAULT_FPS;
  let totalFrames = 0;
  let lastDrawnFrame = -1;
  let lastRequestedFrame = -1;
  let isReady = false;
  let rafId = null;

  // Only one seek is ever "in flight". If more scroll input arrives while
  // it's still resolving, we don't fire another seek on top of it — we just
  // remember the latest target and jump straight to it once the current
  // seek settles. This is what stops fast scrolling from turning into a
  // pile-up of queued seeks (the usual cause of choppy scroll-video).
  let isSeeking = false;
  let pendingFrame = null;

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function setLoaderProgress(ratio) {
    loaderFill.style.width = `${Math.round(ratio * 100)}%`;
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lastDrawnFrame >= 0) paintVideo();
  }

  function paintVideo() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || !video.videoWidth) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const sourceRatio = video.videoWidth / video.videoHeight;
    const destRatio = w / h;
    let drawW, drawH, offsetX, offsetY;

    if (sourceRatio > destRatio) {
      drawH = h;
      drawW = video.videoWidth * (h / video.videoHeight);
      offsetX = (w - drawW) / 2;
      offsetY = 0;
    } else {
      drawW = w;
      drawH = video.videoHeight * (w / video.videoWidth);
      offsetX = 0;
      offsetY = (h - drawH) / 2;
    }

    ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
  }

  function frameToTime(frameIndex) {
    return Math.min(Math.max(frameIndex / fps, 0), Math.max(duration - 1 / fps, 0));
  }

  function progressToFrame(progress) {
    return Math.round(progress * (totalFrames - 1));
  }

  function getScrollProgress() {
    const rect = stage.getBoundingClientRect();
    const scrollable = stage.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    const scrolled = -rect.top;
    return Math.min(Math.max(scrolled / scrollable, 0), 1);
  }

  function clamp01(x) {
    return Math.min(Math.max(x, 0), 1);
  }

  // The pinned stage has one continuous scroll range. The first
  // `videoFraction` of it drives the video frame-by-frame; the remaining
  // tail drives the text reveal, so everything happens on top of the same
  // pinned video layer instead of handing off to a new section.
  function getVideoProgress(overallProgress) {
    return clamp01(overallProgress / videoFraction);
  }

  function getRevealProgress(overallProgress) {
    return clamp01((overallProgress - revealStartProgress) / (1 - revealStartProgress));
  }

  // ── Details reveal (bottom of the video overlay) ──
  // Driven by the tail portion of the same stage-scroll progress, so it
  // fades/slides in on top of the video and reverses smoothly on scroll-up.
  function mapRange(p, a, b) {
    return clamp01((p - a) / (b - a));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function revealUp(el, t, fromX) {
    const e = easeOutCubic(t);
    const translateY = (1 - e) * 40;
    const translateX = fromX ? (1 - e) * fromX : 0;
    el.style.opacity = t;
    el.style.transform = `translate(${translateX}px, ${translateY}px)`;
  }

  function revealFade(el, t) {
    el.style.opacity = t;
  }

  function updateReveal(overallProgress) {
    const p = getRevealProgress(overallProgress);

    revealUp(dJoinUs, mapRange(p, 0, 0.16));
    revealUp(dDate, mapRange(p, 0.14, 0.34), 44); // slides in from the right, settles left
    revealUp(dTime, mapRange(p, 0.32, 0.52), -44); // slides in from the left, settles right
    revealUp(dNames, mapRange(p, 0.5, 0.7));
    revealFade(dAddress, mapRange(p, 0.68, 0.88));
  }

  function updateUI(frameIndex) {
    // Frame/time/progress overlay elements were removed from the markup;
    // this hook is kept in case future UI wants to react to frame changes.
  }

  function requestFrame(frameIndex) {
    if (!isReady || frameIndex === lastRequestedFrame) return;

    if (isSeeking) {
      pendingFrame = frameIndex;
      return;
    }

    seekToFrame(frameIndex);
  }

  function seekToFrame(frameIndex) {
    lastRequestedFrame = frameIndex;
    isSeeking = true;
    const time = frameToTime(frameIndex);

    if (typeof video.fastSeek === "function") {
      video.fastSeek(time);
    } else {
      video.currentTime = time;
    }
  }

  function onSeeked() {
    isSeeking = false;

    const frameIndex = Math.min(
      Math.max(Math.round(video.currentTime * fps), 0),
      totalFrames - 1
    );

    if (frameIndex !== lastDrawnFrame) {
      paintVideo();
      lastDrawnFrame = frameIndex;
      updateUI(frameIndex);
    }

    // A newer target arrived while we were mid-seek — honor only the
    // latest one, dropping anything in between.
    if (pendingFrame !== null) {
      const next = pendingFrame;
      pendingFrame = null;
      seekToFrame(next);
    }
  }

  function onScrollFrame() {
    if (!isReady) return;
    const overallProgress = getScrollProgress();
    requestFrame(progressToFrame(getVideoProgress(overallProgress)));
    updateReveal(overallProgress);
    rafId = null;
  }

  function requestScrollUpdate() {
    if (rafId === null) {
      rafId = requestAnimationFrame(onScrollFrame);
    }
  }

  function estimateFps() {
    if (video.getVideoPlaybackQuality) {
      const q = video.getVideoPlaybackQuality();
      if (q.totalVideoFrames > 0 && duration > 0) {
        const estimated = Math.round(q.totalVideoFrames / duration);
        if (estimated >= 24 && estimated <= 60) return estimated;
      }
    }
    return DEFAULT_FPS;
  }

  // Download the whole file up front and hand the <video> a blob URL
  // instead of the network URL. Once the source is local, every
  // currentTime seek only costs decode time (fast, consistent) instead of
  // a network round trip (slow, jittery on real connections) — this is
  // the main fix for choppy scroll-scrubbing.
  async function fetchVideoAsBlob(src) {
    const response = await fetch(encodeURI(src));
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);

    const contentLength = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength) setLoaderProgress(Math.min(received / contentLength, 0.99));
    }

    return new Blob(chunks, { type: "video/mp4" });
  }

  function waitForMetadata() {
    return new Promise((resolve, reject) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Video failed to load"));
      };
      function cleanup() {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      }
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
    });
  }

  function waitForFirstFrameData() {
    return new Promise((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      video.addEventListener("loadeddata", () => resolve(), { once: true });
    });
  }

  async function initVideo() {
    video.pause();
    video.playbackRate = 0;

    try {
      const blob = await fetchVideoAsBlob(VIDEO_SRC);
      video.src = URL.createObjectURL(blob);
    } catch (err) {
      // If fetching as a blob is blocked for some reason, fall back to
      // letting the browser stream the file directly.
      console.warn("Falling back to direct video src:", err);
      video.src = encodeURI(VIDEO_SRC);
    }
    video.load();

    await waitForMetadata();

    duration = video.duration;
    fps = estimateFps();
    totalFrames = Math.max(Math.ceil(duration * fps), 1);

    const videoVh = Math.max(Math.round(totalFrames * 1.5), 400);
    const totalVh = Math.round(videoVh / videoFraction);
    stage.style.setProperty("--stage-height", `${totalVh}vh`);

    await waitForFirstFrameData();
    resizeCanvas();

    // Frame 0 is already what the video is sitting on (currentTime === 0),
    // so routing it through requestFrame()/seekToFrame() would set
    // currentTime to a value it's already at — no actual seek occurs, so
    // "seeked" never fires, and the frame (and seek state) would get stuck.
    // Paint it directly instead.
    lastRequestedFrame = 0;
    lastDrawnFrame = 0;
    paintVideo();
    updateUI(0);

    isReady = true;
    setLoaderProgress(1);
    setTimeout(() => loader.classList.add("hidden"), 300);

    requestScrollUpdate();
  }

  video.addEventListener("seeked", onSeeked);

  scrollRoot.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", () => {
    resizeCanvas();
    requestScrollUpdate();
  });

  initVideo().catch((err) => {
    console.error(err);
    loaderText.textContent = "Could not load video";
  });
})();