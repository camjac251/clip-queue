import type { UserConfig } from "@commitlint/types";

const configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  // Ignore dependabot commits (ref: https://github.com/dependabot/dependabot-core/issues/2445)
  ignores: [(commit) => /Signed-off-by: dependabot\[bot]/m.test(commit)],
  rules: {
    // Subject line: 72 chars (git best practice for single-line display)
    "subject-max-length": [2, "always", 72],

    // Body: 120 chars (balance readability vs flexibility for detailed explanations)
    "body-max-line-length": [2, "always", 120],

    // Footer: 120 chars (for issue references, breaking changes, etc.)
    "footer-max-line-length": [2, "always", 120],

    // Scopes (based on project structure - not enforced, just validated if provided)
    "scope-enum": [
      2,
      "always",
      [
        "api",
        "web",
        "player",
        "platforms",
        "queue-ops",
        "services",
        "schemas",
        "ui",
        "utils",
        "constants",
        "config",
        "deps",
        "i18n",
        "docs",
        "ci",
        "docker",
        "db",
      ],
    ],

    // Allow empty scope (some commits are cross-cutting)
    "scope-empty": [0, "never"],

    // Types (extends conventional with common additions)
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation only
        "style", // Code style (formatting, missing semi colons, etc)
        "refactor", // Code change that neither fixes a bug nor adds a feature
        "perf", // Performance improvement
        "test", // Adding or updating tests
        "build", // Changes to build system or dependencies
        "ci", // CI configuration changes
        "chore", // Other changes that don't modify src or test files
        "revert", // Revert a previous commit
      ],
    ],
  },
};

export default configuration;
