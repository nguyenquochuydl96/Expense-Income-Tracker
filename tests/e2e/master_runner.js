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
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Test Suite Catalog Definitions
const SUITE_GROUPS = [
  {
    groupId: 'CORE-E2E',
    groupName: 'Core E2E Suite (Tiers 1–4)',
    suites: [
      {
        id: 'Tier 1',
        name: 'Feature Coverage (>=5 per feature)',
        file: 'tier1_features.test.js',
        expectedCount: 45,
      },
      {
        id: 'Tier 2',
        name: 'Boundary & Corner Cases (>=5 per category)',
        file: 'tier2_boundaries.test.js',
        expectedCount: 30,
      },
      {
        id: 'Tier 3',
        name: 'Cross-Feature Combinations (Pairwise)',
        file: 'tier3_cross_feature.test.js',
        expectedCount: 15,
      },
      {
        id: 'Tier 4',
        name: 'Real-World Living Scenarios (Workloads)',
        file: 'tier4_real_world.test.js',
        expectedCount: 5,
      },
    ],
  },
  {
    groupId: 'M2-PERF',
    groupName: 'Milestone 2: Performance, Cache & Bundle Optimization',
    suites: [
      {
        id: 'M2-Perf',
        name: 'Performance, Caching & Memoization',
        file: 'milestone2_performance.test.js',
        expectedCount: 7,
      },
    ],
  },
  {
    groupId: 'M3-UIUX',
    groupName: 'Milestone 3: UI/UX Polish, Themes & Accessibility',
    suites: [
      {
        id: 'M3-UIUX',
        name: 'Theme Tokens, Contrast, Mobile Safe Areas & A11y',
        file: 'milestone3_ui_ux.test.js',
        expectedCount: 15,
      },
    ],
  },
  {
    groupId: 'CHALLENGER-ADV',
    groupName: 'Tier 5: Adversarial Hardening & Stress Verification',
    suites: [
      {
        id: 'CH-Visual',
        name: 'Challenger Theme & Visual Stress Suite',
        file: 'challenger_m3_theme_visual.js',
        expectedCount: 11,
      },
      {
        id: 'CH-Viewport',
        name: 'Challenger Viewport & Accessibility Stress Suite',
        file: 'challenger_m3_stress.js',
        expectedCount: 17,
      },
      {
        id: 'CH-M1-Acct',
        name: 'Challenger M1 Accounting & Runway Verification',
        file: 'challenger_m1_verification.js',
        expectedCount: 14,
      },
      {
        id: 'CH-Stress',
        name: 'Challenger Date Boundary Fuzzing & Row Realignment',
        file: 'challenger_stress.test.js',
        expectedCount: 19,
      },
      {
        id: 'CH-M4-Stress',
        name: 'Challenger M4 60-Month & Row Realignment Fuzzing',
        file: 'challenger_m4_master_stress.js',
        expectedCount: 12,
      },
      {
        id: 'CH-M4-Adv',
        name: 'Challenger M4 Boundary & Adversarial Suite',
        file: 'challenger_m4_adversarial.js',
        expectedCount: 37,
      },
    ],
  },
];

async function main() {
  const masterStartTime = Date.now();

  console.log(`\n${c.bold}${c.cyan}========================================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}   EXPENSE & INCOME TRACKER — MASTER E2E & ADVERSARIAL VALIDATION RUNNER (ALL TIERS)   ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================================${c.reset}\n`);

  // 1. Ensure dist directory and CommonJS package.json exist
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  const distPkgPath = resolve(distDir, 'package.json');
  if (!existsSync(distPkgPath)) {
    writeFileSync(distPkgPath, JSON.stringify({ type: 'commonjs' }, null, 2));
  }

  // 2. Compile all test files via TypeScript
  console.log(`${c.dim}Compiling full test suite with TypeScript (tsc -p tests/tsconfig.json)...${c.reset}`);
  const tscStart = Date.now();
  try {
    execSync('npx tsc -p tests/tsconfig.json', {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    const tscDuration = Date.now() - tscStart;
    console.log(`${c.green}✓ TypeScript compilation successful (${tscDuration}ms).${c.reset}\n`);
  } catch (err) {
    console.error(`${c.red}✗ Compilation error:${c.reset}`, err.stdout ? err.stdout.toString() : err.message);
    process.exit(1);
  }

  // 3. Load test harness
  const harnessPath = resolve(distDir, 'tests/e2e/testHarness.js');
  const { registry } = require(harnessPath);

  // 4. Sequential execution by Suite Group
  let grandTotalTests = 0;
  let grandTotalPassed = 0;
  let grandTotalFailed = 0;
  const failureDetails = [];
  const groupResults = [];

  for (const group of SUITE_GROUPS) {
    console.log(`${c.bold}${c.magenta}▶ ${group.groupName}${c.reset}`);
    const groupStart = Date.now();
    let groupTests = 0;
    let groupPassed = 0;
    let groupFailed = 0;

    const suiteRows = [];

    for (const suiteDef of group.suites) {
      const suiteFilePath = resolve(distDir, 'tests/e2e', suiteDef.file);
      if (!existsSync(suiteFilePath)) {
        console.error(`${c.red}Error: Test file not found: ${suiteFilePath}${c.reset}`);
        process.exit(1);
      }

      // Clear registry before loading this specific file to isolate metrics
      registry.clear();
      require(suiteFilePath);

      const suiteStart = Date.now();
      const summaries = await registry.runSuites();
      const suiteDuration = Date.now() - suiteStart;

      let fileTests = 0;
      let filePassed = 0;
      let fileFailed = 0;

      for (const summary of summaries) {
        const isSuiteAllPass = summary.failed === 0;
        const suiteIcon = isSuiteAllPass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
        console.log(`  ${suiteIcon} ${c.bold}${summary.suiteName}${c.reset} ${c.dim}(${summary.total} tests, ${summary.durationMs}ms)${c.reset}`);

        for (const res of summary.results) {
          fileTests++;
          groupTests++;
          grandTotalTests++;

          if (res.passed) {
            filePassed++;
            groupPassed++;
            grandTotalPassed++;
            console.log(`      ${c.green}✓${c.reset} ${c.dim}${res.testName}${c.reset} ${c.gray}(${res.durationMs}ms)${c.reset}`);
          } else {
            fileFailed++;
            groupFailed++;
            grandTotalFailed++;
            console.log(`      ${c.red}✗ ${res.testName}${c.reset} ${c.gray}(${res.durationMs}ms)${c.reset}`);
            failureDetails.push(res);
          }
        }
      }

      suiteRows.push({
        id: suiteDef.id,
        name: suiteDef.name,
        total: fileTests,
        passed: filePassed,
        failed: fileFailed,
        durationMs: suiteDuration,
        status: fileFailed === 0 ? 'PASS' : 'FAIL',
      });
    }

    const groupDuration = Date.now() - groupStart;
    groupResults.push({
      groupId: group.groupId,
      groupName: group.groupName,
      total: groupTests,
      passed: groupPassed,
      failed: groupFailed,
      durationMs: groupDuration,
      suites: suiteRows,
    });

    console.log('');
  }

  const masterDuration = Date.now() - masterStartTime;

  // 5. Print Failures if any
  if (failureDetails.length > 0) {
    console.log(`\n${c.bold}${c.red}========================================================================================${c.reset}`);
    console.log(`${c.bold}${c.red}   FAILURE DETAILS (${failureDetails.length})   ${c.reset}`);
    console.log(`${c.bold}${c.red}========================================================================================${c.reset}\n`);

    for (let i = 0; i < failureDetails.length; i++) {
      const f = failureDetails[i];
      console.log(`${c.red}[${i + 1}] ${f.suiteName} > ${f.testName}${c.reset}`);
      console.log(`${c.yellow}${f.error?.stack || f.error?.message || f.error}${c.reset}\n`);
    }
  }

  // 6. Print Executive Summary Table
  console.log(`${c.bold}${c.cyan}========================================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}   MASTER E2E & ADVERSARIAL VALIDATION SUMMARY TABLE   ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================================${c.reset}`);
  console.log(`${c.bold}| Suite / Tier | Category / Scope                         | Total | Pass | Fail | Pass Rate | Time   | Status |${c.reset}`);
  console.log(`|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|`);

  for (const group of groupResults) {
    for (const s of group.suites) {
      const idPad = s.id.padEnd(12, ' ');
      const namePad = (s.name.length > 40 ? s.name.substring(0, 37) + '...' : s.name).padEnd(40, ' ');
      const totalPad = String(s.total).padStart(5, ' ');
      const passPad = String(s.passed).padStart(4, ' ');
      const failPad = String(s.failed).padStart(4, ' ');
      const rateStr = ((s.passed / (s.total || 1)) * 100).toFixed(1) + '%';
      const ratePad = rateStr.padStart(9, ' ');
      const timeStr = `${s.durationMs}ms`.padStart(6, ' ');
      const statusStr = s.failed === 0 ? `${c.green}PASS${c.reset}  ` : `${c.red}FAIL${c.reset}  `;

      console.log(`| ${idPad} | ${namePad} | ${totalPad} | ${passPad} | ${failPad} | ${ratePad} | ${timeStr} | ${statusStr} |`);
    }
    console.log(`|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|`);
  }

  const grandRate = ((grandTotalPassed / (grandTotalTests || 1)) * 100).toFixed(1) + '%';
  const totalStatus =
    grandTotalFailed === 0
      ? `${c.green}${c.bold}ALL PASSED (100%)${c.reset}`
      : `${c.red}${c.bold}FAILURES DETECTED${c.reset}`;

  console.log(`\n${c.bold}Total Test Suites:${c.reset} ${groupResults.reduce((acc, g) => acc + g.suites.length, 0)} files across ${groupResults.length} milestone tracks`);
  console.log(`${c.bold}Total Test Cases:${c.reset}  ${c.bold}${grandTotalTests}${c.reset}`);
  console.log(`${c.bold}Passed:${c.reset}            ${c.green}${c.bold}${grandTotalPassed}${c.reset}`);
  console.log(`${c.bold}Failed:${c.reset}            ${grandTotalFailed > 0 ? c.red : c.green}${grandTotalFailed}${c.reset}`);
  console.log(`${c.bold}Pass Rate:${c.reset}          ${c.bold}${grandRate}${c.reset}`);
  console.log(`${c.bold}Total Execution:${c.reset}   ${masterDuration} ms`);
  console.log(`${c.bold}Final Gate Result:${c.reset} ${totalStatus}\n`);

  if (grandTotalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${c.red}Master Runner fatal error:${c.reset}`, err);
  process.exit(1);
});
