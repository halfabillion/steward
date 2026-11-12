/**
 * US geo-gate helpers. Steward must not enable a path for US users.
 * Timezone is a heuristic; attestation is required for everyone else.
 * A US timezone is a hard block with no bypass in the app.
 */
export const US_TIMEZONES = new Set([
  "America/New_York",
  "America/Detroit",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Indiana/Indianapolis",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Vevay",
  "America/Indiana/Tell_City",
  "America/Indiana/Knox",
  "America/Chicago",
  "America/Menominee",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/North_Dakota/Beulah",
  "America/Denver",
  "America/Boise",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Juneau",
  "America/Sitka",
  "America/Yakutat",
  "America/Nome",
  "America/Adak",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
  "America/St_Thomas",
  "Pacific/Guam",
  "Pacific/Saipan",
  "Pacific/Pago_Pago",
  "America/Virgin",
]);

export function isUsTimezone(timeZone) {
  if (!timeZone) return false;
  if (US_TIMEZONES.has(timeZone)) return true;
  // Broad catch for remaining US IANA names, excluding Canada/Mexico/etc.
  if (timeZone.startsWith("US/")) return true;
  return false;
}

/**
 * @param {{ timeZone?: string, countryCode?: string | null }} hints
 * @returns {{ allowed: boolean, reason: string, code: string }}
 */
export function evaluateLocation(hints = {}) {
  const country = (hints.countryCode || "").toUpperCase();
  if (country === "US" || country === "USA") {
    return {
      allowed: false,
      code: "us_country",
      reason: "Steward is not available to persons in the United States.",
    };
  }
  if (isUsTimezone(hints.timeZone)) {
    return {
      allowed: false,
      code: "us_timezone",
      reason: "Steward is not available to persons in the United States. Your device timezone is a US zone.",
    };
  }
  return {
    allowed: true,
    code: "ok",
    reason: "Location hints are not US. Attestation is still required.",
  };
}

export const ATTESTATION_ITEMS = [
  {
    id: "not_us",
    label: "I am not a US person, I am not located in the United States, and I will not use Steward from the United States.",
  },
  {
    id: "age",
    label: "I am 18 years of age or older.",
  },
  {
    id: "not_advice",
    label: "I understand Steward is a research and paper-portfolio tool. It is not investment, legal, or tax advice, not a broker, and not an offer or solicitation to buy or sell any security or tokenized stock.",
  },
  {
    id: "no_rights",
    label: "I understand Coinbase tokenized stocks do not give me shareholder rights (such as voting) in the underlying company, and that Steward is not endorsed by Coinbase, Base, or any issuer.",
  },
  {
    id: "paper",
    label: "I understand approvals are recorded on a local or testnet log, never auto-spend, and do not execute live mainnet trades.",
  },
];
