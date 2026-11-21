#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const distDir = resolve(projectRoot, 'tests/dist');
const require = createRequire(import.meta.url);

async function runChallengerVerification() {
  console.log('\n========================================================================');
  console.log('   EMPIRICAL CHALLENGER: MILESTONE 1 STRESS VERIFICATION RUNNER');
  console.log('========================================================================\n');

  console.log('Compiling tests with TypeScript...');
  execSync('npx tsc -p tests/tsconfig.json', { cwd: projectRoot, stdio: 'inherit' });
  console.log('✓ Compilation complete.\n');

  const { registry } = require(resolve(distDir, 'tests/e2e/testHarness.js'));
  require(resolve(distDir, 'tests/e2e/challenger_m1_verification.js'));
  require(resolve(distDir, 'tests/e2e/challenger_m3_stress.js'));

  const summaries = await registry.runSuites();
  let totalPassed = 0;
  let totalFailed = 0;

  for (const s of summaries) {
    const icon = s.failed === 0 ? '✓' : '✗';
    console.log(`${icon} ${s.suiteName} (${s.passed}/${s.total} passed, ${s.durationMs}ms)`);
    for (const r of s.results) {
      if (r.passed) {
        totalPassed++;
        console.log(`    ✓ ${r.testName} (${r.durationMs}ms)`);
      } else {
        totalFailed++;
        console.log(`    ✗ ${r.testName} - Error: ${r.error?.message}`);
      }
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`Total Challenger Tests: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Result: ${totalFailed === 0 ? 'ALL CHALLENGE TESTS EXECUTED' : 'FAILURES OCCURRED'}`);
  console.log('========================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runChallengerVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
