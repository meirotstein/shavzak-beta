# Shavzak Beta App Findings

## Purpose

This repository contains a mobile-first, RTL Hebrew web app for managing military company manpower through a Google Spreadsheet. The app reads spreadsheet data, visualizes daily presence by soldier/category, and writes operational updates back to the sheet.

The current app should remain available as a fallback while a new modern app is built beside it and published to GitHub Pages.

## Current Architecture

- The app is plain vanilla HTML/CSS/JavaScript.
- The main browser app lives under `public/`.
- `public/index.html` loads `g-api.js`, `utils.js`, `sheetlogic.js`, and `uilogic.js` directly as globals.
- `server.js` is only a local Express static server for `public/`; the app itself does not require a backend.
- GitHub Pages is served from the `gh-pages` branch.
- The new app should live beside the old app under `/app`, while the old `/public` app remains available as fallback.
- `index.html` at the repo root only contains `test`, so the active published app likely comes from the `gh-pages` branch rather than this working tree's root page.
- `public/frame.html` is a local iframe wrapper for testing compact embedded mode.

## Google Integration

The app is client-only, which is a major strength for GitHub Pages:

- No server holds Google credentials.
- Users authenticate directly in the browser.
- Sheet reads/writes happen from the browser against Google APIs.
- The spreadsheet id is read from `?spid=...` and stored in `localStorage` under `spreadsheet--id`.

Current implementation details:

- `public/g-api.js` uses a hardcoded Google API key and OAuth client id.
- Scopes are:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.metadata.readonly`
- Google APIs loaded:
  - Sheets API v4
  - Drive API v3
- Authentication currently uses `gapi.load('client:auth2')` and `gapi.auth2`.
- Drive metadata is used to fetch spreadsheet title and infer read-only mode by checking the signed-in user's Drive permissions.

Important modernization note:

- The client-only login model should be preserved.
- The deprecated part is not "client-only auth"; it is the old `gapi.auth2` / Google Sign-In JavaScript flow.
- Google now directs web apps to Google Identity Services (GIS). Official docs say `gapi.auth2` is deprecated and replaced by Google Identity Services:
  - https://google.github.io/google-api-javascript-client/docs/auth.html
  - https://developers.google.com/identity/oauth2/web/guides/migration-to-gis
  - https://developers.google.com/identity/sign-in/web/deprecation-and-sunset

Recommended new auth shape:

- Keep static hosting.
- Use Google Identity Services token client for OAuth access tokens.
- Keep `gapi.client` or use direct `fetch` calls to Sheets/Drive with the GIS access token.
- Request the same Sheets and Drive metadata scopes, ideally incrementally and only when needed.

## Spreadsheet Contract

The code expects these sheet tabs:

- `נוכחות` - main presence grid.
- `משימות` - mission/category staffing requirements.
- `חיילים` - soldier profile/details and comments.
- `settings` - dynamic layout settings.

The `settings` sheet controls layout instead of hardcoding all rows/columns:

- Presence settings are read from column B.
- Mission settings are read from column D.
- Soldier settings are read from column F.
- The app reads the first 40 rows and 6 columns from `settings`.

Derived settings include:

- Presence soldier-name start column, start row, and row count.
- Category summary start row and row count.
- Date period from `נוכחות!B1:B2`.
- Mission job/category count columns from `משימות`.
- Soldier profile row count from `חיילים`.

Presence values:

- Empty string: no status.
- `1`: present.
- `0`: home / vacation.
- `2`: sick.
- `3`: arrangement / preparation.

The current UI cycles a selected soldier/day through:

- `1 -> 0 -> 2 -> 1`
- If the existing value is `3`, the next tap converts it to `1`.
- Right-click on desktop, or long press on mobile, clears the value.
- The current code has special iOS touch handling, so the rewrite should explicitly support long press across mobile browsers instead of treating it as iOS-only behavior.

## Main User Flows

1. Sign in with Google.
2. Enter or load a spreadsheet id.
3. App reads spreadsheet metadata, settings, presence data, mission counts, category totals, and soldier profiles.
4. User searches/selects a soldier by name.
5. Calendar shows the selected soldier's presence statuses across the configured period.
6. User taps days to change presence values.
7. App writes the changed cell back to the spreadsheet.
8. App updates local category totals optimistically after save.
9. User can edit a soldier comment.
10. User can open soldier details.
11. User can open daily presence view grouped by platoon.
12. User can share daily presence summary to WhatsApp.

## UI Behavior To Preserve

- RTL Hebrew interface.
- Mobile-first large touch targets.
- Search-first soldier selection.
- Calendar grouped into weeks and paged by month.
- Today is visually highlighted.
- Category selector changes day count display.
- Counts below mission requirement are marked red.
- Read-only mode hides/blocks editing interactions.
- Daily presence modal groups people by platoon and status.
- WhatsApp share creates a formatted Hebrew daily report.
- Compact iframe mode via `.in-iframe` class reduces font sizes and hides some controls, but this is not required for the first phase of the rewrite.

## Key Implementation Observations

- `utils.js` creates a browser-side `SpreadsheetApp` facade. This lets legacy Apps Script-like code in `sheetlogic.js` run in the browser.
- `Action.run` mimics the old `google.script.run.withSuccessHandler(...)` callback style.
- This is a useful migration clue: the new app should separate spreadsheet access from UI state, but can keep the same conceptual data service.
- The code stores state in globals: `data`, `SETTINGS`, `METADATA`, `dates`, `dayEls`, `categories`, `selectedSoldier`, etc.
- UI is built with direct DOM mutation and inline event handlers.
- Several values are parsed from display strings, especially soldier description strings containing category and platoon.
- The soldier description format is currently guaranteed by the spreadsheet: `חיילים!E` is calculated from the actual soldier fields and reflected in `נוכחות` column B.
- The actual soldier source fields are `חיילים!A:D`: id, full name, platoon, and role. Column E is the calculated description used by the presence sheet.

## Risks And Bugs To Address In The Rewrite

- Deprecated auth: `gapi.auth2` should be replaced with Google Identity Services.
- Global mutable state makes reloads, retries, stale selections, and partial failures hard to reason about.
- `SpreadsheetApp.getRange(row, col, row_l, col_l)` has off-by-one behavior when converting ranges. For a width of `col_l`, the end column should likely be `col + col_l - 1`, not `col + col_l`.
- `setPresenceData` and `setCommentData` call `getRange` with missing `col_l` or `row_l`, which can create malformed A1 ranges in the browser adapter.
- `loadData()` appends into global `data` without resetting it, so multiple loads in one page lifetime can duplicate records.
- `String.prototype.getTime` is patched globally. This should become an explicit date parser.
- `showSoldierDetails()` uses `typeof p !== undefined`, which is always true because `typeof` returns a string. It should compare to `'undefined'`.
- Daily presence parsing assumes every soldier description matches `/^(.*?)\s*\[.*?\]\s*(.*)$/`; malformed names can crash the modal.
- UI writes via `innerHTML` with spreadsheet-sourced names. A modern app should render text safely rather than injecting HTML strings.
- WhatsApp text is manually percent-encoded only for newlines. Use `encodeURIComponent` for the full message.
- Error handling is broad: most failures become "no access or file does not exist."
- The app appears to update category totals locally after a save, but it does not re-fetch formulas/totals from the sheet.
- Read-only permission detection depends on Drive permissions visibility and direct user email matching, which may not handle groups/domain sharing cleanly.
- Public API key and OAuth client id are hardcoded. This is normal for browser OAuth but should be documented and restricted to approved origins/referrers in Google Cloud Console.

## Suggested Modern Rewrite Direction

Recommended structure:

- Build a new static app beside the old one, for example `modern/` or `app/`.
- Use `/app` as the new app subpath.
- Keep the old `public/` app untouched as fallback.
- Use a modern frontend stack that can emit static files for GitHub Pages, such as Vite + React + TypeScript.
- Keep all Google access client-side using GIS.
- Create a typed spreadsheet data layer:
  - `GoogleAuthService`
  - `SheetsClient`
  - `SpreadsheetRepository`
  - `PresenceModel`
  - `SoldierModel`
- Normalize spreadsheet values into typed domain objects before rendering.
- Keep the spreadsheet schema compatible at first; do not require sheet migration for the first release.
- Add feature-flag or route-based fallback links to the old app.
- Treat presence categories as fixed for the first rewrite: empty, `0`, `1`, `2`, and `3`.
- Preserve current read-only behavior, including the existing direct-user Drive permission check behavior.
- Preserve the current local category-total adjustment after writes. The sheet remains the source of truth for summarized category values, but the UI avoids immediate refetching after each action.

First implementation milestones:

1. Static modern shell deployable to GitHub Pages.
2. GIS login and token handling.
3. Spreadsheet id input, URL param support, and local storage persistence.
4. Read-only metadata/title detection.
5. Load and validate the four existing tabs.
6. Soldier search and calendar read-only visualization.
7. Presence write flow.
8. Comment edit flow.
9. Daily presence modal and WhatsApp share.
10. Polish mobile UX and iframe/compact mode if still needed.

## Open Questions

- None blocking for phase one based on current clarifications.

Resolved decisions:

- GitHub Pages source is `gh-pages`.
- New app should be in this repo under `/app`, not `/public`.
- Iframe mode is not needed in the first phase.
- Presence categories are fixed for now.
- Category summary values are calculated in the spreadsheet and locally adjusted by the app after actions to avoid refetching.
- Soldier descriptions are guaranteed today because they are calculated in `חיילים!E` from `חיילים!A:D` and reflected in `נוכחות!B`.
- Preserve existing read-only/edit permission behavior.
