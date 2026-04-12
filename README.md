# 🍳 Cook Timer / クックタイマー

A multi-timer kitchen app — run multiple concurrent timers, get audio and browser notifications, with full localStorage persistence and preset durations. Zero dependencies, no build step.

**[Live Demo](https://sen.ltd/portfolio/cook-timer/)**

---

## Features

- **Multiple concurrent timers** — run as many as you need simultaneously
- **Per-timer labels** — name each timer ("Pasta", "Sauce", etc.)
- **Time input** — set hours, minutes, seconds
- **Quick presets** — 3, 5, 7, 10, 15, 30, 60 minutes
- **Audio alert** — repeating beep when timer completes
- **Web Notification API** — alerts even when the tab is in background
- **Visual progress ring** — animated SVG ring per timer
- **Pause / Resume / Reset / Delete** per timer
- **Add timer** at any time
- **localStorage persistence** — page refresh doesn't lose state
- **Accurate tracking** — timestamp-based (not interval-counting), immune to tab throttling
- **Dark mode** — kitchen-friendly default
- **Japanese / English UI** toggle
- **Sound on/off toggle**
- **Wake Lock API** — prevents screen sleep while timers run (with graceful fallback)

## Usage

Open `index.html` in any modern browser (ES modules required), or serve locally:

```sh
npm run serve
# → http://localhost:8080
```

## Development

No build step. Edit files directly.

```sh
npm test     # Run unit tests
npm run serve  # Local dev server
```

## Architecture

```
index.html          — shell, modal markup
style.css           — dark/light theme, CSS variables
src/
  timer.js          — pure logic: state, tick, complete detection
  i18n.js           — ja/en translations
  main.js           — DOM, events, rAF loop
tests/
  timer.test.js     — 30+ unit tests for pure logic
```

`timer.js` is pure: no DOM, no side effects, fully testable with `node --test`.

## License

MIT © 2026 [SEN LLC (SEN 合同会社)](https://sen.ltd)
