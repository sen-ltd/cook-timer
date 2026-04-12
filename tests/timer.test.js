/**
 * timer.test.js — Tests for timer.js pure logic
 * Run with: node --test tests/timer.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  getRemaining,
  getElapsed,
  getProgress,
  isComplete,
  checkComplete,
  formatTime,
  parseTime,
  PRESETS,
} from '../src/timer.js';

const SEC = 1000;
const MIN = 60 * SEC;

// ─── createTimer ─────────────────────────────────────────────────────────────

describe('createTimer', () => {
  it('returns idle state with correct label and duration', () => {
    const t = createTimer('Pasta', 5 * MIN);
    assert.equal(t.label, 'Pasta');
    assert.equal(t.duration, 5 * MIN);
    assert.equal(t.status, 'idle');
    assert.equal(t.startedAt, null);
    assert.equal(t.pausedAt, null);
    assert.equal(t.pausedElapsed, 0);
    assert.equal(t.completedAt, null);
    assert.ok(typeof t.id === 'string' && t.id.length > 0);
  });

  it('converts duration to number', () => {
    const t = createTimer('Test', '30000');
    assert.equal(t.duration, 30000);
  });

  it('converts label to string', () => {
    const t = createTimer(42, 1000);
    assert.equal(t.label, '42');
  });
});

// ─── startTimer ──────────────────────────────────────────────────────────────

describe('startTimer', () => {
  it('starts an idle timer', () => {
    const t = createTimer('Eggs', 3 * MIN);
    const now = 1000000;
    const started = startTimer(t, now);
    assert.equal(started.status, 'running');
    assert.equal(started.startedAt, now);
    assert.equal(started.pausedAt, null);
  });

  it('is idempotent on running timer', () => {
    const t = createTimer('Eggs', 3 * MIN);
    const now = 1000000;
    const s1 = startTimer(t, now);
    const s2 = startTimer(s1, now + 1000);
    assert.equal(s2, s1);
  });

  it('does not start a completed timer', () => {
    const t = createTimer('Eggs', 3 * MIN);
    const now = 1000000;
    const completed = { ...t, status: 'completed', completedAt: now };
    const result = startTimer(completed, now + 1000);
    assert.equal(result, completed);
  });

  it('resumes from paused and accumulates pausedElapsed', () => {
    const t = createTimer('Sauce', 10 * MIN);
    const t0 = 1000000;
    const running = startTimer(t, t0);

    // Pause after 2 min
    const paused = pauseTimer(running, t0 + 2 * MIN);
    assert.equal(paused.status, 'paused');
    assert.equal(paused.pausedAt, t0 + 2 * MIN);

    // Resume after 3 min gap
    const resumed = startTimer(paused, t0 + 5 * MIN);
    assert.equal(resumed.status, 'running');
    assert.equal(resumed.pausedElapsed, 3 * MIN);
    assert.equal(resumed.pausedAt, null);

    // Elapsed should be ~2 min (the actual cooking time, not wall clock)
    const now = t0 + 5 * MIN + 1 * MIN; // 1 min after resume
    const elapsed = getElapsed(resumed, now);
    assert.equal(elapsed, 3 * MIN); // 2 min before pause + 1 min after
  });
});

// ─── pauseTimer ──────────────────────────────────────────────────────────────

describe('pauseTimer', () => {
  it('pauses a running timer', () => {
    const t = createTimer('Boil', 5 * MIN);
    const t0 = 2000000;
    const running = startTimer(t, t0);
    const paused = pauseTimer(running, t0 + 1 * MIN);
    assert.equal(paused.status, 'paused');
    assert.equal(paused.pausedAt, t0 + 1 * MIN);
  });

  it('does nothing on idle timer', () => {
    const t = createTimer('Boil', 5 * MIN);
    const result = pauseTimer(t, 9999999);
    assert.equal(result, t);
  });

  it('does nothing on already-paused timer', () => {
    const t = createTimer('Boil', 5 * MIN);
    const t0 = 2000000;
    const running = startTimer(t, t0);
    const paused = pauseTimer(running, t0 + 1 * MIN);
    const paused2 = pauseTimer(paused, t0 + 2 * MIN);
    assert.equal(paused2, paused);
  });
});

// ─── resetTimer ──────────────────────────────────────────────────────────────

describe('resetTimer', () => {
  it('resets a running timer to idle', () => {
    const t = createTimer('Rice', 20 * MIN);
    const t0 = 3000000;
    const running = startTimer(t, t0);
    const reset = resetTimer(running);
    assert.equal(reset.status, 'idle');
    assert.equal(reset.startedAt, null);
    assert.equal(reset.pausedAt, null);
    assert.equal(reset.pausedElapsed, 0);
    assert.equal(reset.completedAt, null);
  });

  it('preserves label and duration', () => {
    const t = createTimer('Rice', 20 * MIN);
    const reset = resetTimer(startTimer(t, 1000000));
    assert.equal(reset.label, 'Rice');
    assert.equal(reset.duration, 20 * MIN);
  });

  it('resets a completed timer', () => {
    const t = createTimer('Rice', 20 * MIN);
    const completed = { ...t, status: 'completed', completedAt: 999 };
    const reset = resetTimer(completed);
    assert.equal(reset.status, 'idle');
    assert.equal(reset.completedAt, null);
  });
});

// ─── getRemaining / getElapsed ────────────────────────────────────────────────

describe('getRemaining', () => {
  it('returns full duration for idle timer', () => {
    const t = createTimer('X', 5 * MIN);
    assert.equal(getRemaining(t, Date.now()), 5 * MIN);
  });

  it('returns 0 for completed timer', () => {
    const t = createTimer('X', 5 * MIN);
    const completed = { ...t, status: 'completed', completedAt: 999 };
    assert.equal(getRemaining(completed, Date.now()), 0);
  });

  it('counts down for running timer', () => {
    const t = createTimer('X', 5 * MIN);
    const t0 = 5000000;
    const running = startTimer(t, t0);
    const remaining = getRemaining(running, t0 + 1 * MIN);
    assert.equal(remaining, 4 * MIN);
  });

  it('stays at correct value while paused', () => {
    const t = createTimer('X', 5 * MIN);
    const t0 = 5000000;
    const running = startTimer(t, t0);
    const paused = pauseTimer(running, t0 + 2 * MIN);
    // 3 minutes later, still paused
    const remaining = getRemaining(paused, t0 + 5 * MIN);
    assert.equal(remaining, 3 * MIN);
  });

  it('does not go below 0', () => {
    const t = createTimer('X', 1 * MIN);
    const t0 = 1000000;
    const running = startTimer(t, t0);
    const remaining = getRemaining(running, t0 + 10 * MIN);
    assert.equal(remaining, 0);
  });
});

// ─── isComplete ──────────────────────────────────────────────────────────────

describe('isComplete', () => {
  it('false for idle timer', () => {
    const t = createTimer('X', 5 * MIN);
    assert.equal(isComplete(t, Date.now()), false);
  });

  it('false for paused timer (not yet expired)', () => {
    const t = createTimer('X', 5 * MIN);
    const t0 = 1000000;
    const running = startTimer(t, t0);
    const paused = pauseTimer(running, t0 + 1 * MIN);
    assert.equal(isComplete(paused, t0 + 10 * MIN), false);
  });

  it('true when running timer duration exceeded', () => {
    const t = createTimer('X', 1 * MIN);
    const t0 = 1000000;
    const running = startTimer(t, t0);
    assert.equal(isComplete(running, t0 + 2 * MIN), true);
  });

  it('true for already completed timer', () => {
    const t = createTimer('X', 1 * MIN);
    const completed = { ...t, status: 'completed', completedAt: 999 };
    assert.equal(isComplete(completed, Date.now()), true);
  });
});

// ─── checkComplete ────────────────────────────────────────────────────────────

describe('checkComplete', () => {
  it('returns same ref if not complete', () => {
    const t = createTimer('X', 5 * MIN);
    const t0 = 1000000;
    const running = startTimer(t, t0);
    const result = checkComplete(running, t0 + 1 * MIN);
    assert.equal(result, running);
  });

  it('returns completed state when time is up', () => {
    const t = createTimer('X', 1 * MIN);
    const t0 = 1000000;
    const running = startTimer(t, t0);
    const result = checkComplete(running, t0 + 2 * MIN);
    assert.equal(result.status, 'completed');
    assert.equal(result.completedAt, t0 + 2 * MIN);
  });

  it('does not re-complete an already completed timer', () => {
    const t = createTimer('X', 1 * MIN);
    const completed = { ...t, status: 'completed', completedAt: 999 };
    const result = checkComplete(completed, 99999);
    assert.equal(result, completed);
  });
});

// ─── getProgress ─────────────────────────────────────────────────────────────

describe('getProgress', () => {
  it('0 for idle', () => {
    const t = createTimer('X', 5 * MIN);
    assert.equal(getProgress(t, Date.now()), 0);
  });

  it('0.5 at halfway', () => {
    const t = createTimer('X', 10 * MIN);
    const t0 = 1000000;
    const running = startTimer(t, t0);
    const p = getProgress(running, t0 + 5 * MIN);
    assert.equal(p, 0.5);
  });

  it('1 for completed', () => {
    const t = createTimer('X', 5 * MIN);
    const completed = { ...t, status: 'completed', completedAt: 999 };
    assert.equal(getProgress(completed, Date.now()), 1);
  });

  it('1 when zero duration', () => {
    const t = createTimer('X', 0);
    assert.equal(getProgress(t, Date.now()), 1);
  });
});

// ─── formatTime ──────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats 0ms as 00:00', () => {
    assert.equal(formatTime(0), '00:00');
  });

  it('formats 1 minute', () => {
    assert.equal(formatTime(60 * 1000), '01:00');
  });

  it('formats 90 seconds', () => {
    assert.equal(formatTime(90 * 1000), '01:30');
  });

  it('formats 1 hour', () => {
    assert.equal(formatTime(3600 * 1000), '1:00:00');
  });

  it('formats 1h 30m 45s', () => {
    assert.equal(formatTime((3600 + 30 * 60 + 45) * 1000), '1:30:45');
  });

  it('ceil partial seconds', () => {
    // 1500ms = 1.5s → ceil = 2
    assert.equal(formatTime(1500), '00:02');
  });

  it('handles negative ms as 00:00', () => {
    assert.equal(formatTime(-5000), '00:00');
  });
});

// ─── parseTime ───────────────────────────────────────────────────────────────

describe('parseTime', () => {
  it('"5m" → 5 minutes', () => {
    assert.equal(parseTime('5m'), 5 * MIN);
  });

  it('"5min" → 5 minutes', () => {
    assert.equal(parseTime('5min'), 5 * MIN);
  });

  it('"30s" → 30 seconds', () => {
    assert.equal(parseTime('30s'), 30 * SEC);
  });

  it('"90s" → 90 seconds', () => {
    assert.equal(parseTime('90s'), 90 * SEC);
  });

  it('"5:30" → 5m30s', () => {
    assert.equal(parseTime('5:30'), (5 * 60 + 30) * SEC);
  });

  it('"1:30:00" → 1.5 hours', () => {
    assert.equal(parseTime('1:30:00'), 90 * MIN);
  });

  it('plain number → seconds', () => {
    assert.equal(parseTime('60'), 60 * SEC);
  });

  it('returns NaN for empty string', () => {
    assert.ok(Number.isNaN(parseTime('')));
  });

  it('returns NaN for null', () => {
    assert.ok(Number.isNaN(parseTime(null)));
  });

  it('invalid seconds in MM:SS (62s) → NaN', () => {
    assert.ok(Number.isNaN(parseTime('1:62')));
  });
});

// ─── PRESETS ─────────────────────────────────────────────────────────────────

describe('PRESETS', () => {
  it('has 7 presets', () => {
    assert.equal(PRESETS.length, 7);
  });

  it('all presets have label and positive duration', () => {
    for (const p of PRESETS) {
      assert.ok(typeof p.label === 'string' && p.label.length > 0);
      assert.ok(p.duration > 0);
    }
  });

  it('first preset is 3 min', () => {
    assert.equal(PRESETS[0].duration, 3 * MIN);
  });

  it('last preset is 60 min', () => {
    assert.equal(PRESETS[PRESETS.length - 1].duration, 60 * MIN);
  });
});
