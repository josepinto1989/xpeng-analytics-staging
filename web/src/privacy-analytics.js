export const ANALYTICS_CONSENT_KEY = "xpeng-analytics-web-analytics-consent-v1";
export const CLOUDFLARE_BEACON_ID = "xpeng-cloudflare-web-analytics";

const configuredToken = typeof import.meta !== "undefined"
  ? String(import.meta.env?.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN || "").trim()
  : "";

export function cloudflareAnalyticsConfiguration(token = configuredToken) {
  const normalized = String(token || "").trim();
  return { configured: Boolean(normalized), token: normalized };
}

export function readAnalyticsConsent(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(ANALYTICS_CONSENT_KEY);
    return value === "allow" || value === "decline" ? value : null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(value, storage = globalThis.localStorage) {
  if (value !== "allow" && value !== "decline") throw new TypeError("Invalid analytics consent value");
  try {
    storage?.setItem(ANALYTICS_CONSENT_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function loadCloudflareAnalytics(token, documentObject = globalThis.document) {
  const config = cloudflareAnalyticsConfiguration(token);
  if (!config.configured || !documentObject?.head || documentObject.getElementById?.(CLOUDFLARE_BEACON_ID)) return false;
  const script = documentObject.createElement("script");
  script.id = CLOUDFLARE_BEACON_ID;
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token: config.token });
  documentObject.head.appendChild(script);
  return true;
}
