const DEFAULT_SETTINGS = {
  browseMinutes: 60,
  breakMinutes: 5,
  enabledPresets: {
    x: true,
    youtube: true,
    reddit: true,
    bilibili: true,
    zhihu: true,
    douyin: true
  },
  customDomains: []
};

const FALLBACK_PRESETS = {
  x: { label: "X (Twitter)" },
  youtube: { label: "YouTube" },
  reddit: { label: "Reddit" },
  bilibili: { label: "bilibili" },
  zhihu: { label: "知乎" },
  douyin: { label: "抖音" }
};

let presets = FALLBACK_PRESETS;
let settings = structuredClone(DEFAULT_SETTINGS);

const form = document.querySelector("#settings-form");
const browseMinutes = document.querySelector("#browseMinutes");
const breakMinutes = document.querySelector("#breakMinutes");
const presetList = document.querySelector("#preset-list");
const customDomainInput = document.querySelector("#custom-domain");
const addDomainButton = document.querySelector("#add-domain");
const customList = document.querySelector("#custom-list");
const statusText = document.querySelector("#status");

init();

async function init() {
  presets = await loadPresets();
  settings = await loadSettings();
  render();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  collectFormSettings();
  await chrome.storage.local.set({ settings });
  showStatus("已保存");
});

addDomainButton.addEventListener("click", async () => {
  collectFormSettings();
  const domain = normalizeDomain(customDomainInput.value);
  if (!domain) {
    showStatus("请输入有效域名");
    return;
  }

  settings.customDomains = [...new Set([...settings.customDomains, domain])].sort();
  customDomainInput.value = "";
  renderCustomDomains();
  await chrome.storage.local.set({ settings });
  showStatus("已添加");
});

customDomainInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDomainButton.click();
  }
});

async function loadPresets() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "get-presets" });
    return response && response.ok ? response.presets : FALLBACK_PRESETS;
  } catch {
    return FALLBACK_PRESETS;
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  return normalizeSettings(stored.settings || {});
}

function render() {
  browseMinutes.value = settings.browseMinutes;
  breakMinutes.value = settings.breakMinutes;
  renderPresets();
  renderCustomDomains();
}

function renderPresets() {
  presetList.replaceChildren();
  Object.entries(presets).forEach(([key, preset]) => {
    const label = document.createElement("label");
    label.className = "preset";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = key;
    checkbox.checked = Boolean(settings.enabledPresets[key]);
    checkbox.addEventListener("change", () => {
      settings.enabledPresets[key] = checkbox.checked;
    });

    const text = document.createElement("span");
    text.textContent = preset.label;

    label.append(checkbox, text);
    presetList.append(label);
  });
}

function renderCustomDomains() {
  customList.replaceChildren();
  settings.customDomains.forEach((domain) => {
    const row = document.createElement("div");
    row.className = "domain-pill";

    const text = document.createElement("span");
    text.textContent = domain;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-domain";
    remove.textContent = "删除";
    remove.addEventListener("click", async () => {
      collectFormSettings();
      settings.customDomains = settings.customDomains.filter((item) => item !== domain);
      renderCustomDomains();
      await chrome.storage.local.set({ settings });
      showStatus("已删除");
    });

    row.append(text, remove);
    customList.append(row);
  });
}

function collectFormSettings() {
  settings = normalizeSettings({
    ...settings,
    browseMinutes: browseMinutes.value,
    breakMinutes: breakMinutes.value,
    enabledPresets: Object.fromEntries(
      [...presetList.querySelectorAll("input[type='checkbox']")].map((input) => [input.name, input.checked])
    )
  });
}

function normalizeSettings(raw) {
  return {
    browseMinutes: clampNumber(raw.browseMinutes, 0.1, 1440, DEFAULT_SETTINGS.browseMinutes),
    breakMinutes: clampNumber(raw.breakMinutes, 0.1, 1440, DEFAULT_SETTINGS.breakMinutes),
    enabledPresets: {
      ...DEFAULT_SETTINGS.enabledPresets,
      ...(raw.enabledPresets || {})
    },
    customDomains: Array.isArray(raw.customDomains)
      ? [...new Set(raw.customDomains.map(normalizeDomain).filter(Boolean))].sort()
      : []
  };
}

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^\.+|\.+$/g, "");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function showStatus(text) {
  statusText.textContent = text;
  window.clearTimeout(showStatus.timeout);
  showStatus.timeout = window.setTimeout(() => {
    statusText.textContent = "";
  }, 1800);
}
