import { spawnSync } from "node:child_process";

const hasToken =
  Boolean(process.env.CHROMATIC_PROJECT_TOKEN) || process.argv.some((arg) => arg.startsWith("--project-token"));

const command = hasToken
  ? ["chromatic", ["--dry-run", "--exit-zero-on-changes", ...process.argv.slice(2)]]
  : ["npm", ["run", "build-storybook"]];

if (!hasToken) {
  console.warn("CHROMATIC_PROJECT_TOKEN is not set; validating the Storybook build locally instead.");
}

const result = spawnSync(command[0], command[1], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

process.exit(result.status ?? 1);
