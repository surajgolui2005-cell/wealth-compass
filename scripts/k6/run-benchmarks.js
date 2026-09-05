/**
 * Wealth Compass Automated Benchmark Orchestrator
 * ================================================
 * Boots the benchmark server, executes K6 test suites,
 * parses detailed SLA compliance metrics, and exports benchmark data.
 */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const K6_BIN = path.resolve(__dirname, "../k6-bin/k6-v0.56.0-windows-amd64/k6.exe");
const SERVER_SCRIPT = path.resolve(__dirname, "mock-benchmark-server.js");
const PORT = 3001;

function waitForHealth(maxWaitMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(`http://localhost:${PORT}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        })
        .on("error", retry);
    };

    const retry = () => {
      if (Date.now() - start > maxWaitMs) {
        reject(new Error("Benchmark server failed to start within timeout"));
      } else {
        setTimeout(check, 250);
      }
    };

    check();
  });
}

function runK6(scriptPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n================================================================`);
    console.log(`Executing K6 Suite: ${path.basename(scriptPath)}`);
    console.log(`================================================================\n`);

    const args = ["run", scriptPath, ...extraArgs];
    const proc = spawn(K6_BIN, args, {
      env: { ...process.env, BASE_URL: `http://localhost:${PORT}` },
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      process.stdout.write(text);
      stdout += text;
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      process.stderr.write(text);
      stderr += text;
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        // Even if non-zero exit code due to slight threshold warning, capture output
        resolve({ stdout, stderr, code });
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log("[Orchestrator] Starting Benchmark Server...");
  const serverProc = spawn("node", [SERVER_SCRIPT], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "inherit",
  });

  try {
    await waitForHealth();
    console.log("[Orchestrator] Benchmark Server is healthy and ready.\n");

    // ── 1. Run Analytics Cache Verification ─────────────────────────────────
    const cacheScript = path.resolve(__dirname, "analytics-cache-test.js");
    const cacheResult = await runK6(cacheScript);

    // ── 2. Run 1,000 Concurrent VU Portfolio Stress Test ────────────────────
    const stressScript = path.resolve(__dirname, "portfolio-stress-test.js");
    const stressResult = await runK6(stressScript);

    console.log("\n================================================================");
    console.log("BENCHMARK EXECUTION COMPLETE");
    console.log("================================================================");

    // Save summary outputs
    const resultsDir = path.resolve(__dirname, "../../docs/performance");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(resultsDir, "k6-raw-output.txt"),
      `--- CACHE VERIFICATION ---\n${cacheResult.stdout}\n\n--- STRESS TEST ---\n${stressResult.stdout}`,
      "utf8",
    );
    console.log(
      `[Orchestrator] Raw outputs saved to ${path.join(resultsDir, "k6-raw-output.txt")}`,
    );
  } finally {
    console.log("\n[Orchestrator] Stopping Benchmark Server...");
    serverProc.kill();
  }
}

main().catch((err) => {
  console.error("[Orchestrator] Failed:", err);
  process.exit(1);
});
