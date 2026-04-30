#!/usr/bin/env node

const { mkdirSync } = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PREPROD_API_BASE_URL = "https://whispr-preprod.roadmvn.com";
const PREPROD_PORT = "8084";
const projectRoot = path.resolve(__dirname, "..");

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes("--dry-run");
const normalizedArgs = rawArgs.filter((arg) => arg !== "--dry-run");
const preprodAliases = new Set(["preprod", "--preprod"]);
const isPreprod = normalizedArgs.some((arg) => preprodAliases.has(arg));
const mode = isPreprod ? "preprod" : normalizedArgs[0];
const passthroughArgs = normalizedArgs.filter((arg) => !preprodAliases.has(arg));

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function buildLocalExpoEnv() {
  return {
    ...process.env,
    EXPO_HOME: ensureDir(path.join(projectRoot, ".expo-home")),
    HOME: ensureDir(path.join(projectRoot, ".home")),
    XDG_CACHE_HOME: ensureDir(path.join(projectRoot, ".cache")),
  };
}

function runExpo(expoArgs, env) {
  if (dryRun) {
    console.log(`cwd=${projectRoot}`);
    console.log(`env.EXPO_HOME=${env.EXPO_HOME ?? ""}`);
    console.log(`env.HOME=${env.HOME ?? ""}`);
    console.log(`env.XDG_CACHE_HOME=${env.XDG_CACHE_HOME ?? ""}`);
    console.log(
      `env.EXPO_PUBLIC_API_BASE_URL=${env.EXPO_PUBLIC_API_BASE_URL ?? ""}`,
    );
    console.log(`command=npx ${["expo", ...expoArgs].join(" ")}`);
    process.exit(0);
  }

  const child = spawn("npx", ["expo", ...expoArgs], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

if (mode === "preprod") {
  const env = {
    ...buildLocalExpoEnv(),
    EXPO_PUBLIC_API_BASE_URL: PREPROD_API_BASE_URL,
  };

  const buildOnly = passthroughArgs.includes("--build");
  const hostArgPresent = passthroughArgs.some((arg) =>
    arg === "--host" || arg.startsWith("--host="),
  );
  const finalArgs = buildOnly
    ? ["run:ios", "--port", PREPROD_PORT]
    : [
        "start",
        "--dev-client",
        "--port",
        PREPROD_PORT,
        ...(hostArgPresent ? [] : ["--host", "lan"]),
      ];

  runExpo(finalArgs.concat(passthroughArgs.filter((arg) => arg !== "--build")), env);
} else {
  runExpo(["start", ...normalizedArgs], process.env);
}
