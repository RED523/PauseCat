const PRESETS = {
  x: {
    label: "X (Twitter)",
    domains: ["x.com", "twitter.com"]
  },
  youtube: {
    label: "YouTube",
    domains: ["youtube.com", "youtu.be"]
  },
  reddit: {
    label: "Reddit",
    domains: ["reddit.com"]
  },
  bilibili: {
    label: "bilibili",
    domains: ["bilibili.com", "b23.tv"]
  },
  zhihu: {
    label: "知乎",
    domains: ["zhihu.com", "zhimg.com"]
  },
  douyin: {
    label: "抖音",
    domains: ["douyin.com", "iesdouyin.com"]
  }
};

const DEFAULT_SETTINGS = {
  browseMinutes: 60,
  breakMinutes: 5,
  enabledPresets: Object.fromEntries(Object.keys(PRESETS).map((key) => [key, true])),
  customDomains: []
};

const DEFAULT_STATE = {
  accumulatedSeconds: 0,
  activeTabId: null,
  activeDomain: null,
  lastAccountedAt: 0,
  breakEndAt: 0
};

const ALARM_NAME = "cat-gatekeeper-tick";
const HEARTBEAT_CAP_MS = 30_000;
const IDLE_THRESHOLD_SECONDS = 20;

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  await ensureAlarm();
  await accountActiveTime("installed");
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeStorage();
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  await ensureAlarm();
  await accountActiveTime("startup");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    accountActiveTime("alarm");
  }
});

chrome.tabs.onActivated.addListener(() => accountActiveTime("tab-activated"));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    accountActiveTime(`tab-updated-${tabId}`);
  }
});
chrome.windows.onFocusChanged.addListener(() => accountActiveTime("window-focus"));
chrome.idle.onStateChanged.addListener(() => accountActiveTime("idle-change"));
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings) {
    accountActiveTime("settings-change");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("[Cat Gatekeeper]", error);
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    });
  return true;
});

async function handleMessage(message, sender) {
  if (!message || typeof message.type !== "string") {
    return { ok: false, error: "Unknown message" };
  }

  if (message.type === "heartbeat") {
    await accountActiveTime("heartbeat");
    return getTabBreakStatus(sender.tab);
  }

  if (message.type === "get-break-status") {
    await accountActiveTime("status-request");
    return getTabBreakStatus(sender.tab);
  }

  if (message.type === "get-presets") {
    return { ok: true, presets: PRESETS };
  }

  return { ok: false, error: `Unsupported message type: ${message.type}` };
}

async function initializeStorage() {
  const stored = await chrome.storage.local.get(["settings", "state"]);
  const settings = normalizeSettings(stored.settings || {});
  const state = { ...DEFAULT_STATE, ...(stored.state || {}) };
  await chrome.storage.local.set({ settings, state });
}

async function ensureAlarm() {
  try {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
  } catch {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }
}

async function getSettingsAndState() {
  const stored = await chrome.storage.local.get(["settings", "state"]);
  return {
    settings: normalizeSettings(stored.settings || {}),
    state: { ...DEFAULT_STATE, ...(stored.state || {}) }
  };
}

function normalizeSettings(raw) {
  const enabledPresets = { ...DEFAULT_SETTINGS.enabledPresets, ...(raw.enabledPresets || {}) };
  const customDomains = Array.isArray(raw.customDomains)
    ? [...new Set(raw.customDomains.map(normalizeDomain).filter(Boolean))].sort()
    : [];

  return {
    browseMinutes: clampNumber(raw.browseMinutes, 0.1, 24 * 60, DEFAULT_SETTINGS.browseMinutes),
    breakMinutes: clampNumber(raw.breakMinutes, 0.1, 24 * 60, DEFAULT_SETTINGS.breakMinutes),
    enabledPresets,
    customDomains
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function accountActiveTime(reason) {
  const now = Date.now();
  const { settings, state } = await getSettingsAndState();

  if (state.breakEndAt && state.breakEndAt <= now) {
    await chrome.storage.local.set({
      state: { ...DEFAULT_STATE }
    });
    await broadcastBreak({ active: false });
    return;
  }

  if (state.breakEndAt && state.breakEndAt > now) {
    await chrome.storage.local.set({
      state: {
        ...state,
        lastAccountedAt: 0,
        activeTabId: null,
        activeDomain: null
      }
    });
    await broadcastBreak({ active: true, breakEndAt: state.breakEndAt });
    return;
  }

  const activeInfo = await getActiveTargetInfo(settings);
  if (!activeInfo) {
    await chrome.storage.local.set({
      state: {
        ...state,
        activeTabId: null,
        activeDomain: null,
        lastAccountedAt: 0
      }
    });
    return;
  }

  let accumulatedSeconds = Number(state.accumulatedSeconds) || 0;
  const continuing =
    state.lastAccountedAt &&
    state.activeTabId === activeInfo.tab.id &&
    state.activeDomain === activeInfo.domain;

  if (continuing) {
    const deltaMs = Math.max(0, Math.min(now - state.lastAccountedAt, HEARTBEAT_CAP_MS));
    accumulatedSeconds += deltaMs / 1000;
  }

  const nextState = {
    ...state,
    accumulatedSeconds,
    activeTabId: activeInfo.tab.id,
    activeDomain: activeInfo.domain,
    lastAccountedAt: now,
    breakEndAt: 0
  };

  const browseLimitSeconds = settings.browseMinutes * 60;
  if (accumulatedSeconds >= browseLimitSeconds) {
    const breakEndAt = now + settings.breakMinutes * 60 * 1000;
    await chrome.storage.local.set({
      state: {
        ...DEFAULT_STATE,
        breakEndAt
      }
    });
    await broadcastBreak({ active: true, breakEndAt });
    return;
  }

  await chrome.storage.local.set({ state: nextState });
}

async function getActiveTargetInfo(settings) {
  const idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  if (idleState !== "active") return null;

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id || !tab.url) return null;

  const windowInfo = await chrome.windows.get(tab.windowId);
  if (!windowInfo || !windowInfo.focused) return null;

  const domain = getMatchingDomain(tab.url, settings);
  if (!domain) return null;

  return { tab, domain };
}

async function getTabBreakStatus(tab) {
  const { settings, state } = await getSettingsAndState();
  const isTarget = Boolean(tab && tab.url && getMatchingDomain(tab.url, settings));
  const active = isTarget && state.breakEndAt && state.breakEndAt > Date.now();
  return { ok: true, active, breakEndAt: active ? state.breakEndAt : 0 };
}

async function broadcastBreak(payload) {
  const { settings } = await getSettingsAndState();
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || !tab.url || !getMatchingDomain(tab.url, settings)) return;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: payload.active ? "show-break" : "hide-break",
          breakEndAt: payload.breakEndAt || 0
        });
      } catch {
        // The tab may not have a content script yet, or Chrome may block this URL.
      }
    })
  );
}

function getMatchingDomain(url, settings) {
  const host = hostFromUrl(url);
  if (!host) return "";

  const presetDomains = Object.entries(PRESETS)
    .filter(([key]) => settings.enabledPresets[key])
    .flatMap(([, preset]) => preset.domains);

  const domains = [...presetDomains, ...settings.customDomains];
  return domains.find((domain) => domainMatches(host, domain)) || "";
}

function hostFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return normalizeDomain(parsed.hostname);
  } catch {
    return "";
  }
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

function domainMatches(host, domain) {
  const normalizedDomain = normalizeDomain(domain);
  return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
}
