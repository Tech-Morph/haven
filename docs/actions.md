# Actions

Tappable widgets support an `action` property that fires when the widget is tapped. The following widget types support actions: `button`, `rectangle`, `slider`, `switch`, `image`, and `camera`.

```json
"action": { "type": "navigate", "page": 2 }
```

---

## Contents

- [Navigate to a Page](#navigate-to-a-page)
- [Trigger an Automation](#trigger-an-automation)
- [Call a Service](#call-a-service)
- [Value Tokens](#value-tokens)
- [Template Expressions in Data](#template-expressions-in-data)
- [haven_command Events](#haven_command-events)

---

## Navigate to a Page

Navigate directly to a page by ID:

```json
"action": { "type": "navigate", "page": 2 }
```

Or navigate relative to the current page:

```json
"action": { "type": "navigate", "direction": "next" }
"action": { "type": "navigate", "direction": "prev" }
"action": { "type": "navigate", "direction": "home" }
```

| Field | Description |
|-------|-------------|
| `page` | Target page ID. Takes priority over `direction` if both are set. |
| `direction` | `next`, `prev`, or `home`. `home` navigates to the first non-overlay page. At the first or last page, `prev` and `next` do nothing. |

---

## Trigger an Automation

```json
"action": { "type": "automation", "entity_id": "automation.good_night" }
```

---

## Call a Service

```json
"action": { "type": "service", "service": "light.turn_on", "entity_id": "light.kitchen" }
```

With optional service data:

```json
"action": {
  "type": "service",
  "service": "light.turn_on",
  "entity_id": "light.kitchen",
  "data": { "brightness": 128, "color_temp": 350 }
}
```

| Field | Description |
|-------|-------------|
| `service` | HA service in `domain.service` format. |
| `entity_id` | Target entity. Can be a single ID or an array of IDs. |
| `data` | Optional map of additional service parameters. |

---

## Value Tokens

Certain widgets support special tokens in `action.data` that are replaced with live values at call time.

### `$value` (slider)

For `slider` widgets, `"$value"` in `action.data` is replaced with the current slider position when the action fires:

```json
{
  "type": "slider",
  "entity": "media_player.living_room",
  "value_attribute": "volume_level",
  "min": 0, "max": 1, "step": 0.01,
  "action": {
    "type": "service",
    "service": "media_player.volume_set",
    "entity_id": "media_player.living_room",
    "data": { "volume_level": "$value" }
  }
}
```

### `$on_value`, `$off_value`, `$is_on` (switch)

For `switch` widgets using a custom action, these tokens are available in `action.data`:

| Token | Value |
|-------|-------|
| `$on_value` | The configured `on_value` |
| `$off_value` | The configured `off_value` |
| `$is_on` | `"true"` or `"false"` based on the state after the tap |

### `$option` (scene)

For `scene` widgets, `"$option"` in `action.data` is replaced with the selected option value:

```json
{
  "type": "scene",
  "entity": "media_player.kitchen_sonos",
  "value_attribute": "repeat",
  "options": [
    { "value": "off", "label": "Off" },
    { "value": "all", "label": "All" },
    { "value": "one", "label": "One" }
  ],
  "action": {
    "type": "service",
    "service": "media_player.repeat_set",
    "entity_id": "media_player.kitchen_sonos",
    "data": { "repeat": "$option" }
  }
}
```

---

## Template Expressions in Data

For `button` widgets with an `entity` set, `action.data` values can contain `{{ expr }}` template expressions. These are evaluated against the widget's entity state at the moment the button is tapped.

This is useful for computed adjustments like incrementing a thermostat setpoint or a media player volume.

```json
{
  "type": "button",
  "label": "+1",
  "entity": "climate.living_room",
  "action": {
    "type": "service",
    "service": "climate.set_temperature",
    "entity_id": "climate.living_room",
    "data": { "temperature": "{{ attr.temperature + 1 }}" }
  }
}
```

A value that is a single `{{ expr }}` expression returns a typed result, so numbers are sent to HA as numbers (not strings).

### Available variables

| Variable | Value |
|----------|-------|
| `state` | Entity state value. Numeric when the state string parses as a number, otherwise a string. |
| `state_str` | Entity state as a string, always. |
| `attr.x` | Attribute `x` from the entity (e.g. `attr.temperature`, `attr.brightness`). |
| `round(x, n)` | Round `x` to `n` decimal places. |
| `min(a, b)` / `max(a, b)` | Clamp helpers. |
| `abs(x)` / `floor(x)` / `ceil(x)` | Math helpers. |

### Important notes

These are JavaScript expressions, not Jinja2. Do not use pipe filters like `state | float` - they are not supported. `state` is already numeric when the entity state value is a number.

For `climate` entities, `state` is the HVAC mode string (e.g. `"heat"`), not the temperature. Use `attr.temperature` to read the current setpoint:

```json
"data": { "temperature": "{{ attr.temperature - 1 }}" }
```

Thermostat +/- button pair example:

```json
{ "label": "-1", "entity": "climate.living_room",
  "action": { "type": "service", "service": "climate.set_temperature",
               "entity_id": "climate.living_room",
               "data": { "temperature": "{{ attr.temperature - 1 }}" } } }

{ "label": "+1", "entity": "climate.living_room",
  "action": { "type": "service", "service": "climate.set_temperature",
               "entity_id": "climate.living_room",
               "data": { "temperature": "{{ attr.temperature + 1 }}" } } }
```

---

## haven_command Events

HAven listens for `haven_command` events fired from Home Assistant. These let HA automations control the dashboard remotely without any user interaction on the device.

Fire the event from HA using the `events/fire` service or an automation action:

```yaml
service: events/fire
target: {}
data:
  event_type: haven_command
  event_data:
    command: navigate
    page: 3
```

### Supported commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `navigate` | `page` (integer) | Navigate to the specified page ID. |
| `wake` | (none) | Dismiss the screensaver if active. |
| `dim` | (none) | Activate the screensaver immediately. |
| `speak` | `message` (string) | Speak text aloud using the Web Speech API (device must support it and have audio output). |
