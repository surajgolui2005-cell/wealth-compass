/**
 * GitHub Actions Workflow Syntax & Schema Validator
 * =================================================
 * Validates YAML structure, required fields, job dependencies,
 * and security scanning configurations across all workflow files.
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const WORKFLOWS_DIR = path.resolve(__dirname, "../.github/workflows");

function validateWorkflows() {
  console.log("================================================================");
  console.log("Validating GitHub Actions Workflows");
  console.log("================================================================\n");

  const files = fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  let hasError = false;

  for (const file of files) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    const content = fs.readFileSync(filePath, "utf8");

    console.log(`Checking ${file}...`);

    let doc;
    try {
      doc = yaml.load(content);
    } catch (err) {
      console.error(`  ❌ YAML Syntax Error in ${file}:`, err.message);
      hasError = true;
      continue;
    }

    // Check top-level required fields
    if (!doc.name) {
      console.error(`  ❌ Missing top-level 'name' in ${file}`);
      hasError = true;
    }
    if (!doc.on) {
      console.error(`  ❌ Missing top-level 'on' trigger in ${file}`);
      hasError = true;
    }
    if (!doc.jobs || typeof doc.jobs !== "object") {
      console.error(`  ❌ Missing or invalid 'jobs' object in ${file}`);
      hasError = true;
      continue;
    }

    const jobNames = Object.keys(doc.jobs);
    console.log(`  ✓ Top-level schema valid (${jobNames.length} jobs: ${jobNames.join(", ")})`);

    // Check each job
    for (const [jobId, job] of Object.entries(doc.jobs)) {
      if (!job["runs-on"]) {
        console.error(`    ❌ Job '${jobId}' missing 'runs-on'`);
        hasError = true;
      }
      if (!job.steps || !Array.isArray(job.steps)) {
        console.error(`    ❌ Job '${jobId}' missing 'steps' array`);
        hasError = true;
        continue;
      }

      // Verify 'needs' references
      if (job.needs) {
        const needsList = Array.isArray(job.needs) ? job.needs : [job.needs];
        for (const dep of needsList) {
          if (!jobNames.includes(dep)) {
            console.error(`    ❌ Job '${jobId}' depends on unknown job '${dep}'`);
            hasError = true;
          }
        }
      }

      // Check steps
      for (let i = 0; i < job.steps.length; i++) {
        const step = job.steps[i];
        if (!step.run && !step.uses) {
          console.error(`    ❌ Step ${i + 1} in '${jobId}' has neither 'run' nor 'uses'`);
          hasError = true;
        }
      }
    }

    // Specific validation rules per workflow
    if (file === "ci.yml") {
      if (!doc.jobs["ci-gate"]) {
        console.error(`  ❌ ci.yml must contain a 'ci-gate' summary job`);
        hasError = true;
      } else {
        console.log(`  ✓ CI Merge Gate job confirmed`);
      }
    }

    if (file === "build-docker.yml") {
      const buildJob = doc.jobs["build-and-scan"];
      if (!buildJob) {
        console.error(`  ❌ build-docker.yml missing 'build-and-scan' job`);
        hasError = true;
      } else {
        const hasTrivy = buildJob.steps.some(
          (s) => s.uses && s.uses.includes("trivy-action") && s.with && s.with["exit-code"] === "1",
        );
        if (!hasTrivy) {
          console.error(`  ❌ build-docker.yml must have Trivy scanner with exit-code: '1'`);
          hasError = true;
        } else {
          console.log(`  ✓ Trivy security blocking gate (exit-code: 1) confirmed`);
        }
      }
    }

    if (file === "deploy-staging.yml") {
      const preflight = doc.jobs["verify-preflight"];
      if (!preflight) {
        console.error(`  ❌ deploy-staging.yml missing 'verify-preflight' job`);
        hasError = true;
      } else {
        console.log(`  ✓ Staging security preflight gate confirmed`);
      }
    }

    console.log(`  ✓ ${file} passed all syntax and structural validations.\n`);
  }

  if (hasError) {
    console.error("Workflow validation FAILED.");
    process.exit(1);
  } else {
    console.log("================================================================");
    console.log("ALL GITHUB ACTIONS WORKFLOWS VALIDATED SUCCESSFULLY");
    console.log("================================================================");
  }
}

validateWorkflows();
