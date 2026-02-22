const registerOnboardingRoutes = ({
  app,
  fs,
  constants,
  shellCmd,
  gatewayEnv,
  writeEnvFile,
  reloadEnv,
  isOnboarded,
  resolveGithubRepoUrl,
  resolveModelProvider,
  hasCodexOauthProfile,
  ensureGatewayProxyConfig,
  getBaseUrl,
  startGateway,
}) => {
  const { OPENCLAW_DIR, WORKSPACE_DIR } = constants;

  app.get("/api/onboard/status", (req, res) => {
    res.json({ onboarded: isOnboarded() });
  });

  app.post("/api/onboard", async (req, res) => {
    if (isOnboarded()) return res.json({ ok: false, error: "Already onboarded" });

    const { vars, modelKey } = req.body;
    if (!Array.isArray(vars)) {
      return res.status(400).json({ ok: false, error: "Missing vars array" });
    }
    if (!modelKey || typeof modelKey !== "string" || !modelKey.includes("/")) {
      return res
        .status(400)
        .json({ ok: false, error: "A model selection is required" });
    }

    const varMap = Object.fromEntries(vars.map((v) => [v.key, v.value]));
    const githubToken = String(varMap.GITHUB_TOKEN || "");
    const githubRepoInput = String(varMap.GITHUB_WORKSPACE_REPO || "").trim();
    const selectedProvider = resolveModelProvider(modelKey);
    const hasCodexOauth = hasCodexOauthProfile();

    const hasAiByProvider = {
      anthropic: !!(varMap.ANTHROPIC_API_KEY || varMap.ANTHROPIC_TOKEN),
      openai: !!varMap.OPENAI_API_KEY,
      "openai-codex": !!(hasCodexOauth || varMap.OPENAI_API_KEY),
      google: !!varMap.GEMINI_API_KEY,
    };
    const hasAnyAi = !!(
      varMap.ANTHROPIC_API_KEY ||
      varMap.ANTHROPIC_TOKEN ||
      varMap.OPENAI_API_KEY ||
      varMap.GEMINI_API_KEY ||
      hasCodexOauth
    );
    const hasAi =
      selectedProvider in hasAiByProvider
        ? hasAiByProvider[selectedProvider]
        : hasAnyAi;
    const hasGithub = !!(githubToken && githubRepoInput);
    const hasChannel = !!(varMap.TELEGRAM_BOT_TOKEN || varMap.DISCORD_BOT_TOKEN);
    if (!hasAi) {
      if (selectedProvider === "openai-codex") {
        return res.status(400).json({
          ok: false,
          error:
            "Connect OpenAI Codex OAuth or provide OPENAI_API_KEY before continuing",
        });
      }
      return res.status(400).json({
        ok: false,
        error: `Missing credentials for selected provider "${selectedProvider}"`,
      });
    }
    if (!hasGithub) {
      return res.status(400).json({
        ok: false,
        error: "GitHub token and workspace repo are required",
      });
    }
    if (!hasChannel) {
      return res
        .status(400)
        .json({ ok: false, error: "At least one channel token is required" });
    }

    try {
      const repoUrl = resolveGithubRepoUrl(githubRepoInput);
      const varsToSave = [...vars.filter((v) => v.value && v.key !== "GITHUB_WORKSPACE_REPO")];
      varsToSave.push({ key: "GITHUB_WORKSPACE_REPO", value: repoUrl });
      writeEnvFile(varsToSave);
      reloadEnv();

      const remoteUrl = `https://${githubToken}@github.com/${repoUrl}.git`;
      const [, repoName] = repoUrl.split("/");
      const ghHeaders = {
        Authorization: `token ${githubToken}`,
        "User-Agent": "openclaw-railway",
        Accept: "application/vnd.github+json",
      };
      try {
        const checkRes = await fetch(`https://api.github.com/repos/${repoUrl}`, {
          headers: ghHeaders,
        });
        if (checkRes.status === 404) {
          console.log(`[onboard] Creating repo ${repoUrl}...`);
          const createRes = await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: { ...ghHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: repoName,
              private: true,
              auto_init: false,
            }),
          });
          if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            return res.status(400).json({
              ok: false,
              error: `Failed to create repo: ${err.message || createRes.statusText}`,
            });
          }
          console.log(`[onboard] Repo ${repoUrl} created`);
        } else if (checkRes.ok) {
          const { stdout } = await new Promise((resolve, reject) => {
            require("child_process").exec(
              `git ls-remote "${remoteUrl}"`,
              { timeout: 15000 },
              (err, out) => {
                if (err) return reject(err);
                resolve({ stdout: out?.trim() || "" });
              },
            );
          });
          if (stdout.length > 0) {
            return res.status(400).json({
              ok: false,
              error: `Repo "${repoUrl}" already has content. Please use an empty repo or a new name — we'll create it for you.`,
            });
          }
        } else {
          return res.status(400).json({
            ok: false,
            error: `Cannot access repo "${repoUrl}" — check your token has the "repo" scope`,
          });
        }
      } catch (e) {
        return res.status(400).json({ ok: false, error: `GitHub error: ${e.message}` });
      }

      fs.mkdirSync(OPENCLAW_DIR, { recursive: true });
      fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

      if (!fs.existsSync(`${OPENCLAW_DIR}/.git`)) {
        await shellCmd(
          `cd ${OPENCLAW_DIR} && git init -b main && git remote add origin "${remoteUrl}" && git config user.email "agent@openclaw.ai" && git config user.name "OpenClaw Agent"`,
        );
        console.log("[onboard] Git initialized");
      }

      if (!fs.existsSync(`${OPENCLAW_DIR}/.gitignore`)) {
        fs.copyFileSync("/app/setup/gitignore", `${OPENCLAW_DIR}/.gitignore`);
      }

      const onboardArgs = [
        "--non-interactive",
        "--accept-risk",
        "--flow",
        "quickstart",
        "--gateway-bind",
        "loopback",
        "--gateway-port",
        "18789",
        "--gateway-auth",
        "token",
        "--gateway-token",
        varMap.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN || "",
        "--no-install-daemon",
        "--skip-health",
        "--workspace",
        WORKSPACE_DIR,
      ];

      if (
        selectedProvider === "openai-codex" &&
        (varMap.OPENAI_API_KEY || process.env.OPENAI_API_KEY)
      ) {
        onboardArgs.push(
          "--auth-choice",
          "openai-api-key",
          "--openai-api-key",
          varMap.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        );
      } else if (selectedProvider === "openai-codex" && hasCodexOauth) {
        onboardArgs.push("--auth-choice", "skip");
      } else if (
        (selectedProvider === "anthropic" || !selectedProvider) &&
        (varMap.ANTHROPIC_TOKEN || process.env.ANTHROPIC_TOKEN)
      ) {
        onboardArgs.push(
          "--auth-choice",
          "token",
          "--token-provider",
          "anthropic",
          "--token",
          varMap.ANTHROPIC_TOKEN || process.env.ANTHROPIC_TOKEN,
        );
      } else if (
        (selectedProvider === "anthropic" || !selectedProvider) &&
        (varMap.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)
      ) {
        onboardArgs.push(
          "--auth-choice",
          "apiKey",
          "--anthropic-api-key",
          varMap.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
        );
      } else if (
        (selectedProvider === "openai" || !selectedProvider) &&
        (varMap.OPENAI_API_KEY || process.env.OPENAI_API_KEY)
      ) {
        onboardArgs.push(
          "--auth-choice",
          "openai-api-key",
          "--openai-api-key",
          varMap.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        );
      } else if (
        (selectedProvider === "google" || !selectedProvider) &&
        (varMap.GEMINI_API_KEY || process.env.GEMINI_API_KEY)
      ) {
        onboardArgs.push(
          "--auth-choice",
          "gemini-api-key",
          "--gemini-api-key",
          varMap.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
        );
      } else if (varMap.ANTHROPIC_TOKEN || process.env.ANTHROPIC_TOKEN) {
        onboardArgs.push(
          "--auth-choice",
          "token",
          "--token-provider",
          "anthropic",
          "--token",
          varMap.ANTHROPIC_TOKEN || process.env.ANTHROPIC_TOKEN,
        );
      } else if (varMap.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) {
        onboardArgs.push(
          "--auth-choice",
          "apiKey",
          "--anthropic-api-key",
          varMap.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
        );
      } else if (varMap.OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
        onboardArgs.push(
          "--auth-choice",
          "openai-api-key",
          "--openai-api-key",
          varMap.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        );
      } else if (varMap.GEMINI_API_KEY || process.env.GEMINI_API_KEY) {
        onboardArgs.push(
          "--auth-choice",
          "gemini-api-key",
          "--gemini-api-key",
          varMap.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
        );
      } else if (hasCodexOauth) {
        onboardArgs.push("--auth-choice", "skip");
      }

      console.log(
        `[onboard] Running: openclaw onboard ${onboardArgs.join(" ").replace(/sk-[^\s]+/g, "***")}`,
      );
      await shellCmd(`openclaw onboard ${onboardArgs.map((a) => `"${a}"`).join(" ")}`, {
        env: {
          ...process.env,
          OPENCLAW_HOME: "/data",
          OPENCLAW_CONFIG_PATH: `${OPENCLAW_DIR}/openclaw.json`,
        },
        timeout: 120000,
      });
      console.log("[onboard] Onboard complete");

      await shellCmd(`openclaw models set "${modelKey}"`, {
        env: gatewayEnv(),
        timeout: 30000,
      }).catch((e) => {
        console.error("[onboard] Failed to set model:", e.message);
        throw new Error(`Onboarding completed but failed to set model "${modelKey}"`);
      });

      try {
        fs.rmSync(`${WORKSPACE_DIR}/.git`, { recursive: true, force: true });
      } catch {}

      const cfg = JSON.parse(fs.readFileSync(`${OPENCLAW_DIR}/openclaw.json`, "utf8"));
      if (!cfg.channels) cfg.channels = {};
      if (!cfg.plugins) cfg.plugins = {};
      if (!cfg.plugins.entries) cfg.plugins.entries = {};
      if (!cfg.commands) cfg.commands = {};
      cfg.commands.restart = true;

      if (varMap.TELEGRAM_BOT_TOKEN) {
        cfg.channels.telegram = {
          enabled: true,
          botToken: varMap.TELEGRAM_BOT_TOKEN,
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
        };
        cfg.plugins.entries.telegram = { enabled: true };
        console.log("[onboard] Telegram configured");
      }
      if (varMap.DISCORD_BOT_TOKEN) {
        cfg.channels.discord = {
          enabled: true,
          token: varMap.DISCORD_BOT_TOKEN,
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
        };
        cfg.plugins.entries.discord = { enabled: true };
        console.log("[onboard] Discord configured");
      }

      let content = JSON.stringify(cfg, null, 2);
      const replacements = [
        [process.env.OPENCLAW_GATEWAY_TOKEN, "${OPENCLAW_GATEWAY_TOKEN}"],
        [varMap.ANTHROPIC_API_KEY, "${ANTHROPIC_API_KEY}"],
        [varMap.ANTHROPIC_TOKEN, "${ANTHROPIC_TOKEN}"],
        [varMap.TELEGRAM_BOT_TOKEN, "${TELEGRAM_BOT_TOKEN}"],
        [varMap.DISCORD_BOT_TOKEN, "${DISCORD_BOT_TOKEN}"],
        [varMap.OPENAI_API_KEY, "${OPENAI_API_KEY}"],
        [varMap.GEMINI_API_KEY, "${GEMINI_API_KEY}"],
        [varMap.BRAVE_API_KEY, "${BRAVE_API_KEY}"],
      ];
      for (const [secret, envRef] of replacements) {
        if (secret && secret.length > 8) {
          content = content.split(secret).join(envRef);
        }
      }
      fs.writeFileSync(`${OPENCLAW_DIR}/openclaw.json`, content);
      console.log("[onboard] Config sanitized");

      ensureGatewayProxyConfig(getBaseUrl(req));

      const agentsMd = `${WORKSPACE_DIR}/AGENTS.md`;
      const toolsMd = `${WORKSPACE_DIR}/TOOLS.md`;
      const heartbeatMd = `${WORKSPACE_DIR}/HEARTBEAT.md`;

      try {
        const agentsContent = fs.existsSync(agentsMd) ? fs.readFileSync(agentsMd, "utf8") : "";
        if (!agentsContent.includes("No YOLO System Changes")) {
          fs.appendFileSync(agentsMd, fs.readFileSync("/app/setup/AGENTS.md.append", "utf8"));
        }
      } catch (e) {
        console.error("[onboard] AGENTS.md append error:", e.message);
      }

      try {
        const toolsContent = fs.existsSync(toolsMd) ? fs.readFileSync(toolsMd, "utf8") : "";
        if (!toolsContent.includes("Git Discipline")) {
          fs.appendFileSync(toolsMd, fs.readFileSync("/app/setup/TOOLS.md.append", "utf8"));
        }
      } catch (e) {
        console.error("[onboard] TOOLS.md append error:", e.message);
      }

      try {
        const heartbeatContent = fs.existsSync(heartbeatMd)
          ? fs.readFileSync(heartbeatMd, "utf8")
          : "";
        if (!heartbeatContent.includes("Git hygiene")) {
          fs.appendFileSync(
            heartbeatMd,
            fs.readFileSync("/app/setup/HEARTBEAT.md.append", "utf8"),
          );
        }
      } catch (e) {
        console.error("[onboard] HEARTBEAT.md append error:", e.message);
      }

      try {
        const baseUrl = getBaseUrl(req);
        const skillDir = `${OPENCLAW_DIR}/skills/control-ui`;
        fs.mkdirSync(skillDir, { recursive: true });
        const skillTemplate = fs.readFileSync("/app/setup/skills/control-ui/SKILL.md", "utf8");
        const skillContent = skillTemplate.replace(/\{\{BASE_URL\}\}/g, baseUrl);
        fs.writeFileSync(`${skillDir}/SKILL.md`, skillContent);
        console.log(`[onboard] Control UI skill installed (${baseUrl})`);
      } catch (e) {
        console.error("[onboard] Skill install error:", e.message);
      }

      await shellCmd(
        `cd ${OPENCLAW_DIR} && git add -A && git commit -m "initial setup" && git push -u origin main`,
        { timeout: 30000 },
      ).catch((e) => console.error("[onboard] Git push error:", e.message));
      console.log("[onboard] Initial state committed and pushed");

      startGateway();
      res.json({ ok: true });
    } catch (err) {
      console.error("[onboard] Error:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
};

module.exports = { registerOnboardingRoutes };
