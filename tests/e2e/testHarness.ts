import assert from 'node:assert';

export interface TestCaseResult {
  suiteName: string;
  testName: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface SuiteSummary {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}

type TestFn = () => void | Promise<void>;

interface RegisteredTestCase {
  name: string;
  fn: TestFn;
}

interface RegisteredSuite {
  name: string;
  tests: RegisteredTestCase[];
}

class TestRegistry {
  private suites: RegisteredSuite[] = [];
  private currentSuite: RegisteredSuite | null = null;

  describe(name: string, fn: () => void): void {
    const suite: RegisteredSuite = { name, tests: [] };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = prevSuite;
    }
  }

  test(name: string, fn: TestFn): void {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {
        this.currentSuite!.tests.push({ name, fn });
      });
    } else {
      this.currentSuite.tests.push({ name, fn });
    }
  }

  clear(): void {
    this.suites = [];
    this.currentSuite = null;
  }

  async runSuites(): Promise<SuiteSummary[]> {
    const summaries: SuiteSummary[] = [];

    for (const suite of this.suites) {
      const suiteStart = Date.now();
      const results: TestCaseResult[] = [];
      let passedCount = 0;
      let failedCount = 0;

      for (const t of suite.tests) {
        const testStart = Date.now();
        try {
          await t.fn();
          const durationMs = Date.now() - testStart;
          passedCount++;
          results.push({
            suiteName: suite.name,
            testName: t.name,
            passed: true,
            durationMs,
          });
        } catch (err: any) {
          const durationMs = Date.now() - testStart;
          failedCount++;
          results.push({
            suiteName: suite.name,
            testName: t.name,
            passed: false,
            durationMs,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }

      summaries.push({
        suiteName: suite.name,
        total: suite.tests.length,
        passed: passedCount,
        failed: failedCount,
        durationMs: Date.now() - suiteStart,
        results,
      });
    }

    return summaries;
  }
}

export const registry = new TestRegistry();

export const describe = (name: string, fn: () => void) => registry.describe(name, fn);
export const test = (name: string, fn: TestFn) => registry.test(name, fn);
export const it = test;

export function expect(actual: any) {
  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected, `Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
    },
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected, `Expected deep equality between ${JSON.stringify(actual)} and ${JSON.stringify(expected)}`);
    },
    toBeCloseTo(expected: number, delta: number = 0.001) {
      assert.ok(
        Math.abs(actual - expected) <= delta,
        `Expected ${actual} to be close to ${expected} within delta ${delta}`
      );
    },
    toBeGreaterThan(expected: number) {
      assert.ok(actual > expected, `Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert.ok(actual >= expected, `Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected: number) {
      assert.ok(actual < expected, `Expected ${actual} < ${expected}`);
    },
    toBeLessThanOrEqual(expected: number) {
      assert.ok(actual <= expected, `Expected ${actual} <= ${expected}`);
    },
    toBeDefined() {
      assert.ok(actual !== undefined, `Expected actual to be defined`);
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined, `Expected actual to be undefined`);
    },
    toBeNull() {
      assert.strictEqual(actual, null, `Expected actual to be null`);
    },
    toBeTruthy() {
      assert.ok(!!actual, `Expected ${actual} to be truthy`);
    },
    toBeFalsy() {
      assert.ok(!actual, `Expected ${actual} to be falsy`);
    },
    toContain(item: any) {
      if (typeof actual === 'string') {
        assert.ok(actual.includes(item), `Expected string "${actual}" to contain "${item}"`);
      } else if (Array.isArray(actual)) {
        assert.ok(actual.includes(item), `Expected array to contain item`);
      } else if (actual && typeof actual === 'object') {
        assert.ok(item in actual, `Expected object to contain property "${item}"`);
      } else {
        throw new Error(`toContain cannot be used on type ${typeof actual}`);
      }
    },
    toThrow(expectedMsgOrRegex?: string | RegExp) {
      if (typeof actual !== 'function') {
        throw new Error(`expect(fn).toThrow requires actual to be a function`);
      }
      let threw = false;
      let caughtError: any = null;
      try {
        actual();
      } catch (e) {
        threw = true;
        caughtError = e;
      }
      assert.ok(threw, `Expected function to throw an error, but it did not.`);
      if (expectedMsgOrRegex) {
        const msg = caughtError?.message || String(caughtError);
        if (typeof expectedMsgOrRegex === 'string') {
          assert.ok(
            msg.includes(expectedMsgOrRegex),
            `Expected thrown error message "${msg}" to contain "${expectedMsgOrRegex}"`
          );
        } else if (expectedMsgOrRegex instanceof RegExp) {
          assert.ok(
            expectedMsgOrRegex.test(msg),
            `Expected thrown error message "${msg}" to match regex ${expectedMsgOrRegex}`
          );
        }
      }
    },
  };
}
