/**
 * main.js — DOM, events, animation loop
 */

import {
  createTimer, startTimer, pauseTimer, resetTimer,
  getRemaining, getProgress, checkComplete,
  formatTime, PRESETS,
} from './timer.js';
import { t } from './i18n.js';

// ─── State ───────────────────────────────────────────────────────────────────

let timers = [];       // TimerState[]
let lang = 'ja';
let soundEnabled = true;
let darkMode = true;
let wakeLock = null;

const STORAGE_KEY = 'cook-timer:timers';
const SETTINGS_KEY = 'cook-timer:settings';

// ─── Persistence ─────────────────────────────────────────────────────────────

function saveTimers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch (_) { /* ignore quota errors */ }
}

function loadTimers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) { /* ignore */ }
  return [];
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lang, soundEnabled, darkMode }));
  } catch (_) { /* ignore */ }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.lang) lang = s.lang;
      if (typeof s.soundEnabled === 'boolean') soundEnabled = s.soundEnabled;
      if (typeof s.darkMode === 'boolean') darkMode = s.darkMode;
    }
  } catch (_) { /* ignore */ }
}

// ─── Audio ───────────────────────────────────────────────────────────────────

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playBeep(count = 3) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
  } catch (_) { /* ignore */ }
}

// ─── Notifications ───────────────────────────────────────────────────────────

async function requestNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  renderAll();
}

function sendNotification(label) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(t(lang, 'timerDone'), {
    body: label,
    icon: '/portfolio/cook-timer/assets/icon.png',
  });
}

// ─── Wake Lock ────────────────────────────────────────────────────────────────

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    updateWakeLockBtn();
  } catch (_) { /* ignore */ }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
    updateWakeLockBtn();
  }
}

function updateWakeLockBtn() {
  const btn = document.getElementById('btn-wakelock');
  if (!btn) return;
  const hasRunning = timers.some(t => t.status === 'running');
  btn.textContent = wakeLock ? t(lang, 'wakeLockOn') : t(lang, 'wakeLockOff');
  btn.classList.toggle('active', !!wakeLock);
  btn.style.display = ('wakeLock' in navigator) ? '' : 'none';
}

// ─── SVG Ring ────────────────────────────────────────────────────────────────

const RING_R = 52;
const RING_CIRC = 2 * Math.PI * RING_R;

function progressRingSVG(progress, status) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const dash = clampedProgress * RING_CIRC;
  const gap = RING_CIRC - dash;

  const colorMap = {
    idle: 'var(--ring-idle)',
    running: 'var(--ring-running)',
    paused: 'var(--ring-paused)',
    completed: 'var(--ring-done)',
  };
  const color = colorMap[status] || 'var(--ring-idle)';
  const pulseClass = status === 'completed' ? 'ring-pulse' : '';

  return `
    <svg class="progress-ring ${pulseClass}" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="ring-bg" cx="60" cy="60" r="${RING_R}" />
      <circle
        class="ring-fg"
        cx="60" cy="60" r="${RING_R}"
        stroke="${color}"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        stroke-dashoffset="0"
        transform="rotate(-90 60 60)"
      />
    </svg>
  `;
}

// ─── Timer Card ───────────────────────────────────────────────────────────────

function timerCardHTML(timer, now) {
  const remaining = getRemaining(timer, now);
  const progress = getProgress(timer, now);
  const timeStr = formatTime(remaining);
  const { status, label, id } = timer;

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isDone = status === 'completed';

  const primaryBtn = isIdle
    ? `<button class="btn btn-primary" data-action="start" data-id="${id}">${t(lang, 'start')}</button>`
    : isRunning
      ? `<button class="btn btn-warning" data-action="pause" data-id="${id}">${t(lang, 'pause')}</button>`
      : isPaused
        ? `<button class="btn btn-primary" data-action="resume" data-id="${id}">${t(lang, 'resume')}</button>`
        : `<button class="btn btn-secondary" data-action="reset" data-id="${id}">${t(lang, 'reset')}</button>`;

  const resetBtn = (isRunning || isPaused)
    ? `<button class="btn btn-secondary" data-action="reset" data-id="${id}">${t(lang, 'reset')}</button>`
    : '';

  return `
    <article class="timer-card status-${status}" data-id="${id}" aria-label="${label}">
      <button class="btn-delete" data-action="delete" data-id="${id}" aria-label="${t(lang, 'delete')}">✕</button>
      <div class="ring-wrap">
        ${progressRingSVG(progress, status)}
        <div class="ring-time" aria-live="polite">${timeStr}</div>
      </div>
      <div class="timer-label">${label || '—'}</div>
      ${isDone ? `<div class="done-badge">${t(lang, 'completed')}</div>` : ''}
      <div class="timer-controls">
        ${primaryBtn}
        ${resetBtn}
      </div>
    </article>
  `;
}

// ─── Add Timer Modal ──────────────────────────────────────────────────────────

function showAddModal() {
  const modal = document.getElementById('add-modal');
  modal.hidden = false;
  modal.querySelector('#input-label').focus();
  // reset form
  modal.querySelector('#input-label').value = '';
  modal.querySelector('#input-hours').value = '0';
  modal.querySelector('#input-minutes').value = '5';
  modal.querySelector('#input-seconds').value = '0';
}

function hideAddModal() {
  document.getElementById('add-modal').hidden = true;
}

function getModalDuration() {
  const h = parseInt(document.getElementById('input-hours').value, 10) || 0;
  const m = parseInt(document.getElementById('input-minutes').value, 10) || 0;
  const s = parseInt(document.getElementById('input-seconds').value, 10) || 0;
  return (h * 3600 + m * 60 + s) * 1000;
}

function addTimerFromModal() {
  const label = document.getElementById('input-label').value.trim() || t(lang, 'labelPlaceholder');
  const duration = getModalDuration();
  if (duration <= 0) return;
  const timer = createTimer(label, duration);
  timers.push(timer);
  saveTimers();
  hideAddModal();
  renderTimers();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderTimers() {
  const grid = document.getElementById('timer-grid');
  const now = Date.now();

  if (timers.length === 0) {
    grid.innerHTML = `<p class="no-timers">${t(lang, 'noTimers')}</p>`;
    return;
  }

  grid.innerHTML = timers.map(timer => timerCardHTML(timer, now)).join('');
}

function renderAll() {
  // Update top-bar labels
  document.getElementById('btn-sound').textContent = soundEnabled
    ? `🔔 ${t(lang, 'soundOn')}`
    : `🔕 ${t(lang, 'soundOff')}`;

  document.getElementById('btn-lang').textContent = t(lang, 'langToggle');

  const notifBtn = document.getElementById('btn-notif');
  if ('Notification' in window && Notification.permission !== 'granted') {
    notifBtn.hidden = false;
    notifBtn.textContent = t(lang, 'notifPermission');
  } else {
    notifBtn.hidden = true;
  }

  document.getElementById('add-timer-btn').textContent = `+ ${t(lang, 'addTimer')}`;

  // Modal labels
  document.getElementById('modal-title').textContent = t(lang, 'addTimer');
  document.getElementById('lbl-label').textContent = t(lang, 'label');
  document.getElementById('input-label').placeholder = t(lang, 'labelPlaceholder');
  document.getElementById('lbl-time').textContent = t(lang, 'time');
  document.getElementById('lbl-hours').textContent = t(lang, 'hours');
  document.getElementById('lbl-minutes').textContent = t(lang, 'minutes');
  document.getElementById('lbl-seconds').textContent = t(lang, 'seconds');
  document.getElementById('lbl-presets').textContent = t(lang, 'presets');
  document.getElementById('btn-modal-add').textContent = t(lang, 'add');
  document.getElementById('btn-modal-cancel').textContent = t(lang, 'cancel');

  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  document.getElementById('btn-theme').textContent = darkMode
    ? `☀️ ${t(lang, 'lightMode')}`
    : `🌙 ${t(lang, 'darkMode')}`;

  updateWakeLockBtn();
  renderTimers();
}

// ─── Tick Loop ────────────────────────────────────────────────────────────────

const completedSet = new Set(); // ids already notified this session

function tick() {
  const now = Date.now();
  let dirty = false;

  timers = timers.map(timer => {
    const updated = checkComplete(timer, now);
    if (updated !== timer) {
      dirty = true;
      // Notify once
      if (!completedSet.has(timer.id)) {
        completedSet.add(timer.id);
        playBeep(3);
        sendNotification(timer.label);
      }
    }
    return updated;
  });

  if (dirty) saveTimers();

  // Update ring + time in-place for running/paused timers (avoid full re-render)
  timers.forEach(timer => {
    const card = document.querySelector(`.timer-card[data-id="${timer.id}"]`);
    if (!card) return;

    // Update status class
    card.className = `timer-card status-${timer.status}`;

    const ringWrap = card.querySelector('.ring-wrap');
    if (ringWrap) {
      ringWrap.innerHTML = `
        ${progressRingSVG(getProgress(timer, now), timer.status)}
        <div class="ring-time" aria-live="polite">${formatTime(getRemaining(timer, now))}</div>
      `;
    }

    // Update done-badge visibility
    let badge = card.querySelector('.done-badge');
    if (timer.status === 'completed' && !badge) {
      const controls = card.querySelector('.timer-controls');
      const div = document.createElement('div');
      div.className = 'done-badge';
      div.textContent = t(lang, 'completed');
      controls.before(div);
    } else if (timer.status !== 'completed' && badge) {
      badge.remove();
    }

    // Update control buttons
    const controls = card.querySelector('.timer-controls');
    if (controls) {
      const { status, id, label } = timer;
      const isRunning = status === 'running';
      const isPaused = status === 'paused';
      const isIdle = status === 'idle';
      const isDone = status === 'completed';

      const primaryBtn = isIdle
        ? `<button class="btn btn-primary" data-action="start" data-id="${id}">${t(lang, 'start')}</button>`
        : isRunning
          ? `<button class="btn btn-warning" data-action="pause" data-id="${id}">${t(lang, 'pause')}</button>`
          : isPaused
            ? `<button class="btn btn-primary" data-action="resume" data-id="${id}">${t(lang, 'resume')}</button>`
            : `<button class="btn btn-secondary" data-action="reset" data-id="${id}">${t(lang, 'reset')}</button>`;

      const resetBtn = (isRunning || isPaused)
        ? `<button class="btn btn-secondary" data-action="reset" data-id="${id}">${t(lang, 'reset')}</button>`
        : '';

      controls.innerHTML = primaryBtn + resetBtn;
    }
  });

  // Manage wake lock
  const anyRunning = timers.some(t => t.status === 'running');
  if (anyRunning) {
    acquireWakeLock();
  } else {
    releaseWakeLock();
  }

  requestAnimationFrame(tick);
}

// ─── Events ───────────────────────────────────────────────────────────────────

function handleAction(action, id) {
  const now = Date.now();
  timers = timers.map(timer => {
    if (timer.id !== id) return timer;
    switch (action) {
      case 'start':
      case 'resume':
        return startTimer(timer, now);
      case 'pause':
        return pauseTimer(timer, now);
      case 'reset':
        completedSet.delete(timer.id);
        return resetTimer(timer);
      default:
        return timer;
    }
  });

  if (action === 'delete') {
    completedSet.delete(id);
    timers = timers.filter(t => t.id !== id);
    saveTimers();
    renderTimers();
    return;
  }

  saveTimers();
  // tick() will update the DOM on next frame; force re-render to reflect new state immediately
  renderTimers();
}

function setupEvents() {
  // Delegated events on timer grid
  document.getElementById('timer-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    handleAction(action, id);
  });

  // Add timer button
  document.getElementById('add-timer-btn').addEventListener('click', showAddModal);

  // Modal add
  document.getElementById('btn-modal-add').addEventListener('click', addTimerFromModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', hideAddModal);

  // Preset buttons
  document.getElementById('preset-buttons').addEventListener('click', e => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const ms = parseInt(btn.dataset.preset, 10);
    const totalSec = ms / 1000;
    document.getElementById('input-hours').value = Math.floor(totalSec / 3600);
    document.getElementById('input-minutes').value = Math.floor((totalSec % 3600) / 60);
    document.getElementById('input-seconds').value = totalSec % 60;
  });

  // Modal backdrop close
  document.getElementById('add-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideAddModal();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideAddModal();
  });

  // Modal form: Enter → add
  document.getElementById('add-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTimerFromModal();
    }
  });

  // Top bar
  document.getElementById('btn-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    saveSettings();
    renderAll();
  });

  document.getElementById('btn-theme').addEventListener('click', () => {
    darkMode = !darkMode;
    saveSettings();
    renderAll();
  });

  document.getElementById('btn-lang').addEventListener('click', () => {
    lang = lang === 'ja' ? 'en' : 'ja';
    saveSettings();
    renderAll();
  });

  document.getElementById('btn-notif').addEventListener('click', requestNotification);
  document.getElementById('btn-wakelock').addEventListener('click', () => {
    if (wakeLock) {
      releaseWakeLock();
    } else {
      acquireWakeLock();
    }
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function buildPresetButtons() {
  const container = document.getElementById('preset-buttons');
  container.innerHTML = PRESETS.map(p =>
    `<button class="btn btn-preset" data-preset="${p.duration}">${p.label}</button>`
  ).join('');
}

function init() {
  loadSettings();
  timers = loadTimers();

  buildPresetButtons();
  setupEvents();
  renderAll();
  requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', init);
