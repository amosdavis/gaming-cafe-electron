/**
 * Shared test helpers for Playwright + Electron E2E tests.
 *
 * Every test should call launchApp() and closeApp() in beforeEach/afterEach.
 * The app is launched with a fresh temporary database and kiosk mode disabled
 * so that the window can be interacted with normally.
 */

const { _electron: electron } = require('@playwright/test')
const path = require('path')
const fs   = require('fs')
const os   = require('os')

const MAIN_JS = path.join(__dirname, '../../out/main/index.js')

/**
 * Launch the Electron kiosk app in test mode.
 * Returns { app, window, dbDir } — caller must call closeApp(app, dbDir) when done.
 */
async function launchApp() {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-test-'))
  const udDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-ud-'))
  const app = await electron.launch({
    args: [MAIN_JS, '--no-sandbox', '--disable-gpu', `--user-data-dir=${udDir}`],
    env: {
      ...process.env,
      KIOSK_E2E_TEST:    '1',
      KIOSK_TEST_DB_DIR: dbDir,
      DISPLAY:           process.env.DISPLAY || ':0',
    },
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  return { app, window, dbDir, udDir }
}

/**
 * Close the app and remove the temp database directory.
 */
async function closeApp(app, dbDir, udDir) {
  try { await app.close() } catch { /* ignore */ }
  try { fs.rmSync(dbDir, { recursive: true, force: true }) } catch { /* ignore */ }
  if (udDir) try { fs.rmSync(udDir, { recursive: true, force: true }) } catch { /* ignore */ }
}

/**
 * Complete a first-run setup for the given username + pin, then wait for Home.
 * Use this only when the DB is fresh (no existing users).
 */
async function firstRunSetup(window, username, pin) {
  // Type username
  const usernameInput = window.locator('input[placeholder="Admin username"]')
  await usernameInput.fill(username)
  await window.locator('button', { hasText: 'Set PIN' }).click()

  // Enter PIN on PinPad
  await enterPin(window, pin)

  // Confirm PIN
  await enterPin(window, pin)

  // Wait for Home page (SessionBar shows username in the session bar)
  await window.waitForSelector('text=Choose a Platform')
}

/**
 * Log in as an existing user via the normal login flow.
 * Waits for the Home page (SessionBar) to be visible.
 */
async function loginAs(window, username, pin) {
  const usernameInput = window.locator('input[placeholder="Username"]')
  await usernameInput.fill(username)
  await window.locator('button', { hasText: 'Continue' }).click()
  await enterPin(window, pin)
  await window.waitForSelector('text=Choose a Platform')
}

/**
 * Click a single key on the PinPad by exact text match.
 */
async function clickPinKey(window, key) {
  // Escape regex special chars (✓, ⌫ are safe but be explicit)
  await window.locator('button.pin-btn').filter({ hasText: new RegExp(`^${key}$`) }).click()
}

/**
 * Enter a PIN on the PinPad (clicking the digit buttons), then click ✓.
 */
async function enterPin(window, pin) {
  for (const digit of pin) {
    await clickPinKey(window, digit)
  }
  await clickPinKey(window, '✓')
}

/**
 * Enter a PIN on the PinPad using keyboard input.
 */
async function enterPinKeyboard(window, pin) {
  for (const digit of pin) {
    await window.keyboard.press(digit)
  }
  await window.keyboard.press('Enter')
}

/**
 * Open the Admin panel from the Home page and authenticate.
 * Waits for the panel content to be visible.
 */
async function openAdmin(window, adminPin = '1234') {
  await window.locator('button', { hasText: 'Admin' }).click()
  await window.waitForSelector('text=Admin Access')
  await enterPin(window, adminPin)
  await window.waitForSelector('text=Admin Panel')
}

/**
 * Create a user and add credits directly via the kiosk IPC API exposed on window.
 * Requires the app to already be at a page where window.kiosk is available.
 */
async function addTestUser(window, username, pin, credits = 0) {
  return window.evaluate(
    async ({ username, pin, credits }) => {
      const user = await window.kiosk.createUser(username, pin, '')
      if (user && credits > 0) {
        await window.kiosk.addCredits(user.id, credits, 'Test setup')
      }
      return user
    },
    { username, pin, credits }
  )
}

module.exports = {
  launchApp,
  closeApp,
  firstRunSetup,
  loginAs,
  enterPin,
  enterPinKeyboard,
  clickPinKey,
  openAdmin,
  addTestUser,
}
