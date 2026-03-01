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
