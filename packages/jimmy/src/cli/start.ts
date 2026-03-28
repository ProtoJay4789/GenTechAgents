import fs from "node:fs";
import { JINN_HOME } from "../shared/paths.js";
import { loadConfig } from "../shared/config.js";
import { startForeground, startDaemon } from "../gateway/lifecycle.js";
import { compareSemver, getPackageVersion, getInstanceVersion } from "../shared/version.js";

const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Load environment variables from ~/.jinn/.env if it exists.
 * Supports KEY=value and KEY="value" formats; ignores comments and blank lines.
 */
function loadDotEnv(): void {
  const envFile = `${JINN_HOME}/.env`;
  if (!fs.existsSync(envFile)) return;

  const lines = fs.readFileSync(envFile, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export async function runStart(opts: { daemon?: boolean; port?: number }): Promise<void> {
  if (!fs.existsSync(JINN_HOME)) {
    console.error(
      `Error: ${JINN_HOME} does not exist. Run "jinn setup" first.`
    );
    process.exit(1);
  }

  // Load .env before config so ${VAR} placeholders resolve correctly
  loadDotEnv();

  const config = loadConfig();

  // Check for pending migrations
  const instanceVersion = getInstanceVersion();
  const pkgVersion = getPackageVersion();
  if (compareSemver(instanceVersion, pkgVersion) < 0) {
    console.log(
      `${YELLOW}[migrate]${RESET} Instance is at v${instanceVersion}, CLI is v${pkgVersion}. Run ${DIM}jinn migrate${RESET} to update.`
    );
  }

  // Allow CLI --port to override config
  if (opts.port) {
    config.gateway.port = opts.port;
  }

  if (opts.daemon) {
    startDaemon(config);
    console.log("Gateway started in background.");
  } else {
    console.log(
      `Starting gateway on ${config.gateway.host}:${config.gateway.port}...`
    );
    await startForeground(config);
  }
}
