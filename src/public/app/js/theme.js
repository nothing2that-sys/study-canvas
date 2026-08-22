/**
 * Math Canvas Pro - 3색 테마 시스템 (Warm Paper / Chalkboard / Midnight)
 * 테마 순환 전환 및 로컬 스토리지 영구 저장 지원
 */

export const THEMES = Object.freeze({
  PAPER: "paper",           // 따뜻한 종이 (기본)
  CHALKBOARD: "chalkboard", // 교실 칠판 흑판
  MIDNIGHT: "midnight"      // 세련된 미드나잇 다크
});

const THEME_LABELS = {
  [THEMES.PAPER]: "종이 테마",
  [THEMES.CHALKBOARD]: "칠판 모드",
  [THEMES.MIDNIGHT]: "미드나잇"
};

const THEME_ICONS = {
  [THEMES.PAPER]: "📜",
  [THEMES.CHALKBOARD]: "🏫",
  [THEMES.MIDNIGHT]: "🌙"
};

const STORAGE_KEY = "math_canvas_theme";

let currentTheme = THEMES.PAPER;

if (typeof localStorage !== "undefined") {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && Object.values(THEMES).includes(saved)) {
    currentTheme = saved;
  }
}

export function getCurrentTheme() {
  return currentTheme;
}

export function getThemeInfo(theme = currentTheme) {
  return {
    id: theme,
    label: THEME_LABELS[theme] || THEME_LABELS[THEMES.PAPER],
    icon: THEME_ICONS[theme] || THEME_ICONS[THEMES.PAPER]
  };
}

export function applyTheme(theme) {
  if (!Object.values(THEMES).includes(theme)) {
    theme = THEMES.PAPER;
  }
  currentTheme = theme;

  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, theme);
  }

  return getThemeInfo(theme);
}

export function cycleTheme() {
  const order = [THEMES.PAPER, THEMES.CHALKBOARD, THEMES.MIDNIGHT];
  const nextIdx = (order.indexOf(currentTheme) + 1) % order.length;
  return applyTheme(order[nextIdx]);
}
