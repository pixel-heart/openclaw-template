const syncBootstrapPromptFiles = ({ fs, workspaceDir }) => {
  try {
    const bootstrapDir = `${workspaceDir}/hooks/bootstrap`;
    fs.mkdirSync(bootstrapDir, { recursive: true });
    fs.copyFileSync("/app/setup/core-prompts/AGENTS.md", `${bootstrapDir}/AGENTS.md`);
    fs.copyFileSync("/app/setup/core-prompts/TOOLS.md", `${bootstrapDir}/TOOLS.md`);
    console.log("[onboard] Bootstrap prompt files synced");
  } catch (e) {
    console.error("[onboard] Bootstrap prompt sync error:", e.message);
  }
};

const installControlUiSkill = ({ fs, openclawDir, baseUrl }) => {
  try {
    const skillDir = `${openclawDir}/skills/control-ui`;
    fs.mkdirSync(skillDir, { recursive: true });
    const skillTemplate = fs.readFileSync("/app/setup/skills/control-ui/SKILL.md", "utf8");
    const skillContent = skillTemplate.replace(/\{\{BASE_URL\}\}/g, baseUrl);
    fs.writeFileSync(`${skillDir}/SKILL.md`, skillContent);
    console.log(`[onboard] Control UI skill installed (${baseUrl})`);
  } catch (e) {
    console.error("[onboard] Skill install error:", e.message);
  }
};

module.exports = { installControlUiSkill, syncBootstrapPromptFiles };
