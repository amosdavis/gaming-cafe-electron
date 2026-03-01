# Gaming Cafe Electron Kiosk — Design Tenets

Derived from FAILURE_MODES.md. Every code change must be validated against these.

| ID   | Tenet                                                                                    |
|------|------------------------------------------------------------------------------------------|
| T-01 | **Kiosk-first**: The window runs fullscreen, frameless, single-instance. The OS desktop must never be reachable by a regular user. |
| T-02 | **Credit-before-session**: Credits are consumed atomically inside the session creation transaction. A session may only exist if credits were consumed. |
| T-03 | **One active session per user**: Before creating a session, check for an existing active session and reuse it. |
| T-04 | **Graceful scanner failure**: `scanAll()` must never throw to the UI. Catch all errors, return empty arrays, log details. |
| T-05 | **Artwork is non-blocking**: Image fetches (Steam CDN, etc.) must never block UI render. Use `<img>` with graceful fallback on error. |
| T-06 | **Admin PIN required for all privileged actions**: verifyAdmin() must be called server-side (main process) — never trust renderer-side bypass. |
| T-07 | **No sensitive data in renderer**: PINs are hashed in main process only. Renderer sends raw digits over IPC; main process hashes and compares. |
| T-08 | **Session ended on app quit**: Register `app.on('before-quit')` to end any active session and clear current user. |
| T-09 | **IPC handlers are wrapped**: Every `ipcMain.handle` must have a try/catch and return `{ ok: false, error }` on failure. |
| T-10 | **Unique constraint handled**: `createUser` catches SQLITE_CONSTRAINT and returns null — caller shows a user-friendly message. |
| T-11 | **Cafe Library resilient**: If a cafe game is no longer on disk, show the tile greyed out rather than crashing. |
| T-12 | **Window close is intercepted**: `mainWindow.on('close')` must prevent the close unless `appQuitting` is true. Platform clients stealing fullscreen must not kill the kiosk. |
| T-13 | **Minimize before platform launch**: When opening Steam/Epic/GOG, minimize the kiosk window first. Restore it when the launched process exits. |
| T-14 | **Single platform instance**: Never allow multiple platform clients to be launched simultaneously. Track `launchInProgress` state and block re-entry. |
| T-15 | **Session timer is live**: The session bar must use `setInterval` to refresh remaining time from main process. A static display is a billing trust failure. |
| T-16 | **Auto-logout on idle**: If no activity is detected for N minutes after session ends, the kiosk must return to the login screen automatically. |
| T-17 | **DB backed up on rotation**: SQLite WAL journal must be enabled. A backup copy must be written on each session end or on a scheduled interval. |
| T-18 | **Timestamps in UTC**: All session start/end times stored as UTC Unix timestamps to survive DST transitions and clock changes. |
| T-19 | **PIN rate-limited**: After 5 failed PIN attempts, the account must be locked for a cooldown period to prevent brute-force. |
| T-20 | **Log rotation enforced**: Log output must be capped (max size or rolling window) to prevent disk exhaustion on long-running kiosks. |
| T-21 | **Kiosk auto-starts on boot**: The app must be registered as a Windows startup item so a reboot does not leave the PC on a bare desktop. |
| T-22 | **Uninstalled game = greyed tile**: If a game path no longer exists at render time, show it as unavailable rather than throwing or hiding silently. |
