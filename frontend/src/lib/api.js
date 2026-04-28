const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

function buildUrl(path, params = {}) {
    const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return `${url.pathname}${url.search}`;
}

async function request(path, { method = "GET", params, body, signal } = {}) {
    const response = await fetch(buildUrl(path, params), {
        method,
        headers: {
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
        throw new Error(message);
    }

    if (payload && typeof payload === "object" && "ok" in payload) {
        return payload.data;
    }

    return payload;
}

export const api = {
    health: () => request("/health"),
    schemas: () => request("/schemas"),
    listPackets: (params) => request("/packets", { params }),
    packetCount: () => request("/packets/count"),
    createPacket: (body) => request("/packets", { method: "POST", body }),
    deletePacket: (packetId) => request(`/packets/${packetId}`, { method: "DELETE" }),
    listSessions: (params) => request("/sessions", { params }),
    listAlerts: (params) => request("/alerts", { params }),
    getAlert: (alertId) => request(`/alerts/${alertId}`),
    updateAlertStatus: (alertId, status) => request(`/alerts/${alertId}/status`, { method: "PUT", body: { status } }),
    listPredictions: (params) => request("/predictions", { params }),
    listIngestionRuns: (params) => request("/ingestion-runs", { params }),
    topIps: (params) => request("/top-ips", { params }),
    trafficTrends: (params) => request("/traffic-trends", { params }),
    predict: (body) => request("/predict", { method: "POST", body }),
};
