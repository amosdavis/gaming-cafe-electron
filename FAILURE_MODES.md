# Gaming Cafe Electron Kiosk — Failure Modes

| ID  | Failure                                          | Consequence                                           |
|-----|--------------------------------------------------|-------------------------------------------------------|
| F-01 | Admin PIN not set on first run                  | Anyone can access admin panel                          |
| F-02 | User leaves without logging out                 | Next user inherits credits/session                    |
| F-03 | Session timer not checked on game launch        | Games launched without active session                 |
| F-04 | Credits consumed before session confirmed saved | Credits lost on crash, no session created             |
| F-05 | Game scanner crashes                            | Empty game library shown, user confused                |
| F-06 | Network loss during artwork fetch               | App hangs or crashes if artwork fetch is synchronous  |
| F-07 | Two sessions started for same user              | Credits double-consumed                               |
| F-08 | Electron window closed via Alt+F4               | Kiosk bypassed, Windows desktop exposed               |
| F-09 | Task Manager opened by user                     | User kills kiosk, accesses OS                         |
| F-10 | Game process inherits Electron window focus     | Electron may come back to front, disrupting game      |
| F-11 | SQLite DB file corrupted                        | All users/credits/sessions lost                       |
| F-12 | better-sqlite3 native module missing on target  | App crashes at startup                                |
| F-13 | Epic manifest points to uninstalled path        | Game appears in list but launch fails                 |
| F-14 | Steam AppID not found on CDN                    | Artwork request returns 404, tile has no image        |
| F-15 | Admin creates duplicate username                | UNIQUE constraint error, uncaught crash               |
| F-16 | Credits added to wrong user                     | Billing error, user frustrated                        |
| F-17 | Session not ended when Electron quits           | DB left with orphaned active session                  |
| F-18 | kiosk-resource:// protocol not registered       | All tile images broken at startup                     |
| F-19 | IPC handler throws unhandled exception          | Renderer gets undefined, silent failure               |
| F-20 | Cafe Library game removed from disk             | Tile shows but launch fails                            |
