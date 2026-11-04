import {
  ANALYTICS_CONSENT_KEY,
  CLOUDFLARE_BEACON_ID,
  cloudflareAnalyticsConfiguration,
  loadCloudflareAnalytics,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "../src/privacy-analytics.js";

const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
if (readAnalyticsConsent(storage) !== null) throw new Error("Consent must be undecided initially");
writeAnalyticsConsent("allow", storage);
if (values.get(ANALYTICS_CONSENT_KEY) !== "allow" || readAnalyticsConsent(storage) !== "allow") throw new Error("Allowed consent was not preserved");
writeAnalyticsConsent("decline", storage);
if (readAnalyticsConsent(storage) !== "decline") throw new Error("Declined consent was not preserved");
if (cloudflareAnalyticsConfiguration().configured) throw new Error("Tests must not have an analytics token by default");
if (!cloudflareAnalyticsConfiguration(" public-token ").configured) throw new Error("A trimmed public token should configure analytics");

const appended = [];
const documentObject = {
  head: { appendChild: (node) => appended.push(node) },
  getElementById: () => null,
  createElement: () => ({ dataset: {} }),
};
if (!loadCloudflareAnalytics("public-token", documentObject)) throw new Error("Configured analytics did not load");
if (appended.length !== 1 || appended[0].id !== CLOUDFLARE_BEACON_ID) throw new Error("Analytics beacon identity is incorrect");
if (appended[0].src !== "https://static.cloudflareinsights.com/beacon.min.js") throw new Error("Unexpected analytics beacon source");
if (JSON.parse(appended[0].dataset.cfBeacon).token !== "public-token") throw new Error("Analytics token was not attached to the beacon");
if (loadCloudflareAnalytics("", documentObject)) throw new Error("Analytics loaded without a token");

console.log("Optional Cloudflare Web Analytics consent passed.");
