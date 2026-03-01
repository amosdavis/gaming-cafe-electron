# Gaming Cafe Electron Kiosk — Failure Modes

This document is the **design authority** for the project. Every feature, tenet, and code change must be evaluated against these failures. Do not introduce code that causes any of them.

---

## Category A — Session & Billing Failures

| ID  | Failure                                          | Consequence                                           | Status |
|-----|--------------------------------------------------|-------------------------------------------------------|--------|
| F-01 | Admin PIN not set on first run                  | Anyone can access admin panel                         | Mitigated: first-run wizard |
| F-02 | User leaves without logging out                 | Next user inherits credits/session                    | Partial: no auto-logout yet |
| F-03 | Session timer not checked on game launch        | Games launched without active session                 | Mitigated: IPC checks sess |
| F-04 | Credits consumed before session confirmed saved | Credits lost on crash, no session created             | Mitigated: DB transaction   |
| F-07 | Two sessions started for same user              | Credits double-consumed                               | Mitigated: UNIQUE constraint|
| F-16 | Credits added to wrong user                     | Billing error, user frustrated                        | Mitigated: admin confirmation dialog        |
| F-21 | Clock drift between server and client PCs       | Session time expires too early or too late            | Mitigated: single-machine; main process owns all time calculations |
| F-22 | Session timer not visible / not refreshing      | User unaware time is running out, surprised by cutoff | Mitigated: App.jsx 30s setInterval + SessionBar warnings |
| F-23 | Billing records not persisted after crash       | Revenue loss, disputes with users                     | Mitigated: WAL mode; session created in transaction before credits consumed |
| F-24 | Admin overrides credits for wrong station       | Wrong user gets time, financial error                 | Mitigated: admin confirmation dialog        |

## Category B — Security & Kiosk Escape

| ID  | Failure                                          | Consequence                                           | Status |
|-----|--------------------------------------------------|-------------------------------------------------------|--------|
| F-08 | Electron window closed via Alt+F4               | Kiosk bypassed, Windows desktop exposed               | Mitigated: close intercepted|
| F-09 | Task Manager opened by user (Ctrl+Shift+Esc)    | User kills kiosk, accesses OS                         | Mitigated: kiosk mode + globalShortcut block + lockdown script |
| F-25 | Windows key or Win+D pressed                    | Desktop exposed, kiosk bypassed                       | Mitigated: kiosk mode + globalShortcut block + lockdown script |
| F-26 | Alt+Tab switches away from kiosk                | User accesses other apps                              | Mitigated: kiosk mode blocks task switching  |
| F-27 | USB device plugged in runs portable app         | User breaks out of kiosk via external executable      | Mitigated: windows-lockdown.ps1 disables USB AutoRun |
| F-28 | Reboot bypasses kiosk startup                   | OS boots to desktop before kiosk starts               | Mitigated: setLoginItemSettings + windows-lockdown.ps1 enables auto-login |
| F-29 | User creates new Windows user account           | Bypasses all restrictions                             | Mitigated: windows-lockdown.ps1 disables account creation UI |
| F-30 | DevTools console exposed (F12)                  | User runs arbitrary JS, reads DB values               | Mitigated: no openDevTools in prod |
| F-31 | Malware installed via browser or USB persists   | Kiosk compromised across sessions and reboots         | Mitigated: windows-lockdown.ps1 enforces Defender + disables USB storage |
| F-32 | Session hijacking — user guesses another PIN    | Account takeover, credit theft                        | Mitigated: 5-attempt lock, 10-min cooldown  |
| F-33 | Admin panel accessible without session check    | User opens admin via crafted IPC call                 | Mitigated: IPC auth check   |

## Category C — Platform Launcher Failures

| ID  | Failure                                          | Consequence                                           | Status |
|-----|--------------------------------------------------|-------------------------------------------------------|--------|
| F-10 | Game process inherits Electron window focus     | Electron pops to front, disrupts game                 | Mitigated: minimize on launch|
| F-13 | Epic manifest points to uninstalled path        | Game appears in list but launch fails                 | Mitigated: scanner validates installPath exists |
| F-34 | Steam relaunches itself — child exit is immediate| Kiosk restores too early while Steam is still open   | Known: Steam quirk          |
| F-35 | Platform client hangs / never exits             | Kiosk never restores — session runs out silently      | Mitigated: 4-hour watchdog timer in ipc.js  |
| F-36 | Steam Big Picture mode crashes at startup       | Black screen, kiosk stuck minimized                   | Mitigated: exit handler restores kiosk on any exit |
| F-37 | Epic Launcher requires update on launch         | Blocks into an update dialog, user cannot play        | Operational — cannot be suppressed from kiosk software |
| F-38 | GOG Galaxy not installed                        | Click shows error; handled inline                     | Mitigated: error shown      |
| F-39 | Multiple platform clients open simultaneously   | Resource exhaustion, system unresponsive              | Mitigated: platformLaunching flag blocks re-entry |
| F-40 | Platform client opens to wrong account          | User plays on cafe owner's personal account           | Operational — configure platform accounts during setup |

## Category D — Game Library & Data Failures

| ID  | Failure                                          | Consequence                                           | Status |
|-----|--------------------------------------------------|-------------------------------------------------------|--------|
| F-05 | Game scanner crashes                            | Empty game library, user confused                     | Mitigated: T-09 try/catch   |
| F-11 | SQLite DB file corrupted                        | All users/credits/sessions lost                       | Mitigated: WAL + 3-rotation backupDb() |
| F-14 | Steam AppID not found on CDN                    | Tile has no artwork                                   | Partial: fallback needed    |
| F-15 | Admin creates duplicate username                | UNIQUE constraint crash                               | Mitigated: error returned   |
| F-17 | Session not ended when Electron quits           | Orphaned active session in DB                         | Mitigated: before-quit hook |
| F-20 | Cafe Library game removed from disk             | Tile shows but launch fails                           | Mitigated: CafeLibrary checks path, greys tile |
| F-41 | Steam libraryfolders.vdf not found              | Steam library scan returns zero games                 | Partial: fallback paths     |
| F-42 | Game library not scanned unless user logged in  | Guest sees nothing, cannot browse                     | By design (tenet)           |
| F-43 | ACF file present but game partially downloaded  | Game listed but unlaunchable                          | Mitigated: scanner checks StateFlags bit 2 |
| F-44 | Artwork cached from deleted game still shows    | Stale tiles confuse users                             | Mitigated: tiles use onError fallback to no_artwork.png; no persistent cache |

## Category E — Infrastructure & Operational Failures

| ID  | Failure                                          | Consequence                                           | Status |
|-----|--------------------------------------------------|-------------------------------------------------------|--------|
| F-06 | Network loss during artwork fetch               | App hangs if fetch is synchronous                     | Mitigated: async fetch      |
| F-12 | better-sqlite3 native module ABI mismatch       | App crashes at startup                                | Mitigated: postinstall rebuild|
| F-18 | kiosk-resource:// protocol not registered       | All tile images broken                                | Mitigated: registered in main|
| F-19 | IPC handler throws unhandled exception          | Renderer gets undefined, silent failure               | Mitigated: T-09 wrapper     |
| F-45 | PC hardware too old to run modern games         | Poor experience, customers leave                      | Operational — not software  |
| F-46 | No offsite/automated DB backup                  | Single hardware failure = total data loss             | Mitigated: 30-min scheduled backup + backup on session end |
| F-47 | Kiosk software not auto-started after reboot    | PC reboots to desktop with no kiosk                  | Mitigated: setLoginItemSettings(openAtLogin:true) |
| F-48 | Multiple Electron instances from double-click   | Two kiosks fight over the screen                      | Mitigated: single-instance lock|
| F-49 | Log files grow unbounded                        | Disk fills, kiosk crashes or slows                    | Mitigated: rotating log writer (2MB cap, 3 files) |
| F-50 | Time zone change or DST transition              | Session lengths distorted                             | Mitigated: all timestamps stored as UTC ISO strings |

## Category F — Business & UX Failures

| ID  | Failure                                          | Consequence                                           | Status |
|-----|--------------------------------------------------|-------------------------------------------------------|--------|
| F-51 | Game library never updated                      | Customers stop coming; cafe loses competitive edge    | Operational                 |
| F-52 | No trending/popular games visible               | Users don't discover new titles                       | Mitigated: Featured Games section on Home + Admin featured tab |
| F-53 | Poor search/filter in Browse page               | Users can't find games; frustration                   | Mitigated: live search input in Browse.jsx |
| F-54 | No event/tournament scheduling                  | Cafe cannot run esports events                        | Future feature              |
| F-55 | No receipt or session history for users         | Disputes over time/credits with no audit trail        | Mitigated: Admin History tab with CSV export |
| F-56 | Admin can't see which PC is active remotely     | Can't manage cafe floor without walking around        | Partial: System tab shows this station; multi-PC is future feature |
| F-57 | Users share PINs                                | Credits stolen between users; no accountability       | Mitigated: session history audit trail; policy enforcement by staff |
| F-58 | No age/content restriction system               | Minors access adult-rated games                       | Mitigated: under_18 flag + age_rating + launch gate |
