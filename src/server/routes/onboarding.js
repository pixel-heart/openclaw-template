const { createOnboardingService } = require("../onboarding");

const sanitizeOnboardingError = (error) => {
  const raw = String(error?.message || "Onboarding failed");
  const redacted = raw
    .replace(/sk-[^\s"]+/g, "***")
    .replace(/ghp_[^\s"]+/g, "***")
    .replace(/(?:token|api[_-]?key)["'\s:=]+[^\s"']+/gi, (match) =>
      match.replace(/[^\s"':=]+$/g, "***"),
    );
  if (redacted.toLowerCase().includes("command failed: openclaw onboard")) {
    return "Onboarding command failed. Please verify credentials and try again.";
  }
  return redacted.slice(0, 300);
};

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
  const onboardingService = createOnboardingService({
    fs,
    constants,
    shellCmd,
    gatewayEnv,
    writeEnvFile,
    reloadEnv,
    resolveGithubRepoUrl,
    resolveModelProvider,
    hasCodexOauthProfile,
    ensureGatewayProxyConfig,
    getBaseUrl,
    startGateway,
  });

  app.get("/api/onboard/status", (req, res) => {
    res.json({ onboarded: isOnboarded() });
  });

  app.post("/api/onboard", async (req, res) => {
    if (isOnboarded())
      return res.json({ ok: false, error: "Already onboarded" });

    try {
      const { vars, modelKey } = req.body;
      const result = await onboardingService.completeOnboarding({
        req,
        vars,
        modelKey,
      });
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error("[onboard] Error:", err);
      res.status(500).json({ ok: false, error: sanitizeOnboardingError(err) });
    }
  });
};

module.exports = { registerOnboardingRoutes };
