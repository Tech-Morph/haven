# HAven — Project Context for AI Assistants

## Project Purpose

HAven is a **lightweight, fixed-canvas Home Assistant dashboard** designed for low-end and legacy screens — old iPads, Amazon Fire HD tablets, Android tablets, smart TVs — devices that Lovelace either doesn't support or performs poorly on.

The entire runtime is a **single vanilla ES5 JavaScript file** (`app.js`). There is no build process, no bundler, no package manager, no module system. This is a deliberate, non-negotiable architectural choice to maximise browser compatibility back to Android 4.4 WebView / iOS 8 / IE11 (circa 2014).

HAven connects to Home Assistant via WebSocket and renders a pixel-perfect fixed-size canvas that CSS-scales to fit any screen. Everything is config-driven via JSON files — no runtime code changes are needed to build or modify a dashboard.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime JS | **Vanilla ES5** | `var`, `function`, `prototype`, `XMLHttpRequest` only |
| Styling | **Plain CSS** (`style.css`, ~39 KB) | No preprocessor, no CSS-in-JS |
| Icons | **MDI** (`fonts/materialdesignicons.css`) | Fully bundled, offline-capable |
| HA connection | **Native WebSocket** + `XMLHttpRequest` | No `fetch`, no Promises |
| Designer | **Konva.js** + ES6+ | Chrome/Edge 86+ required; separate from runtime |
| Config | **JSON** files in `devices/` | One file per physical screen |
| Version | `1.0.7-beta` (stamped in `index.html`) | Used as cache-bust query string |

---

## Entry Point & Boot Sequence

**Entry point: `index.html`**

1. Inlines `var HAVEN_VERSION = '1.0.7-beta'` for cache busting.
2. Dynamically injects `style.css?v=...` and `fonts/materialdesignicons.css` via a self-executing IIFE.
3. A second IIFE reads `?device=` from the URL query string (defaults to `"default"`) — this selects which `devices/<name>.json` to load.
4. Appends `app.js?v=...` to `<body>` as the last step; `app.js` takes full control from there.

**`app.js` boot sequence (`init()`):**
1. Checks for designer preview override (`window.HAVEN_OVERRIDE_CONFIG`).
2. Reads `haven_url` and `haven_token` from `localStorage`.
3. Calls `loadConfigForCredentials()` — fetches `devices/<name>.json` via XHR to check for embedded credentials (`ha_url`, `ha_token` fields).
4. Config token always wins over `localStorage`; if neither exists, shows the setup overlay.
5. `applyConfig()` → `setupCanvas()` → `renderPage0()` → `renderPage(startPage)` → `connectWebSocket()` → `startClock()`.

---

## Sessions & Authentication

- **No server-side sessions.** HAven is a static client-side app.
- Credentials are stored in **`localStorage`** under two keys:
  - `haven_url` — Home Assistant base URL (e.g. `http://homeassistant.local:8123`)
  - `haven_token` — Long-lived access token
- A device JSON file **may** embed `ha_url` and `ha_token` directly under `device:` — this always overrides `localStorage` and is synced back into it on load.
- **Never store tokens in device JSON files in production** — use `localStorage` only. The embedded-token path exists for managed/kiosk deployments where the config is served from a controlled location.
- The WebSocket auth flow uses HA's standard `auth_required` → `auth` → `auth_ok` handshake. The flag `wsAuthenticated` gates all subscriptions.
- The setup overlay (`#setup-overlay`) is shown when no token is found anywhere. On save it does a hard `window.location.reload()`.

---

## Directory Structure

```
haven/
├── app.js              ← ENTIRE RUNTIME. All widget logic, WS handling,
│                         override engine, template evaluator, event bus.
│                         ~7,000 lines, vanilla ES5 only.
├── index.html          ← Thin HTML shell. Boots app.js. Rarely modified.
├── style.css           ← All dashboard + widget styles, animations,
│                         canvas scaling. ~39 KB.
├── designer.html       ← Visual drag-and-drop editor. Self-contained,
│                         ~41 KB. Konva.js + ES6+. Chrome/Edge 86+ only.
│                         Uses File System Access API to save-to-disk.
├── designer/           ← Supporting assets for designer.html
│                         (libs, scripts). ES6+ is fine here.
├── devices/            ← Per-device JSON config files. One file per
│                         physical screen (e.g. devices/kitchen.json).
│                         devices/default.json loads when no ?device= param.
├── themes/             ← Drop-in CSS overrides (scanlines, glow, fonts).
│                         Loaded additively on top of style.css.
│                         Applied via config.theme.style = "scanlines" etc.
├── fonts/              ← Bundled MDI icon font. Critical for offline use.
│                         Do not remove or rename.
├── docs/               ← Markdown documentation for widgets and features.
├── images/             ← Static assets (logo, etc). Not runtime-critical.
└── .github/            ← GitHub Actions / issue templates.
```

---

## Naming Conventions

Follow these patterns exactly when adding code to `app.js`:

### Functions
- **`verbNoun`** camelCase: `renderLabel`, `updateArc`, `buildWidgetDOM`, `applyTemplate`
- Render functions: `renderWidgetType(el, w)` — pure DOM creation, no state
- Update functions: `updateWidgetTypeFromState(el, w, state, state2)` — surgical DOM update
- Internal helpers: `getThresholdColor`, `resolveColor`, `formatValue`, `applyTemplate`

### Variables
- Global state uses short descriptive `var`: `config`, `currentPage`, `ws`, `entityStates`, `entityCallbacks`
- Widget state cached on closure variables, not on DOM attributes: `var stateCache = null`
- Boolean flags: `wsAuthenticated`, `screensaverActive`, `animationPauseBound`

### Section Headers
Section headers in `app.js` use this exact format:
```js
// ===== SECTION NAME =====
```
Sub-sections use:
```js
// -- Widget Name --
```

### CSS Classes
- Widget containers: `widget-<type>` (e.g. `widget-label`, `widget-arc`)
- Widget internals: `widget-<type>-<part>` (e.g. `widget-bar-fill`, `widget-slider-thumb`)
- State classes on widgets: `switch-on`, `switch-off`, `switch-unknown`
- Animation classes: `widget-anim-active`, `widget-anim-pulse`, `widget-anim-blink`
- Page nav: `page-dot`, `page-dot active`

### DOM IDs
- Canvas wrapper: `canvas-wrapper` → `canvas`
- Page 0 persistent overlay: `page0-overlay`
- Widget elements: `w-<widget.id>` (e.g. `w-42`)
- Setup overlay: `setup-overlay`, `setup-url`, `setup-token`, `setup-save`
- Connection status: `conn-status`
- Page nav dots: `page-nav`

### JSON Config Keys
- Snake_case throughout: `font_size`, `icon_color`, `value_attribute`, `start_angle`
- New properties must be **optional with sensible defaults** — never break existing configs
- Boolean flags default to `false` unless "opt-in" makes no sense

---

## Hard Constraints

### 1. ES5 Only in `app.js` and All Runtime Code
The following are **banned** in `app.js`:
- `const`, `let`
- Arrow functions `() => {}`
- Template literals `` `${}` ``
- `class` syntax
- Spread `...`, destructuring `{ a, b } = obj`
- `Promise`, `async`/`await`
- `fetch()`
- `import`/`export`
- `Array.from`, `Object.assign`, `Symbol`, `Map`, `Set`, `WeakMap`

Use instead: `var`, `function`, `prototype`, `XMLHttpRequest`, `for` loops, `Array.prototype.forEach.call`.

The designer (`designer.html`, `designer/`) **may** use modern JS freely — Chrome 86+ is required there.

### 2. Zero Dependencies in Runtime
No CDN links, no npm packages, no external scripts in `app.js` or `index.html` runtime path. Everything must be self-contained and work fully offline.

### 3. Single-File Runtime
All runtime logic lives in `app.js`. Do not split it into modules or add new runtime JS files.

### 4. Surgical DOM Updates Only
On a single entity state change, only update the specific DOM nodes bound to that entity. Never call `renderPage()` or reconstruct the canvas in response to a state change. Entity callbacks are registered via `registerEntityCallback(entityId, fn)`.

### 5. Backward-Compatible JSON Config
All new widget properties must be optional with documented defaults. Existing `devices/*.json` files must load and render correctly without any changes. Never rename or remove existing config keys.

### 6. Credentials Never in Git
Device JSON files should not contain real `ha_token` values in commits. Document any credential-related changes carefully.

### 7. No Function Declarations Inside Blocks
In ES5 strict mode, `function` declarations inside `if`/`for` blocks are illegal. Use `var fn = function() {}` instead:
```js
// WRONG (illegal in strict ES5)
if (condition) { function doThing() {} }

// CORRECT
var doThing = function() {};
if (condition) { doThing(); }
```

---

## Widget Development Checklist

When adding a new widget type to `app.js`:

1. Add the type string to the `switch` in `renderWidget()`
2. Implement `renderWidgetType(el, w)` — pure DOM creation
3. Implement `updateWidgetTypeFromState(el, w, state, state2)` — surgical update
4. Register interval-based logic via `activePageTimers.push({ id: timerId })`
5. Call `registerEntityCallback(w.entity, fn)` for entity subscriptions
6. Support `resolveOverrides(w, state, state2)` for conditional property changes
7. Support `applyTemplate(text, state, state2)` for `{{ }}` expressions in text fields
8. Document the JSON schema in `docs/widgets/<widget-name>.md`
9. Add a sample to `devices/example.json`
10. Add designer support in `designer.html` (ES6+ is fine there)
11. Test at 4x CPU throttle in Chrome DevTools (simulates Fire HD / old iPad)

---

## Current Widget Types (17)

`label`, `button`, `switch`, `slider`, `bar`, `arc`, `rectangle` (alias: `rect`),
`image`, `camera`, `clock`, `scene`, `history_chart`, `agenda`, `tasks` (alias: `task`),
`line`, `iframe`, `thermostat`, `weather_forecast`

---

## Internal Entities

These pseudo-entity IDs are used internally for reactive overrides and templates:

| ID | Value |
|---|---|
| `internal.connectionstatus` | `connected` / `disconnected` |
| `internal.currentdtm` | ISO 8601 datetime, updated every minute |
| `internal.currentpage` | Current page ID as string |

---

## Key Global Variables in `app.js`

```js
config            // Parsed device JSON config object
currentPage       // Active page ID (number)
ws                // Native WebSocket instance
wsAuthenticated   // true after auth_ok received
haUrl             // HA base URL (from localStorage or config)
haToken           // HA long-lived token (from localStorage or config)
entityStates      // { entityId: stateObject } — cached HA states
entityCallbacks   // { entityId: [fn, ...] } — callbacks for current page
page0Callbacks    // { entityId: [fn, ...] } — persistent (page 0)
pendingRequests   // { msgId: callback } — in-flight WS requests
activePageTimers  // [{ id: intervalId, stop: fn }] — cleared on page change
havenDeviceId     // ?device= URL param value, used to filter haven_command events
```

---

## haven_command Event Bus

HA automations can control the dashboard by firing a `haven_command` event:

```yaml
event_type: haven_command
event_data:
  device_id: kitchen   # matches ?device= URL param
  command: navigate
  page: 2
```

Built-in commands: `navigate`, `wake`, `dim`, `speak`.
New commands are added to the WebSocket message handler in `app.js`.

---

## Roadmap Items (Implement These First)

1. **Flow dots widget** — animated dots along a path for energy/power flow visuals
2. **Multi-action buttons** — `actions` array with optional `delay` per entry; backward compatible with single `action`
3. **Actions on image widgets** — add `action` support (currently only `fullscreen_on_tap`)
4. **Conditional actions** — `"type": "conditional"` picks service call based on entity state; enables toggle behavior without knowing current state

---

## Override & Template System

**Conditional overrides** — any widget property can change based on entity state:
```json
"overrides": [
  {
    "when": { "conditions": [{ "entity": "switch.fan", "state": "on" }] },
    "set": { "color": "primary", "icon": "mdi:fan" }
  }
]
```

**Template expressions** — `{{ }}` in `text`, `label`, and `color` fields:
```json
"text": "{{ state }}°C",
"color": "{{ state | float > 30 ? 'danger' : 'text' }}"
```

Both resolved via `resolveOverrides(w, state, state2)` and `applyTemplate(text, state, state2)`.
