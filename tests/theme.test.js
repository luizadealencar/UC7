import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const themeScript = await readFile(new URL("../js/theme.js", import.meta.url), "utf8");

function createBrowser(storage, systemPrefersDark = false) {
  const attributes = {};
  const listeners = {};
  const label = { textContent: "" };
  const icon = { textContent: "" };
  const button = {
    addEventListener: (eventName, listener) => {
      listeners[eventName] = listener;
    },
    querySelector: (selector) => selector === ".theme-toggle-label" ? label : icon,
    setAttribute: (name, value) => {
      attributes[name] = value;
    }
  };
  const document = {
    documentElement: { dataset: {} },
    addEventListener: (_eventName, listener) => {
      listeners.domReady = listener;
    },
    querySelectorAll: () => [button]
  };
  const window = {
    matchMedia: () => ({ matches: systemPrefersDark })
  };

  runInNewContext(themeScript, { document, localStorage: storage, window });
  listeners.domReady();

  return { attributes, button, document, icon, label, listeners };
}

test("theme toggle saves the preference and restores it on another page", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };

  const firstPage = createBrowser(storage);
  assert.equal(firstPage.document.documentElement.dataset.theme, "light");
  assert.equal(firstPage.label.textContent, "Modo escuro");

  firstPage.listeners.click();
  assert.equal(firstPage.document.documentElement.dataset.theme, "dark");
  assert.equal(firstPage.label.textContent, "Modo claro");
  assert.equal(firstPage.attributes["aria-label"], "Ativar modo claro");
  assert.equal(values.get("gavetas-theme"), "dark");

  const nextPage = createBrowser(storage);
  assert.equal(nextPage.document.documentElement.dataset.theme, "dark");
  assert.equal(nextPage.label.textContent, "Modo claro");
});
