#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const testsDir = resolve(projectRoot, 'tests');
const distDir = resolve(testsDir, 'dist');
const require = createRequire(import.meta.url);

// Terminal color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

async function main() {
  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}   EXPENSE & INCOME TRACKER — E2E TEST SUITE RUNNER (TIERS 1–4)   ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);

  // 1. Ensure dist directory and CommonJS package.json exist
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  const distPkgPath = resolve(distDir, 'package.json');
  if (!existsSync(distPkgPath)) {
    writeFileSync(distPkgPath, JSON.stringify({ type: 'commonjs' }, null, 2));
  }

  // 2. Compile tests via TypeScript
  console.log(`${c.dim}Compiling tests with TypeScript (tsc -p tests/tsconfig.json)...${c.reset}`);
  try {
    execSync('npx tsc -p tests/tsconfig.json', {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    console.log(`${c.green}✓ TypeScript compilation successful.${c.reset}\n`);
  } catch (err) {
    console.error(`${c.red}✗ Compilation error:${c.reset}`, err.stdout ? err.stdout.toString() : err.message);
    process.exit(1);
  }

  // 3. Load test harness
  const harnessPath = resolve(distDir, 'tests/e2e/testHarness.js');
  const { registry } = require(harnessPath);

  // 4. Load test tier modules
  const tiers = [
    { id: 'Tier 1', name: 'Feature Coverage (>=5 per feature)', file: 'tier1_features.test.js' },
    { id: 'Tier 2', name: 'Boundary & Corner Cases (>=5 per category)', file: 'tier2_boundaries.test.js' },
    { id: 'Tier 3', name: 'Cross-Feature Combinations (Pairwise)', file: 'tier3_cross_feature.test.js' },
    { id: 'Tier 4', name: 'Real-World Living Scenarios (>=5 workloads)', file: 'tier4_real_world.test.js' },
  ];

  for (const tier of tiers) {
    const tierPath = resolve(distDir, 'tests/e2e', tier.file);
    if (!existsSync(tierPath)) {
      console.error(`${c.red}Error: Test file not found: ${tierPath}${c.reset}`);
      process.exit(1);
    }
    require(tierPath);
  }

  // 5. Execute all registered suites
  const startTime = Date.now();
  const summaries = await registry.runSuites();
  const totalDuration = Date.now() - startTime;

  // 6. Print detailed test results
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const failureDetails = [];

  for (const summary of summaries) {
    const isSuiteAllPass = summary.failed === 0;
    const suiteIcon = isSuiteAllPass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    console.log(`${suiteIcon} ${c.bold}${summary.suiteName}${c.reset} ${c.dim}(${summary.total} tests, ${summary.durationMs}ms)${c.reset}`);

    for (const res of summary.results) {
      totalTests++;
      if (res.passed) {
        totalPassed++;
        console.log(`    ${c.green}✓${c.reset} ${c.dim}${res.testName}${c.reset} ${c.gray}(${res.durationMs}ms)${c.reset}`);
      } else {
        totalFailed++;
        console.log(`    ${c.red}✗ ${res.testName}${c.reset} ${c.gray}(${res.durationMs}ms)${c.reset}`);
        failureDetails.push(res);
      }
    }
    console.log('');
  }

  // 7. Print Failures if any
  if (failureDetails.length > 0) {
    console.log(`\n${c.bold}${c.red}========================================================================${c.reset}`);
    console.log(`${c.bold}${c.red}   FAILURE DETAILS (${failureDetails.length})   ${c.reset}`);
    console.log(`${c.bold}${c.red}========================================================================${c.reset}\n`);

    for (let i = 0; i < failureDetails.length; i++) {
      const f = failureDetails[i];
      console.log(`${c.red}[${i + 1}] ${f.suiteName} > ${f.testName}${c.reset}`);
      console.log(`${c.yellow}${f.error?.stack || f.error?.message || f.error}${c.reset}\n`);
    }
  }

  // 8. Print Executive Summary Table
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}   TEST EXECUTION SUMMARY TABLE   ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}`);

  // Calculate breakdown per Tier
  const tierCounts = {
    'Tier 1': { total: 0, passed: 0, failed: 0 },
    'Tier 2': { total: 0, passed: 0, failed: 0 },
    'Tier 3': { total: 0, passed: 0, failed: 0 },
    'Tier 4': { total: 0, passed: 0, failed: 0 },
  };

  for (const summary of summaries) {
    for (const key of Object.keys(tierCounts)) {
      if (summary.suiteName.startsWith(key)) {
        tierCounts[key].total += summary.total;
        tierCounts[key].passed += summary.passed;
        tierCounts[key].failed += summary.failed;
      }
    }
  }

  console.log(`${c.bold}| Tier   | Category                                  | Total | Passed | Failed | Status |${c.reset}`);
  console.log(`|--------|-------------------------------------------|-------|--------|--------|--------|`);
  for (const tier of tiers) {
    const counts = tierCounts[tier.id];
    const status = counts.failed === 0 ? `${c.green}PASS${c.reset}` : `${c.red}FAIL${c.reset}`;
    const namePadded = tier.name.padEnd(41, ' ');
    const totalPadded = String(counts.total).padStart(5, ' ');
    const passPadded = String(counts.passed).padStart(6, ' ');
    const failPadded = String(counts.failed).padStart(6, ' ');
    console.log(`| ${tier.id.padEnd(6, ' ')} | ${namePadded} | ${totalPadded} | ${passPadded} | ${failPadded} | ${status}   |`);
  }
  console.log(`|--------|-------------------------------------------|-------|--------|--------|--------|`);

  const totalStatus = totalFailed === 0 ? `${c.green}${c.bold}ALL PASSED${c.reset}` : `${c.red}${c.bold}FAILED${c.reset}`;
  console.log(`\n${c.bold}Total Tests:${c.reset} ${totalTests}`);
  console.log(`${c.bold}Passed:${c.reset}     ${c.green}${totalPassed}${c.reset}`);
  console.log(`${c.bold}Failed:${c.reset}     ${totalFailed > 0 ? c.red : c.green}${totalFailed}${c.reset}`);
  console.log(`${c.bold}Duration:${c.reset}   ${totalDuration} ms`);
  console.log(`${c.bold}Result:${c.reset}     ${totalStatus}\n`);

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${c.red}Runner fatal error:${c.reset}`, err);
  process.exit(1);
});
