# Shaky Shaky 🎥

Scroll down to play the video forward, scroll up to rewind. A scroll-driven video player built with vanilla JS and canvas.

### 🔗 Live Demo
```
https://tj-paul.github.io/parallax-effect-video-rendered/
```

## How it works

- Scroll position maps directly to a video frame — scroll is the playhead.
- The video is preloaded as a blob so seeking is instant (no network lag).
- Frames are drawn to a `<canvas>` for smooth, cropped rendering.
- Only one seek runs at a time, so fast scrolling stays smooth instead of stacking up seeks.

## Stack

HTML, CSS, vanilla JavaScript — no frameworks or dependencies.

## Develop

```bash
git clone https://github.com/tj-paul/parallax-effect-video-rendered.git
cd parallax-effect-video-rendered
python3 -m http.server 8000
```

Then open `index.html` directly.

Add your own video as `shakyshaky.mp4` in the project root, or update `VIDEO_SRC` in `script.js`. Push your changes and GitHub Pages redeploys automatically.

---

Made by **Turjjo Paul**
