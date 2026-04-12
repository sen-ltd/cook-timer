/**
 * i18n.js — Translations for ja / en
 */

export const translations = {
  ja: {
    appTitle: 'クックタイマー',
    addTimer: 'タイマーを追加',
    label: 'ラベル',
    labelPlaceholder: 'パスタ、ソースなど',
    time: '時間',
    hours: '時間',
    minutes: '分',
    seconds: '秒',
    presets: 'プリセット',
    start: 'スタート',
    pause: '一時停止',
    resume: '再開',
    reset: 'リセット',
    delete: '削除',
    soundOn: '音 ON',
    soundOff: '音 OFF',
    darkMode: 'ダーク',
    lightMode: 'ライト',
    langToggle: 'EN',
    notifPermission: '通知を許可',
    completed: '完了！',
    timerDone: 'タイマー完了',
    add: '追加',
    cancel: 'キャンセル',
    noTimers: 'タイマーがありません。「タイマーを追加」から始めましょう。',
    wakeLockOn: '画面維持 ON',
    wakeLockOff: '画面維持 OFF',
  },
  en: {
    appTitle: 'Cook Timer',
    addTimer: 'Add Timer',
    label: 'Label',
    labelPlaceholder: 'Pasta, Sauce, etc.',
    time: 'Time',
    hours: 'h',
    minutes: 'm',
    seconds: 's',
    presets: 'Presets',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    delete: 'Delete',
    soundOn: 'Sound ON',
    soundOff: 'Sound OFF',
    darkMode: 'Dark',
    lightMode: 'Light',
    langToggle: 'JA',
    notifPermission: 'Allow Notifications',
    completed: 'Done!',
    timerDone: 'Timer Done',
    add: 'Add',
    cancel: 'Cancel',
    noTimers: 'No timers yet. Click "Add Timer" to get started.',
    wakeLockOn: 'Stay Awake ON',
    wakeLockOff: 'Stay Awake OFF',
  },
};

/**
 * Get a translation string.
 * @param {string} lang — 'ja' | 'en'
 * @param {string} key
 * @returns {string}
 */
export function t(lang, key) {
  return (translations[lang] && translations[lang][key]) ?? key;
}
