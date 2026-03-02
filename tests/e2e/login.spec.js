/**
 * login.spec.js — Login, logout, first-run wizard, and PIN entry tests.
 *
 * Covers: first-run setup, normal login/logout, wrong PIN, keyboard PIN,
 *         no-credits error (F-03), PIN lockout (F-32).
 */

const { test, expect } = require('@playwright/test')
const {
  launchApp,
  closeApp,
  firstRunSetup,
  loginAs,
  enterPin,
  enterPinKeyboard,
  addTestUser,
  clickPinKey,
} = require('./helpers')

// ── First-run setup ────────────────────────────────────────────────────────────

test.describe('First-run setup', () => {
  let ctx
  test.beforeEach(async () => { ctx = await launchApp() })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('shows first-run banner when no users exist', async () => {
    await expect(ctx.window.locator('text=First-time setup')).toBeVisible()
    await expect(ctx.window.locator('text=No accounts found')).toBeVisible()
  })

  test('creates first admin account and auto-logs in to Home', async () => {
    await firstRunSetup(ctx.window, 'admin', '1234')
    // Home page must be visible
    await expect(ctx.window.locator('text=Choose a Platform')).toBeVisible()
  })
})

// ── Normal login ───────────────────────────────────────────────────────────────

test.describe('Normal login', () => {
  let ctx
  test.beforeEach(async () => {
    ctx = await launchApp()
    // Create first user via UI wizard (gets 10 welcome credits)
    await firstRunSetup(ctx.window, 'admin', '1234')
    // Logout so we are back on the Login page
    await ctx.window.locator('button', { hasText: 'Log Out' }).click()
    await ctx.window.waitForSelector('text=Sign in to start playing')
    // startSession consumes all credits, so replenish for the next login
    await ctx.window.evaluate(async () => {
      const users = await window.kiosk.listUsers()
      const u = users.find(x => x.username === 'admin')
      if (u) await window.kiosk.addCredits(u.id, 10, 'Test setup')
    })
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('logs in with correct username and PIN via mouse', async () => {
    await loginAs(ctx.window, 'admin', '1234')
    await expect(ctx.window.locator('text=Choose a Platform')).toBeVisible()
  })

  test('shows error on wrong PIN', async () => {
    await ctx.window.locator('input[placeholder="Username"]').fill('admin')
    await ctx.window.locator('button', { hasText: 'Continue' }).click()
    await enterPin(ctx.window, '9999')
    await expect(ctx.window.locator('text=Incorrect username or PIN')).toBeVisible()
  })

  test('stays on PIN screen after wrong PIN', async () => {
    await ctx.window.locator('input[placeholder="Username"]').fill('admin')
    await ctx.window.locator('button', { hasText: 'Continue' }).click()
    await enterPin(ctx.window, '9999')
    // PIN screen still visible (PinPad buttons still present)
    await expect(ctx.window.locator('button.pin-btn').first()).toBeVisible()
  })

  test('enters PIN via keyboard digits + Enter', async () => {
    await ctx.window.locator('input[placeholder="Username"]').fill('admin')
    await ctx.window.locator('button', { hasText: 'Continue' }).click()
    await ctx.window.waitForSelector('button.pin-btn')
    await enterPinKeyboard(ctx.window, '1234')
    await expect(ctx.window.locator('text=Choose a Platform')).toBeVisible()
  })

  test('Backspace via keyboard removes last digit', async () => {
    await ctx.window.locator('input[placeholder="Username"]').fill('admin')
    await ctx.window.locator('button', { hasText: 'Continue' }).click()
    await ctx.window.waitForSelector('button.pin-btn')
    // Type all 4 digits, backspace the last, retype it, then submit
    await ctx.window.keyboard.type('1234')
    await ctx.window.keyboard.press('Backspace')
    await ctx.window.keyboard.type('4')
    await ctx.window.keyboard.press('Enter')
    await expect(ctx.window.locator('text=Choose a Platform')).toBeVisible()
  })
})

// ── Logout ─────────────────────────────────────────────────────────────────────

test.describe('Logout', () => {
  let ctx
  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('Logout button returns to Login page', async () => {
    await ctx.window.locator('button', { hasText: 'Log Out' }).click()
    await expect(ctx.window.locator('text=Sign in to start playing')).toBeVisible()
  })
})

// ── F-03: No credits ───────────────────────────────────────────────────────────

test.describe('F-03: Login with no credits', () => {
  let ctx
  test.beforeEach(async () => {
    ctx = await launchApp()
    // Create admin user via first-run (gets 10 credits)
    await firstRunSetup(ctx.window, 'admin', '1234')
    // Create a second user with 0 credits via IPC
    await addTestUser(ctx.window, 'broke', '9999', 0)
    // Logout
    await ctx.window.locator('button', { hasText: 'Log Out' }).click()
    await ctx.window.waitForSelector('text=Sign in to start playing')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('shows "No credits" error when user has 0 credits', async () => {
    await ctx.window.locator('input[placeholder="Username"]').fill('broke')
    await ctx.window.locator('button', { hasText: 'Continue' }).click()
    await enterPin(ctx.window, '9999')
    await expect(ctx.window.locator('text=No credits available')).toBeVisible()
  })
})

// ── F-32: PIN lockout ──────────────────────────────────────────────────────────

test.describe('F-32: PIN lockout after 5 failed attempts', () => {
  let ctx
  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
    await ctx.window.locator('button', { hasText: 'Log Out' }).click()
    await ctx.window.waitForSelector('text=Sign in to start playing')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('locks account after 5 wrong PINs and shows cooldown message', async () => {
    // Enter username once, then enter wrong PIN 6 times:
    // attempts 1-5 record failures; attempt 6 triggers the lockout response
    await ctx.window.locator('input[placeholder="Username"]').fill('admin')
    await ctx.window.locator('button', { hasText: 'Continue' }).click()
    await ctx.window.waitForSelector('button.pin-btn')
    for (let i = 0; i < 6; i++) {
      await enterPin(ctx.window, '0000')
    }
    await expect(
      ctx.window.locator('text=Too many failed attempts')
    ).toBeVisible()
  })
})
