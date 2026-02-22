const { exec, execSync } = require("child_process");
const {
  kVersionCacheTtlMs,
  kLatestVersionCacheTtlMs,
  kOpenclawRegistryUrl,
  kAppDir,
} = require("./constants");
const { normalizeOpenclawVersion, compareVersionParts } = require("./helpers");

const createOpenclawVersionService = ({ gatewayEnv, restartGateway, isOnboarded }) => {
  let kOpenclawVersionCache = { value: null, fetchedAt: 0 };
  let kLatestOpenclawVersionCache = { value: null, fetchedAt: 0 };
  let kOpenclawUpdateInProgress = false;

  const readOpenclawVersion = () => {
    const now = Date.now();
    if (
      kOpenclawVersionCache.value &&
      now - kOpenclawVersionCache.fetchedAt < kVersionCacheTtlMs
    ) {
      return kOpenclawVersionCache.value;
    }
    try {
      const raw = execSync("openclaw --version", {
        env: gatewayEnv(),
        timeout: 5000,
        encoding: "utf8",
      }).trim();
      const version = normalizeOpenclawVersion(raw);
      kOpenclawVersionCache = { value: version, fetchedAt: now };
      return version;
    } catch {
      return kOpenclawVersionCache.value;
    }
  };

  const fetchLatestOpenclawVersion = async ({ refresh = false } = {}) => {
    const now = Date.now();
    if (
      !refresh &&
      kLatestOpenclawVersionCache.value &&
      now - kLatestOpenclawVersionCache.fetchedAt < kLatestVersionCacheTtlMs
    ) {
      return kLatestOpenclawVersionCache.value;
    }
    const res = await fetch(kOpenclawRegistryUrl, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Registry returned ${res.status}`);
    }
    const json = await res.json();
    const latest = normalizeOpenclawVersion(json?.["dist-tags"]?.latest);
    if (!latest) {
      throw new Error("Latest version not found in npm metadata");
    }
    kLatestOpenclawVersionCache = { value: latest, fetchedAt: now };
    return latest;
  };

  const installLatestOpenclaw = () =>
    new Promise((resolve, reject) => {
      exec(
        "npm install --no-save --package-lock=false openclaw@latest",
        {
          cwd: kAppDir,
          env: {
            ...process.env,
            npm_config_update_notifier: "false",
            npm_config_fund: "false",
            npm_config_audit: "false",
          },
          timeout: 180000,
        },
        (err, stdout, stderr) => {
          if (err) {
            const message = String(stderr || err.message || "").trim();
            return reject(
              new Error(message || "Failed to install openclaw@latest"),
            );
          }
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        },
      );
    });

  const getVersionStatus = async (refresh) => {
    const currentVersion = readOpenclawVersion();
    try {
      const latestVersion = await fetchLatestOpenclawVersion({ refresh });
      const hasUpdate = !!(
        currentVersion &&
        latestVersion &&
        compareVersionParts(latestVersion, currentVersion) > 0
      );
      return { ok: true, currentVersion, latestVersion, hasUpdate };
    } catch (err) {
      return {
        ok: false,
        currentVersion,
        latestVersion: kLatestOpenclawVersionCache.value,
        hasUpdate: false,
        error: err.message || "Failed to fetch latest OpenClaw version",
      };
    }
  };

  const updateOpenclaw = async () => {
    if (kOpenclawUpdateInProgress) {
      return {
        status: 409,
        body: { ok: false, error: "OpenClaw update already in progress" },
      };
    }

    kOpenclawUpdateInProgress = true;
    const previousVersion = readOpenclawVersion();
    try {
      const latestBeforeUpdate =
        (await fetchLatestOpenclawVersion({ refresh: true }).catch(() => null)) ||
        kLatestOpenclawVersionCache.value;
      await installLatestOpenclaw();
      kOpenclawVersionCache = { value: null, fetchedAt: 0 };
      const currentVersion = readOpenclawVersion();
      const latestVersion =
        (await fetchLatestOpenclawVersion({ refresh: true }).catch(() => null)) ||
        latestBeforeUpdate ||
        kLatestOpenclawVersionCache.value;
      const hasUpdate = !!(
        currentVersion &&
        latestVersion &&
        compareVersionParts(latestVersion, currentVersion) > 0
      );
      let restarted = false;
      if (isOnboarded()) {
        restartGateway();
        restarted = true;
      }
      return {
        status: 200,
        body: {
          ok: true,
          previousVersion,
          currentVersion,
          latestVersion,
          hasUpdate,
          restarted,
          updated: previousVersion !== currentVersion,
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: { ok: false, error: err.message || "Failed to update OpenClaw" },
      };
    } finally {
      kOpenclawUpdateInProgress = false;
    }
  };

  return {
    readOpenclawVersion,
    getVersionStatus,
    updateOpenclaw,
  };
};

module.exports = { createOpenclawVersionService };
