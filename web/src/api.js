async function req(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  health: () => req("GET", "/api/health"),
  eligibility: (timeZone, countryCode) => {
    const q = new URLSearchParams({ timeZone: timeZone || "" });
    if (countryCode) q.set("countryCode", countryCode);
    return req("GET", `/api/eligibility?${q}`);
  },
  status: () => req("GET", "/api/status"),
  snapshot: () => req("GET", "/api/snapshot"),
  saveMandate: (body) => req("PUT", "/api/mandate", body),
  runAgent: () => req("POST", "/api/agent/run"),
  schedule: (body) => req("POST", "/api/agent/schedule", body),
  stopSchedule: () => req("DELETE", "/api/agent/schedule"),
  approve: (id) => req("POST", `/api/proposals/${encodeURIComponent(id)}/approve`),
  reject: (id) => req("POST", `/api/proposals/${encodeURIComponent(id)}/reject`),
  log: () => req("GET", "/api/log"),
};
