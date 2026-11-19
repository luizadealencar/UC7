const THEME_STORAGE_KEY = "gavetas-theme";
const rootElement = document.documentElement;
const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
let currentTheme = systemPrefersDark ? "dark" : "light";

try {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") currentTheme = savedTheme;
} catch {
  currentTheme = systemPrefersDark ? "dark" : "light";
}

function applyTheme(theme) {
  currentTheme = theme;
  rootElement.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme changes still work for this page when storage is unavailable.
  }

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    const darkMode = theme === "dark";
    const label = darkMode ? "Modo claro" : "Modo escuro";
    const action = darkMode ? "Ativar modo claro" : "Ativar modo escuro";
    button.querySelector(".theme-toggle-label").textContent = label;
    button.querySelector(".theme-toggle-icon").textContent = darkMode ? "☀" : "☾";
    button.setAttribute("aria-label", action);
    button.setAttribute("title", action);
  });
}

applyTheme(currentTheme);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
  });
  applyTheme(currentTheme);
});
