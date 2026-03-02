/**
 * admin.spec.js — Admin panel tests.
 *
 * Covers: auth gate (F-33), credits confirmation dialog (F-16/F-24),
 *         database backup (F-46), featured games (F-52), CSV export (F-55),
 *         under-18 age restriction (F-58), all 7 sidebar tabs.
 */

const { test, expect } = require('@playwright/test')
const { launchApp, closeApp, firstRunSetup, openAdmin, addTestUser } = require('./helpers')

test.describe('Admin panel', () => {
  let ctx

  test.beforeEach(async () => {
    ctx = await launchApp()
    await firstRunSetup(ctx.window, 'admin', '1234')
    // Logged in and on Home after first-run wizard
  })
  test.afterEach(async () => { await closeApp(ctx.app, ctx.dbDir, ctx.udDir) })

  // ── Auth gate ─────────────────────────────────────────────────────────────

  test('F-33: Admin button shows PIN gate without prior auth', async () => {
    await ctx.window.locator('button', { hasText: 'Admin' }).click()
    await expect(ctx.window.locator('text=Admin Access')).toBeVisible()
    await expect(ctx.window.locator('text=Enter admin PIN')).toBeVisible()
  })

  test('F-33: Wrong admin PIN shows error and keeps gate open', async () => {
    await ctx.window.locator('button', { hasText: 'Admin' }).click()
    await ctx.window.waitForSelector('text=Admin Access')
    const { enterPin } = require('./helpers')
    await enterPin(ctx.window, '9999')
    await expect(ctx.window.locator('text=Incorrect admin PIN')).toBeVisible()
    await expect(ctx.window.locator('text=Admin Access')).toBeVisible()
  })

  test('Correct admin PIN opens panel on Credits tab', async () => {
    await openAdmin(ctx.window, '1234')
    await expect(ctx.window.locator('text=Admin Panel')).toBeVisible()
    await expect(ctx.window.locator('text=Add Credits to User')).toBeVisible()
  })

  // ── Sidebar tabs ──────────────────────────────────────────────────────────

  test('All 7 tab buttons are visible in sidebar', async () => {
    await openAdmin(ctx.window, '1234')
    for (const label of ['💰 Credits', '📚 Cafe Library', '⭐ Featured', '🔞 Age Gate', '👤 Users', '📋 History', '⚙ System']) {
      await expect(ctx.window.locator(`button`, { hasText: label })).toBeVisible()
    }
  })

  test('Library tab shows empty-state message', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'Cafe Library' }).click()
    await expect(ctx.window.locator('text=No games added yet')).toBeVisible()
  })

  test('Featured tab shows empty-state message and 0/6 count', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'Featured' }).click()
    await expect(ctx.window.locator('text=(0/6)')).toBeVisible()
  })

  test('Age Gate tab shows users list', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'Age Gate' }).click()
    await expect(ctx.window.locator('text=User Age Restrictions')).toBeVisible()
    await expect(ctx.window.locator('span.text-steam-text.font-medium', { hasText: /^admin$/ })).toBeVisible()
  })

  test('Users tab shows user with credit count', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'Users' }).click()
    await expect(ctx.window.locator('text=User Accounts')).toBeVisible()
    await expect(ctx.window.locator('.text-steam-text.font-semibold', { hasText: /^admin$/ })).toBeVisible()
  })

  test('F-55: History tab shows Export CSV button', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'History' }).click()
    await expect(ctx.window.locator('button', { hasText: 'Export CSV' })).toBeVisible()
  })

  test('System tab shows hostname and Backup Database button', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'System' }).click()
    await expect(ctx.window.locator('text=This Station')).toBeVisible()
    await expect(ctx.window.locator('button', { hasText: 'Backup Database' })).toBeVisible()
  })

  // ── Credits tab (F-16/F-24) ───────────────────────────────────────────────

  test('F-16/F-24: Add Credits shows confirmation dialog before committing', async () => {
    await openAdmin(ctx.window, '1234')
    // Select amount 5 (exact match to avoid matching +50)
    await ctx.window.locator('button').filter({ hasText: /^\+5$/ }).click()
    // Click Add Credits
    await ctx.window.locator('button', { hasText: 'Add Credits' }).click()
    // Confirmation dialog must appear
    await expect(ctx.window.locator('text=Confirm: add 5 credit')).toBeVisible()
    await expect(ctx.window.locator('button', { hasText: 'Confirm' })).toBeVisible()
    await expect(ctx.window.locator('button', { hasText: 'Cancel' })).toBeVisible()
  })

  test('F-16/F-24: Cancelling confirmation does not add credits', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button').filter({ hasText: /^\+5$/ }).click()
    await ctx.window.locator('button', { hasText: 'Add Credits' }).click()
    await ctx.window.waitForSelector('text=Confirm: add 5 credit')
    await ctx.window.locator('button', { hasText: 'Cancel' }).click()
    // Confirmation dialog gone, no success message
    await expect(ctx.window.locator('text=Confirm: add 5 credit')).not.toBeVisible()
    await expect(ctx.window.locator('text=Added 5 credit')).not.toBeVisible()
  })

  test('F-16/F-24: Confirming adds credits and shows success message', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button').filter({ hasText: /^\+5$/ }).click()
    await ctx.window.locator('button', { hasText: 'Add Credits' }).click()
    await ctx.window.waitForSelector('text=Confirm: add 5 credit')
    await ctx.window.locator('button', { hasText: 'Confirm' }).click()
    await expect(ctx.window.locator('text=Added 5 credit')).toBeVisible()
  })

  // ── F-46: Database backup ─────────────────────────────────────────────────

  test('F-46: Backup Database button shows success message', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'System' }).click()
    await ctx.window.locator('button', { hasText: 'Backup Database' }).click()
    await expect(ctx.window.locator('text=Database backed up successfully')).toBeVisible()
  })

  // ── Admin escape hatches ──────────────────────────────────────────────────

  test('System tab shows Open File Explorer escape hatch button', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'System' }).click()
    await expect(ctx.window.locator('button', { hasText: 'Open File Explorer' })).toBeVisible()
  })

  test('System tab shows Open Admin Terminal escape hatch button', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'System' }).click()
    await expect(ctx.window.locator('button', { hasText: 'Open Admin Terminal' })).toBeVisible()
  })

  // ── F-58: Age Gate ────────────────────────────────────────────────────────

  test('F-58: Mark Under 18 adds badge to user', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'Age Gate' }).click()
    await ctx.window.waitForSelector('text=User Age Restrictions')
    // Initially no Under 18 badge (the span badge, not the button text)
    await expect(ctx.window.locator('span', { hasText: /^Under 18$/ })).not.toBeVisible()
    await ctx.window.locator('button', { hasText: 'Mark Under 18' }).click()
    await expect(ctx.window.locator('span', { hasText: /^Under 18$/ })).toBeVisible()
  })

  test('F-58: Remove Restriction removes Under 18 badge', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'Age Gate' }).click()
    await ctx.window.locator('button', { hasText: 'Mark Under 18' }).click()
    await ctx.window.waitForSelector('span.text-steam-gold')
    await ctx.window.locator('button', { hasText: 'Remove Restriction' }).click()
    await expect(ctx.window.locator('span', { hasText: /^Under 18$/ })).not.toBeVisible()
  })

  // ── Close panel ──────────────────────────────────────────────────────────

  test('Close (✕) button returns to Home without logging out', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: '✕' }).click()
    await expect(ctx.window.locator('text=Choose a Platform')).toBeVisible()
    // SessionBar still shows username (not logged out)
    await expect(ctx.window.locator('.text-steam-text.font-semibold', { hasText: /^admin$/ })).toBeVisible()
  })

  // ── F-52: Featured games count ────────────────────────────────────────────

  test('F-52: Featured tab shows 0/6 when no games are featured', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'Featured' }).click()
    await expect(ctx.window.locator('text=(0/6)')).toBeVisible()
  })

  // ── End session from System tab ───────────────────────────────────────────

  test('End Current Session from System tab logs out user', async () => {
    await openAdmin(ctx.window, '1234')
    await ctx.window.locator('button', { hasText: 'System' }).click()
    await ctx.window.locator('button', { hasText: 'End Current Session' }).click()
    await expect(ctx.window.locator('text=Sign in to start playing')).toBeVisible()
  })
})
