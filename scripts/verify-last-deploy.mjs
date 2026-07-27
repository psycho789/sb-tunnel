import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REQUIRED_SCHEMA_VERSION = "1";

function readJson(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(raw);
}

function ensureHttpsUrl(value, key) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${key} must use https protocol`);
  }
}

function validatePayload(payload, schema) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("last-deploy.json must be a JSON object");
  }

  const requiredKeys = schema.required ?? [];
  for (const key of requiredKeys) {
    if (!(key in payload)) {
      throw new Error(`Missing required key: ${key}`);
    }
  }

  const allowedKeys = new Set(Object.keys(schema.properties ?? {}));
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unknown key is not allowed by schema: ${key}`);
    }
  }

  if (typeof payload.generatedAt !== "string" || Number.isNaN(Date.parse(payload.generatedAt))) {
    throw new Error("generatedAt must be an ISO8601 date-time string");
  }

  if (typeof payload.webUrl !== "string") {
    throw new Error("webUrl must be a string");
  }

  if (typeof payload.pagesPublicUrl !== "string") {
    throw new Error("pagesPublicUrl must be a string");
  }

  ensureHttpsUrl(payload.webUrl, "webUrl");
  ensureHttpsUrl(payload.pagesPublicUrl, "pagesPublicUrl");

  if (typeof payload.webCurlOk !== "boolean") {
    throw new Error("webCurlOk must be a boolean");
  }

  if ("schemaVersion" in payload) {
    if (payload.schemaVersion !== REQUIRED_SCHEMA_VERSION) {
      throw new Error(`schemaVersion must equal "${REQUIRED_SCHEMA_VERSION}" when present`);
    }
  } else {
    console.warn(
      `Compatibility warning: schemaVersion is not present. ` +
        `Legacy payload accepted during transition to schemaVersion "${REQUIRED_SCHEMA_VERSION}".`
    );
  }
}

export function verifyLastDeploy(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const filePath = path.resolve(rootDir, "last-deploy.json");
  const schemaPath = path.resolve(rootDir, "schemas/last-deploy.schema.json");

  const schema = readJson(schemaPath);
  const payload = readJson(filePath);

  validatePayload(payload, schema);
  return { filePath, schemaPath };
}

function runCli() {
  try {
    verifyLastDeploy();
    console.log("last-deploy.json validation passed");
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`last-deploy.json validation failed: ${message}`);
    process.exit(1);
  }
}

const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentModulePath = path.resolve(fileURLToPath(import.meta.url));
if (scriptPath === currentModulePath) {
  runCli();
}
