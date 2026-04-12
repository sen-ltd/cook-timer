/**
 * timer.js — Pure timer logic (no DOM, no side effects)
 * Timestamp-based for accuracy across tab throttling.
 */

export const PRESETS = [
  { label: '3 min', duration: 3 * 60 * 1000 },
  { label: '5 min', duration: 5 * 60 * 1000 },
  { label: '7 min', duration: 7 * 60 * 1000 },
  { label: '10 min', duration: 10 * 60 * 1000 },
  { label: '15 min', duration: 15 * 60 * 1000 },
  { label: '30 min', duration: 30 * 60 * 1000 },
  { label: '60 min', duration: 60 * 60 * 1000 },
];

/**
 * Generate a short unique ID.
 * @returns {string}
 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Create a new timer state.
 * @param {string} label
 * @param {number} duration — total milliseconds
 * @returns {TimerState}
 */
export function createTimer(label, duration) {
  return {
    id: genId(),
    label: String(label),
    duration: Number(duration),
    startedAt: null,
    pausedAt: null,
    pausedElapsed: 0,
    status: 'idle',
    completedAt: null,
  };
}

/**
 * Start or resume a timer.
 * @param {TimerState} timer
 * @param {number} now — current timestamp (ms)
 * @returns {TimerState}
 */
export function startTimer(timer, now) {
  if (timer.status === 'running') return timer;
  if (timer.status === 'completed') return timer;

  // If resuming from pause, accumulate the paused gap
  let pausedElapsed = timer.pausedElapsed;
  if (timer.status === 'paused' && timer.pausedAt !== null) {
    pausedElapsed += now - timer.pausedAt;
  }

  return {
    ...timer,
    startedAt: timer.startedAt === null ? now : timer.startedAt,
    pausedAt: null,
    pausedElapsed,
    status: 'running',
  };
}

/**
 * Pause a running timer.
 * @param {TimerState} timer
 * @param {number} now
 * @returns {TimerState}
 */
export function pauseTimer(timer, now) {
  if (timer.status !== 'running') return timer;
  return {
    ...timer,
    pausedAt: now,
    status: 'paused',
  };
}

/**
 * Reset to idle (keeps label and duration).
 * @param {TimerState} timer
 * @returns {TimerState}
 */
export function resetTimer(timer) {
  return {
    ...timer,
    startedAt: null,
    pausedAt: null,
    pausedElapsed: 0,
    status: 'idle',
    completedAt: null,
  };
}

/**
 * Elapsed time in ms (capped at duration).
 * @param {TimerState} timer
 * @param {number} now
 * @returns {number}
 */
export function getElapsed(timer, now) {
  if (timer.status === 'idle') return 0;
  if (timer.status === 'completed') return timer.duration;
  if (timer.startedAt === null) return 0;

  let rawElapsed = now - timer.startedAt - timer.pausedElapsed;
  if (timer.status === 'paused' && timer.pausedAt !== null) {
    rawElapsed = timer.pausedAt - timer.startedAt - timer.pausedElapsed;
  }

  return Math.min(Math.max(rawElapsed, 0), timer.duration);
}

/**
 * Remaining time in ms (0 if completed).
 * @param {TimerState} timer
 * @param {number} now
 * @returns {number}
 */
export function getRemaining(timer, now) {
  if (timer.status === 'completed') return 0;
  return Math.max(timer.duration - getElapsed(timer, now), 0);
}

/**
 * Progress ratio 0–1.
 * @param {TimerState} timer
 * @param {number} now
 * @returns {number}
 */
export function getProgress(timer, now) {
  if (timer.duration <= 0) return 1;
  return getElapsed(timer, now) / timer.duration;
}

/**
 * @param {TimerState} timer
 * @param {number} now
 * @returns {boolean}
 */
export function isComplete(timer, now) {
  if (timer.status === 'completed') return true;
  if (timer.status !== 'running') return false;
  return getElapsed(timer, now) >= timer.duration;
}

/**
 * If the timer has completed, return a new state with status 'completed'.
 * Otherwise returns the same object reference.
 * @param {TimerState} timer
 * @param {number} now
 * @returns {TimerState}
 */
export function checkComplete(timer, now) {
  if (timer.status !== 'running') return timer;
  if (!isComplete(timer, now)) return timer;
  return {
    ...timer,
    status: 'completed',
    completedAt: now,
  };
}

/**
 * Format milliseconds as "H:MM:SS" or "MM:SS".
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Parse a time string into milliseconds.
 * Supported formats:
 *   "5m", "5min", "30s", "90s"
 *   "MM:SS", "HH:MM:SS"
 *   plain number (treated as seconds)
 * @param {string} str
 * @returns {number} ms, or NaN on failure
 */
export function parseTime(str) {
  if (str === null || str === undefined) return NaN;
  const s = String(str).trim();
  if (s === '') return NaN;

  // Hours:Minutes:Seconds
  const hms = s.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    const sec = parseInt(hms[3], 10);
    if (m >= 60 || sec >= 60) return NaN;
    return (h * 3600 + m * 60 + sec) * 1000;
  }

  // Minutes:Seconds
  const ms = s.match(/^(\d+):(\d{1,2})$/);
  if (ms) {
    const m = parseInt(ms[1], 10);
    const sec = parseInt(ms[2], 10);
    if (sec >= 60) return NaN;
    return (m * 60 + sec) * 1000;
  }

  // "Nm" or "Nmin"
  const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?$/i);
  if (minMatch) {
    return parseFloat(minMatch[1]) * 60 * 1000;
  }

  // "Ns" or "Nsec"
  const secMatch = s.match(/^(\d+(?:\.\d+)?)\s*s(?:ec)?$/i);
  if (secMatch) {
    return parseFloat(secMatch[1]) * 1000;
  }

  // "Nh" or "Nhr"
  const hrMatch = s.match(/^(\d+(?:\.\d+)?)\s*h(?:r)?$/i);
  if (hrMatch) {
    return parseFloat(hrMatch[1]) * 3600 * 1000;
  }

  // Plain number → seconds
  const num = parseFloat(s);
  if (!isNaN(num)) {
    return num * 1000;
  }

  return NaN;
}
