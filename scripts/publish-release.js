const fs = require("fs");
const https = require("https");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const owner = "Adeego";
const repo = "adeegopos";
const tokenKeys = ["GH_TOKEN", "GITHUB_RELEASE_TOKEN", "GITHUB_TOKEN"];
const localPublishEnv = path.join(rootDir, ".env.publish");
const packagedEnv = path.join(rootDir, ".env");
const checkOnly = process.argv.includes("--check");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        return values;
      }

      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      values[key] = value;
      return values;
    }, {});
}

function rejectPackagedPublishSecrets() {
  const packagedValues = parseEnvFile(packagedEnv);
  const secretKeys = tokenKeys.filter((key) => packagedValues[key]);

  if (secretKeys.length > 0) {
    throw new Error(
      [
        `Remove ${secretKeys.join(", ")} from .env before publishing.`,
        ".env is packaged into the Electron installer in this project.",
        "Use a user environment variable, GitHub CLI login, or .env.publish instead.",
      ].join("\n")
    );
  }
}

function loadLocalPublishEnv() {
  const localValues = parseEnvFile(localPublishEnv);
  return localValues;
}

function tokenFromGitHubCli() {
  try {
    return execFileSync("gh", ["auth", "token"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
  } catch {
    return "";
  }
}

function resolveToken(localValues) {
  for (const key of tokenKeys) {
    if (process.env[key]) {
      return {
        token: process.env[key],
        source: key,
      };
    }
  }

  for (const key of tokenKeys) {
    if (localValues[key]) {
      return {
        token: localValues[key],
        source: `.env.publish:${key}`,
      };
    }
  }

  const ghToken = tokenFromGitHubCli();
  if (ghToken) {
    return {
      token: ghToken,
      source: "GitHub CLI",
    };
  }

  return {
    token: "",
    source: "",
  };
}

function githubRequest(token, requestPath) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.github.com",
        path: requestPath,
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "adeegopos-release-script",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body,
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

function explainMissingToken() {
  return [
    "GitHub release token is missing.",
    "",
    "Long-term setup options:",
    "1. Recommended on Windows: set a persistent user environment variable, then reopen PowerShell:",
    '   setx GITHUB_RELEASE_TOKEN "github_pat_..."',
    "2. Or install GitHub CLI, run `gh auth login`, and make sure it can access Adeego/adeegopos.",
    "3. Or create a local .env.publish file with `GITHUB_RELEASE_TOKEN=github_pat_...`.",
    "",
    "Do not put GitHub publish tokens in .env because .env is packaged into this Electron app.",
  ].join("\n");
}

function explainBadToken(statusCode, body, source) {
  let message = "";
  try {
    message = JSON.parse(body).message || "";
  } catch {
    message = body;
  }

  return [
    `GitHub token from ${source} cannot access ${owner}/${repo}.`,
    `GitHub returned HTTP ${statusCode}${message ? `: ${message}` : ""}.`,
    "",
    "Create or approve a fine-grained token for owner Adeego, repository adeegopos,",
    "with repository permission `Contents: Read and write`.",
    "If Adeego requires organization approval, approve the token before rerunning publish.",
  ].join("\n");
}

function run(command, args, env = process.env) {
  const isWindowsScript =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  const executable = isWindowsScript ? "cmd.exe" : command;
  const executableArgs = isWindowsScript
    ? ["/d", "/s", "/c", command, ...args]
    : args;

  const result = spawnSync(executable, executableArgs, {
    cwd: rootDir,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  rejectPackagedPublishSecrets();
  const localValues = loadLocalPublishEnv();

  const { token, source } = resolveToken(localValues);
  if (!token) {
    throw new Error(explainMissingToken());
  }

  const repoResponse = await githubRequest(token, `/repos/${owner}/${repo}`);
  if (repoResponse.statusCode !== 200) {
    throw new Error(explainBadToken(repoResponse.statusCode, repoResponse.body, source));
  }

  const releasesResponse = await githubRequest(token, `/repos/${owner}/${repo}/releases?per_page=1`);
  if (releasesResponse.statusCode !== 200) {
    throw new Error(explainBadToken(releasesResponse.statusCode, releasesResponse.body, source));
  }

  console.log(`GitHub release token loaded from ${source}.`);

  if (checkOnly) {
    console.log(`Token check passed for ${owner}/${repo}.`);
    return;
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const builderCommand = path.join(
    rootDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
  );
  const buildEnv = { ...process.env };
  for (const key of tokenKeys) {
    delete buildEnv[key];
  }

  run(npmCommand, ["run", "build"], buildEnv);
  run(builderCommand, ["--publish", "always"], {
    ...process.env,
    GH_TOKEN: token,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
