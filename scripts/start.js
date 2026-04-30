#!/usr/bin/env node

const { mkdirSync } = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PREPROD_API_BASE_URL = "https://whispr-preprod.roadmvn.com";
const PREPROD_PORT = "8084";
const projectRoot = path.resolve(__dirname, "..");

const rawArgs = process.argv.slice(2);
const mode = rawArgs[0];
const passthroughArgs = rawArgs.slice(1);
const dryRun = rawArgs.includes("--dry-run");

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

  runExpo(["run:ios", "--port", PREPROD_PORT, ...passthroughArgs], env);
} else {
  runExpo(["start", ...rawArgs.filter((arg) => arg !== "--dry-run")], process.env);
}
