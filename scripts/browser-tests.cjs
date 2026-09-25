const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const result = spawnSync(
  process.execPath,
  ["--test", "test/domain.test.js", "test/integration.test.js"],
  {
    cwd: path.join(root, "backend"),
    env: { ...process.env, RUN_BROWSER_TESTS: "1" },
    stdio: "inherit",
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
