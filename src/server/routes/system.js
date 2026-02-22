const registerSystemRoutes = ({
  app,
  fs,
  readEnvFile,
  writeEnvFile,
  reloadEnv,
  kKnownVars,
  kKnownKeys,
  kSystemVars,
  syncChannelConfig,
  isGatewayRunning,
  isOnboarded,
  getChannelStatus,
  openclawVersionService,
  clawCmd,
  restartGateway,
  OPENCLAW_DIR,
}) => {
  app.get("/api/env", (req, res) => {
    const fileVars = readEnvFile();
    const merged = [];

    for (const def of kKnownVars) {
      const fileEntry = fileVars.find((v) => v.key === def.key);
      const value = fileEntry?.value || "";
      merged.push({
        key: def.key,
        value,
        label: def.label,
        group: def.group,
        hint: def.hint,
        source: fileEntry?.value ? "env_file" : "unset",
        editable: true,
      });
    }

    for (const v of fileVars) {
      if (kKnownKeys.has(v.key) || kSystemVars.has(v.key)) continue;
      merged.push({
        key: v.key,
        value: v.value,
        label: v.key,
        group: "custom",
        hint: "",
        source: "env_file",
        editable: true,
      });
    }

    res.json({ vars: merged });
  });

  app.put("/api/env", (req, res) => {
    const { vars } = req.body;
    if (!Array.isArray(vars)) {
      return res.status(400).json({ ok: false, error: "Missing vars array" });
    }

    const filtered = vars.filter((v) => !kSystemVars.has(v.key));
    syncChannelConfig(filtered, "remove");
    writeEnvFile(filtered);
    const changed = reloadEnv();
    console.log(`[wrapper] Env vars saved (${filtered.length} vars, changed=${changed})`);
    syncChannelConfig(filtered, "add");

    res.json({ ok: true, changed });
  });

  app.get("/api/status", async (req, res) => {
    const configExists = fs.existsSync(`${OPENCLAW_DIR}/openclaw.json`);
    const running = await isGatewayRunning();
    const repo = process.env.GITHUB_WORKSPACE_REPO || "";
    const openclawVersion = openclawVersionService.readOpenclawVersion();
    res.json({
      gateway: running ? "running" : configExists ? "starting" : "not_onboarded",
      configExists,
      channels: getChannelStatus(),
      repo,
      openclawVersion,
    });
  });

  app.get("/api/openclaw/version", async (req, res) => {
    const refresh = String(req.query.refresh || "") === "1";
    const status = await openclawVersionService.getVersionStatus(refresh);
    res.json(status);
  });

  app.post("/api/openclaw/update", async (req, res) => {
    const result = await openclawVersionService.updateOpenclaw();
    res.status(result.status).json(result.body);
  });

  app.get("/api/gateway-status", async (req, res) => {
    const result = await clawCmd("status");
    res.json(result);
  });

  app.get("/api/gateway/dashboard", async (req, res) => {
    if (!isOnboarded()) return res.json({ ok: false, url: "/openclaw" });
    const result = await clawCmd("dashboard --no-open");
    if (result.ok && result.stdout) {
      const tokenMatch = result.stdout.match(/#token=([a-zA-Z0-9]+)/);
      if (tokenMatch) {
        return res.json({ ok: true, url: `/openclaw/#token=${tokenMatch[1]}` });
      }
    }
    res.json({ ok: true, url: "/openclaw" });
  });

  app.post("/api/gateway/restart", (req, res) => {
    if (!isOnboarded()) {
      return res.status(400).json({ ok: false, error: "Not onboarded" });
    }
    restartGateway();
    res.json({ ok: true });
  });
};

module.exports = { registerSystemRoutes };
