import http from "node:http";
import { existsSync, readFileSync } from "node:fs";

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_ENDPOINT = process.env.GROQ_ENDPOINT || "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((origin) => origin.trim());
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);
const hits = new Map();

function loadEnvFile() {
  if (!existsSync(".env")) return;

  const envText = readFileSync(".env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function corsOrigin(origin) {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return "";
}

function sendJson(response, status, body, origin = "") {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store"
  };
  const allowed = corsOrigin(origin);
  if (allowed) headers["access-control-allow-origin"] = allowed;

  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function clientKey(request) {
  return request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
}

function isRateLimited(request) {
  const key = clientKey(request);
  const minute = Math.floor(Date.now() / 60000);
  const bucketKey = `${key}:${minute}`;
  const count = hits.get(bucketKey) || 0;
  hits.set(bucketKey, count + 1);

  for (const staleKey of hits.keys()) {
    if (!staleKey.endsWith(`:${minute}`)) hits.delete(staleKey);
  }

  return count >= RATE_LIMIT_PER_MINUTE;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sanitizePayload(payload) {
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new Error("messages must be a non-empty array.");
  }

  return {
    model: String(payload.model || DEFAULT_MODEL),
    messages: payload.messages.map((message) => ({
      role: ["system", "user", "assistant"].includes(message.role) ? message.role : "user",
      content: String(message.content || "").slice(0, 50_000)
    })),
    temperature: Number.isFinite(Number(payload.temperature)) ? Number(payload.temperature) : 0.4,
    max_tokens: Number.isFinite(Number(payload.max_tokens)) ? Number(payload.max_tokens) : 900
  };
}

async function handleChat(request, response) {
  const origin = request.headers.origin || "";

  if (!GROQ_API_KEY) {
    sendJson(response, 500, { error: { message: "GROQ_API_KEY is not configured on the proxy server." } }, origin);
    return;
  }

  if (isRateLimited(request)) {
    sendJson(response, 429, { error: { message: "Rate limit exceeded. Try again later." } }, origin);
    return;
  }

  try {
    const body = await readBody(request);
    const payload = sanitizePayload(JSON.parse(body || "{}"));
    const upstream = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "access-control-allow-origin": corsOrigin(origin) || "",
      "cache-control": "no-store"
    });
    response.end(text);
  } catch (error) {
    sendJson(response, 400, { error: { message: error.message } }, origin);
  }
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || "";

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {}, origin);
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true }, origin);
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat") {
    await handleChat(request, response);
    return;
  }

  sendJson(response, 404, { error: { message: "Not found." } }, origin);
});

server.listen(PORT, () => {
  console.log(`PromptForge proxy listening on http://localhost:${PORT}`);
});
