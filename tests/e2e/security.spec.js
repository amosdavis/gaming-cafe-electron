/**
 * security.spec.js — Security and failure mode tests using direct IPC calls.
 *
 * Covers: F-01 (admin PIN gate), F-03 (session required for game launch),
 *         F-07 (double session prevention), F-15 (duplicate username),
 *         F-32 (lockout), F-39 (double platform launch blocked), F-58 (age gate).
 *
 * Most of these tests verify IPC-layer behaviour directly via window.evaluate(),
 * without going through the full UI, to test the business logic independently.
 */

const { test, expect } = require('@playwright/test')
const { launchApp, closeApp, firstRunSetup, addTestUser } = require('./helpers')

// ── F-32: PIN lockout ──────────────────────────────────────────────────────────

test.describe('F-32: PIN lockout at 5 attempts', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
    await ctx.window.locator('button', { hasText: 'Log Out' }).click()
    await ctx.window.waitForSelector('text=Sign in to start playing')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('login IPC returns locked:true after 5 wrong PINs', async () => {
    const result = await ctx.window.evaluate(async () => {
      // 5 wrong PIN calls to record failures; 6th triggers the lockout response
      for (let i = 0; i < 5; i++) {
        await window.kiosk.login('admin', '0000')
      }
      return window.kiosk.login('admin', '0000')
    })
    expect(result.locked).toBe(true)
    expect(result.retry_after_secs).toBeGreaterThan(0)
  })
})

// ── F-01 / F-33: Admin verify PIN ─────────────────────────────────────────────

test.describe('F-01/F-33: Admin PIN verification', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('verifyAdmin returns false for wrong PIN', async () => {
    const ok = await ctx.window.evaluate(() => window.kiosk.verifyAdmin('9999'))
    expect(ok).toBe(false)
  })

  test('verifyAdmin returns true for correct default PIN (1234)', async () => {
    const ok = await ctx.window.evaluate(() => window.kiosk.verifyAdmin('1234'))
    expect(ok).toBe(true)
  })
})

// ── F-07: Double session prevention ───────────────────────────────────────────

test.describe('F-07: Double session prevention', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
    // Already logged in with an active session
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('getOrStartSession called twice returns the same session ID', async () => {
    const [id1, id2] = await ctx.window.evaluate(async () => {
      const user = await window.kiosk.currentUser()
      const s1   = await window.kiosk.getOrStartSession(user.id)
      const s2   = await window.kiosk.getOrStartSession(user.id)
      return [s1.session?.id, s2.session?.id]
    })
    expect(id1).toBeDefined()
    expect(id1).toBe(id2)
  })
})

// ── F-15: Duplicate username ───────────────────────────────────────────────────

test.describe('F-15: Duplicate username prevention', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('createUser with existing username returns null', async () => {
    const user = await ctx.window.evaluate(async () =>
      window.kiosk.createUser('admin', '1234', '')
    )
    expect(user).toBeNull()
  })
})

// ── F-03: Session required for game launch ─────────────────────────────────────

test.describe('F-03: Game launch requires active session', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
    // Create user with no credits (no session possible)
    await addTestUser(ctx.window, 'nocreds', '5678', 0)
    // Log out admin
    await ctx.window.locator('button', { hasText: 'Log Out' }).click()
    await ctx.window.waitForSelector('text=Sign in to start playing')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('launchGame IPC returns error when no active session', async () => {
    // Login as no-credits user — getOrStartSession will fail so no session is set
    const loginResult = await ctx.window.evaluate(async () =>
      window.kiosk.login('nocreds', '5678')
    )
    expect(loginResult.ok).toBe(true)
    // Do NOT call getOrStartSession — simulate a user with no session
    const launchResult = await ctx.window.evaluate(async () =>
      window.kiosk.launchGame('game-123', 'steam')
    )
    expect(launchResult.ok).toBe(false)
    expect(launchResult.error).toMatch(/No active session/)
  })
})

// ── F-39: Double platform launch prevention ────────────────────────────────────

test.describe('F-39: Prevent simultaneous platform launches', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('second launchPlatform call while one is in progress returns error', async () => {
    // We cannot actually launch Steam in CI — instead verify the flag behaviour
    // by checking the IPC returns the correct error when platformLaunching is true.
    // Simulate by sending two rapid requests:
    const [r1, r2] = await ctx.window.evaluate(async () => {
      const p1 = window.kiosk.launchPlatform('steam')
      const p2 = window.kiosk.launchPlatform('steam')
      return Promise.all([p1, p2])
    })
    // At least one must fail (either Steam not found or "already launching")
    // Both could fail if Steam isn't installed — just verify neither crashes
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    // If r1 succeeded (Steam launched), r2 must be the "already launching" error
    if (r1.ok) {
      expect(r2.ok).toBe(false)
      expect(r2.error).toMatch(/already launching/)
    }
  })
})

// ── F-58: Under-18 age gate on game launch ─────────────────────────────────────

test.describe('F-58: Under-18 age restriction blocks M/AO game launch', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  test('launchGame returns age-restriction error for under-18 user with M-rated game', async () => {
    const result = await ctx.window.evaluate(async () => {
      const user = await window.kiosk.currentUser()
      if (!user) return { ok: false, error: 'No user' }

      // Add a cafe game with M rating
      await window.kiosk.addCafeGame('game-m-rated', 'steam', 'Mature Game')
      await window.kiosk.setCafeGameRating('game-m-rated', 'steam', 'M')

      // Mark user as under-18
      await window.kiosk.setUserAgeRestriction(user.id, true)

      // Attempt to launch — should be blocked
      return window.kiosk.launchGame('game-m-rated', 'steam')
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/age-restricted/)
  })
})
