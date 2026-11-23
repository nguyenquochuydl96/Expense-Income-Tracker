import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  hashPin,
  savePinHash,
  verifyPin,
  changePin,
  hasConfiguredPin,
  getConfiguredPinLength,
  isDeviceUnlocked,
  lockDevice,
  migrateAndPurgeLegacyPlaintextPin,
  STORAGE_KEY_APP_UNLOCKED,
  STORAGE_KEY_CUSTOM_PIN_HASH,
} from '../../src/components/AppLockScreen';
import {
  DEFAULT_WEB_APP_URL,
  getStoredWebAppUrl,
  saveStoredWebAppUrl,
  getStoredWebAppKey,
  saveStoredWebAppKey,
  STORAGE_KEY_WEB_APP_URL,
  STORAGE_KEY_WEB_APP_KEY,
} from '../../src/services/appsScriptService';
import {
  saveAccessToken,
  getStoredAccessToken,
  clearStoredAccessToken,
  isStoredTokenExpired,
} from '../../src/services/authStorage';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    store,
    storage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    },
  };
}

describe('Security Hardening (Cụm 3): PIN / API_SECRET_KEY separation, RAM-only OAuth & Repo Sanitization', () => {
  let prevLocalStorage: any;
  let mem: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    prevLocalStorage = (globalThis as any).localStorage;
    mem = createMemoryStorage();
    (globalThis as any).localStorage = mem.storage;
    clearStoredAccessToken();
  });

  afterEach(() => {
    clearStoredAccessToken();
    (globalThis as any).localStorage = prevLocalStorage;
  });

  it('decouples device PIN completely from Apps Script API_SECRET_KEY', async () => {
    const strongApiKey = 'sec_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f';
    const webAppUrl = 'https://script.google.com/macros/s/EXAMPLE_DEPLOY_ID/exec';
    saveStoredWebAppUrl(webAppUrl);
    saveStoredWebAppKey(strongApiKey);

    // First-run device PIN setup (4-6 digits)
    assert.equal(hasConfiguredPin(), false);
    assert.equal(isDeviceUnlocked(), false);

    await savePinHash('2580');
    assert.equal(hasConfiguredPin(), true);
    assert.equal(getConfiguredPinLength(), 4);
    assert.equal(await verifyPin('2580'), true);
    assert.equal(await verifyPin('1234'), false);

    // API_SECRET_KEY must remain untouched by PIN setup & verification
    assert.equal(getStoredWebAppKey(), strongApiKey);

    // Changing PIN must NOT alter API_SECRET_KEY
    const changeWrong = await changePin('0000', '135790');
    assert.equal(changeWrong.success, false);

    const changeOk = await changePin('2580', '135790');
    assert.equal(changeOk.success, true);
    assert.equal(getConfiguredPinLength(), 6);
    assert.equal(await verifyPin('135790'), true);
    assert.equal(await verifyPin('2580'), false);
    assert.equal(getStoredWebAppKey(), strongApiKey);

    // Plaintext PIN key must NEVER exist in localStorage
    assert.equal(mem.store.has('heomeo_custom_pin_v1'), false);
    assert.equal(mem.store.get(STORAGE_KEY_CUSTOM_PIN_HASH), await hashPin('135790'));
  });

  it('migrates and scrubs legacy plaintext PIN key from localStorage', async () => {
    mem.store.set('heomeo_custom_pin_v1', '424242');

    await migrateAndPurgeLegacyPlaintextPin();

    assert.equal(mem.store.has('heomeo_custom_pin_v1'), false);
    assert.equal(hasConfiguredPin(), true);
    assert.equal(await verifyPin('424242'), true);
    assert.equal(await verifyPin('999999'), false);
  });

  it('keeps Google OAuth access token strictly in RAM and wipes it on lockDevice() while preserving Web App config', async () => {
    const strongApiKey = 'sec_abcdefghijklmnopqrstuvwxyz1234567890';
    const webAppUrl = 'https://script.google.com/macros/s/DEMO_DEPLOYMENT/exec';

    await savePinHash('123456');
    mem.store.set(STORAGE_KEY_APP_UNLOCKED, 'true');
    saveStoredWebAppUrl(webAppUrl);
    saveStoredWebAppKey(strongApiKey);

    // Simulate legacy OAuth keys left over in localStorage from an older app version
    mem.store.set('heomeo_google_access_token_v1', 'stale_leaked_token');
    mem.store.set('heomeo_google_token_expiry_v1', String(Date.now() + 3600_000));

    // Reading before RAM save must purge legacy localStorage keys and NOT trust localStorage
    assert.equal(getStoredAccessToken(), null);
    assert.equal(mem.store.has('heomeo_google_access_token_v1'), false);
    assert.equal(mem.store.has('heomeo_google_token_expiry_v1'), false);

    // Save OAuth token -> exists in RAM ONLY, never written to localStorage
    saveAccessToken('ya29.ram_only_token_xyz', 3500);
    assert.equal(getStoredAccessToken(), 'ya29.ram_only_token_xyz');
    assert.equal(isStoredTokenExpired(), false);
    assert.equal(mem.store.has('heomeo_google_access_token_v1'), false);
    assert.equal(mem.store.has('heomeo_google_token_expiry_v1'), false);

    // Locking the device clears RAM OAuth token & unlock flag, but keeps Web App URL + API_SECRET_KEY intact
    lockDevice();
    assert.equal(isDeviceUnlocked(), false);
    assert.equal(getStoredAccessToken(), null);
    assert.equal(isStoredTokenExpired(), true);
    assert.equal(getStoredWebAppUrl(), webAppUrl);
    assert.equal(getStoredWebAppKey(), strongApiKey);
    assert.equal(mem.store.get(STORAGE_KEY_WEB_APP_URL), webAppUrl);
    assert.equal(mem.store.get(STORAGE_KEY_WEB_APP_KEY), strongApiKey);
  });

  it('verifies public source code has zero hardcoded real URLs, Spreadsheet IDs, PIN hashes, or personal data', () => {
    const root = process.cwd();

    // 1. No hardcoded Web App deployment URL
    assert.equal(DEFAULT_WEB_APP_URL, '');
    const appsScriptServiceSrc = fs.readFileSync(path.join(root, 'src/services/appsScriptService.ts'), 'utf8');
    assert.equal(appsScriptServiceSrc.includes('AKfycb'), false);

    // 2. No hardcoded Spreadsheet ID in SheetSyncPanel
    const syncPanelSrc = fs.readFileSync(path.join(root, 'src/components/SheetSyncPanel.tsx'), 'utf8');
    assert.equal(syncPanelSrc.includes('1CTSEC-'), false);

    // 3. No DEFAULT_MASTER_PIN_HASH or PIN-to-API-key coupling in AppLockScreen
    const lockSrc = fs.readFileSync(path.join(root, 'src/components/AppLockScreen.tsx'), 'utf8');
    assert.equal(lockSrc.includes('DEFAULT_MASTER_PIN_HASH'), false);
    assert.equal(lockSrc.includes('11fbf75f3d8a'), false);
    assert.equal(lockSrc.includes('saveStoredWebAppKey'), false);

    // 4. ReconcileCheckTienView DEFAULT_WALLETS are all zeroed
    const reconcileSrc = fs.readFileSync(path.join(root, 'src/components/ReconcileCheckTienView.tsx'), 'utf8');
    assert.equal(reconcileSrc.includes('1949000'), false);
    assert.equal(reconcileSrc.includes('13954000'), false);
    assert.equal(reconcileSrc.includes('2678000'), false);

    // 5. Public CSV & seedData contain only clean synthetic demo rows (no real personal records)
    const csvContent = fs.readFileSync(
      path.join(root, 'public/assets/aistudio/Expense___Income_Tracker_1a8ce480'),
      'utf8'
    );
    assert.ok(csvContent.trim().split('\n').length <= 20, 'Demo CSV should only contain a small synthetic sample');
    assert.equal(csvContent.includes('Cho mẹ Thanh'), false);
    assert.equal(csvContent.includes('Vàng 1 chỉ'), false);

    const seedSrc = fs.readFileSync(path.join(root, 'src/utils/seedData.ts'), 'utf8');
    assert.equal(seedSrc.includes('26691000'), false);
    assert.equal(seedSrc.includes('31385000'), false);
    assert.equal(seedSrc.includes('Hoàn thuế Mèo'), false);

    // 6. authStorage never writes OAuth access token to localStorage
    const authStorageSrc = fs.readFileSync(path.join(root, 'src/services/authStorage.ts'), 'utf8');
    assert.equal(authStorageSrc.includes('localStorage.setItem'), false);
  });
});
