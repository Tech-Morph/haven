# Widget: line

The line widget draws a styled path between two or more points on the canvas. Its primary use is energy flow diagrams, where animated dots or comets travel along the line to show the direction and magnitude of power flowing between components. Lines are not constrained to a bounding box: their coordinates are absolute canvas positions, so a single line widget can span freely across the full dashboard canvas.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Path Geometry](#path-geometry)
- [Animation](#animation)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A static dividing line:

```json
{
  "id": "divider",
  "type": "line",
  "start_x": 20,  "start_y": 200,
  "end_x":   700, "end_y": 200,
  "color": "surface2",
  "thickness": 2
}
```

An animated energy flow line:

```json
{
  "id": "solar_to_home",
  "type": "line",
  "start_x": 200, "start_y": 300,
  "end_x":   500, "end_y": 300,
  "color": "surface2",
  "thickness": 3,
  "effect": "dot",
  "dot_color": "primary",
  "entity": "sensor.solar_power",
  "animate_min_value": 100,
  "animate_max_value": 5000
}
```

---

## Properties

### Path

| Property | Description |
|----------|-------------|
| `start_x` | X coordinate of the line start point (canvas pixels). |
| `start_y` | Y coordinate of the line start point (canvas pixels). |
| `end_x` | X coordinate of the line end point (canvas pixels). |
| `end_y` | Y coordinate of the line end point (canvas pixels). |
| `waypoints` | Array of `{x, y}` objects defining intermediate points. Optional. |
| `radius` | Corner rounding radius in pixels at each waypoint bend. `0` = sharp corners. Default: `0`. |

### Track

| Property | Description |
|----------|-------------|
| `color` | Track line color as a theme token or hex value. Default: `surface2`. |
| `thickness` | Track stroke width in pixels. Default: `2`. |
| `arrow` | Arrowhead style: `none`, `end`, `start`, or `both`. Default: `none`. |
| `inactive_opacity` | Track opacity when the entity value is zero or the entity is unavailable. Default: `0.25`. |

### Animation

| Property | Description |
|----------|-------------|
| `effect` | Animation style: `none`, `dot`, `comet_short`, `comet_medium`, `comet_long`. Default: `dot` when an `entity` is set, otherwise `none`. |
| `entity` | HA entity ID driving animation speed and direction. Positive values = forward, negative values = reverse. |
| `entity2` | Optional second HA entity. Does not affect animation speed or direction. Use with `source: "state2"` or `source: "attribute2"` in override conditions to drive color or other appearance from a separate entity. |
| `dot_size` | Diameter of the moving element in pixels. Applies to all effect types. Default: `6`. |
| `dot_length` | Length of the dash along the path. `1` = round circle. Values above `1` give a pill or dash shape. Default: `1`. |
| `dot_spacing` | Gap between successive dots/dashes in pixels. A smaller value means more elements visible at once. Default: `30`. |
| `dot_color` | Color of the moving element as a theme token or hex value. Falls back to `color` if not set. |
| `animate_min_value` | Entity value below which the animation stops. Default: `100`. |
| `animate_max_value` | Entity value at which the animation reaches full speed. Default: `5000`. |
| `animate_min_rate` | Animation speed in pixels per second at `animate_min_value`. Default: `10`. Fractional values (e.g. `2.5`) are supported for very slow animation. |
| `animate_max_rate` | Animation speed in pixels per second at `animate_max_value`. Default: `60`. |

Speed scales linearly between `animate_min_rate` and `animate_max_rate`: half the value range gives half the speed, so the mapping is exactly predictable. Speed is in pixels per second and is independent of line length, so dots on lines of different lengths move at the same visual velocity.

### Overrides

| Property | Description |
|----------|-------------|
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Path Geometry

A line is defined by a start point, an end point, and optional waypoints in between:

```json
{
  "start_x": 100, "start_y": 400,
  "end_x":   400, "end_y":   400,
  "waypoints": [
    { "x": 250, "y": 400 },
    { "x": 250, "y": 200 }
  ]
}
```

The path travels: start point, then each waypoint in order, then end point.

Add `radius` to round the corners at each waypoint:

```json
{
  "start_x": 100, "start_y": 400,
  "end_x":   400, "end_y":   200,
  "waypoints": [ { "x": 250, "y": 400 }, { "x": 250, "y": 200 } ],
  "radius": 20
}
```

Individual waypoints can override the global radius:

```json
"waypoints": [
  { "x": 250, "y": 400, "radius": 40 },
  { "x": 250, "y": 200, "radius": 0 }
]
```

---

## Animation

The animation effect moves one or more elements along the line path to indicate flow direction and magnitude.

### Effects

| Effect | Description |
|--------|-------------|
| `none` | No animation. Static line only. |
| `dot` | One or more dots travel along the line. `dot_length: 1` (default) gives round dots. Higher values give pill or dash shapes. `dot_spacing` controls how many are visible at once. |
| `comet_short` | A single comet with a short fading trail (trail = `dot_size * 4`). |
| `comet_medium` | A single comet with a medium trail (trail = `dot_size * 10`). |
| `comet_long` | A single comet with a long trail (trail = `dot_size * 20`). |

### Speed and direction

The `entity` value controls both speed and direction:

- **Positive value**: dot travels from start to end.
- **Negative value**: dot travels from end to start.
- **Zero or below `animate_min_value`**: animation stops, track fades to `inactive_opacity`.

Speed maps the absolute entity value onto the `animate_min_rate` to `animate_max_rate` range using a linear curve: half the value range gives exactly half the speed. Values outside `animate_min_value`/`animate_max_value` are clamped.

### Spacing as a visual indicator

`dot_spacing` can be driven by overrides to give a secondary visual cue. Close spacing (many dots) can indicate high flow; wide spacing (few dots) can indicate low flow.

---

## Conditional Overrides

The following properties can be changed by override rules:

`color`, `thickness`, `arrow`, `dot_color`, `dot_spacing`

Condition sources available: `state`, `attribute`, `state2`, `attribute2`.

Example: green forward flow when positive, warning color for reverse flow when negative:

```json
"overrides": [
  {
    "when": { "logic": "all", "conditions": [ { "source": "state", "type": "above", "value": 0 } ] },
    "set": { "color": "primary", "dot_color": "primary" }
  },
  {
    "when": { "logic": "all", "conditions": [ { "source": "state", "type": "below", "value": 0 } ] },
    "set": { "color": "warning", "dot_color": "warning" }
  }
]
```

See the [Conditional Overrides](overrides.md) reference for full condition syntax.

---

## Examples

### Static horizontal divider

```json
{
  "id": "divider_1",
  "type": "line",
  "start_x": 20,  "start_y": 380,
  "end_x":   700, "end_y": 380,
  "color": "surface2",
  "thickness": 1
}
```

### Solar power flow with dot animation

```json
{
  "id": "solar_flow",
  "type": "line",
  "start_x": 200, "start_y": 300,
  "end_x":   500, "end_y": 300,
  "color": "surface2",
  "thickness": 3,
  "effect": "dot",
  "dot_size": 8,
  "dot_color": "primary",
  "entity": "sensor.solar_power",
  "animate_min_value": 50,
  "animate_max_value": 5000,
  "animate_min_rate": 30,
  "animate_max_rate": 180,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "above", "value": 0 } ] },
      "set": { "color": "primary", "dot_color": "primary" }
    }
  ]
}
```

### Bidirectional battery flow (positive = charging, negative = discharging)

```json
{
  "id": "battery_flow",
  "type": "line",
  "start_x": 300, "start_y": 200,
  "end_x":   300, "end_y": 500,
  "color": "surface2",
  "thickness": 3,
  "effect": "comet_medium",
  "dot_size": 8,
  "entity": "sensor.battery_power",
  "animate_min_value": 100,
  "animate_max_value": 10000,
  "animate_min_rate": 30,
  "animate_max_rate": 200,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "above", "value": 0 } ] },
      "set": { "dot_color": "primary" }
    },
    {
      "when": { "logic": "all", "conditions": [ { "type": "below", "value": 0 } ] },
      "set": { "dot_color": "warning" }
    }
  ]
}
```

### Battery flow with separate mode entity driving color

Animation speed and direction come from `sensor.battery_power`. Color is driven by `sensor.battery_mode` via `entity2` and `source: "state2"` override conditions:

```json
{
  "id": "battery_flow",
  "type": "line",
  "start_x": 300, "start_y": 200,
  "end_x":   300, "end_y": 500,
  "color": "surface2",
  "thickness": 3,
  "effect": "comet_medium",
  "dot_size": 8,
  "entity":  "sensor.battery_power",
  "entity2": "sensor.battery_mode",
  "animate_min_value": 1,
  "animate_max_value": 15000,
  "animate_min_rate": 5,
  "animate_max_rate": 120,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "state2", "type": "equals", "value": "charging" } ] },
      "set": { "dot_color": "primary", "color": "primary" }
    },
    {
      "when": { "logic": "all", "conditions": [ { "source": "state2", "type": "equals", "value": "discharging" } ] },
      "set": { "dot_color": "warning", "color": "warning" }
    }
  ]
}
```

`entity` drives animation only. `entity2` is never used for speed or direction, only as a condition source in `overrides`.

### L-shaped path with rounded corner

```json
{
  "id": "grid_to_home",
  "type": "line",
  "start_x": 100, "start_y": 300,
  "end_x":   400, "end_y": 100,
  "waypoints": [ { "x": 400, "y": 300 } ],
  "radius": 30,
  "color": "surface2",
  "thickness": 3,
  "effect": "dot",
  "dot_color": "warning",
  "entity": "sensor.grid_power"
}
```

### Energy flow diagram: three lines meeting at a central node

Compose multiple line widgets, all bound to their own entity. Each line is independent and animates at its own speed and direction based on live HA data.

```json
{ "id": "solar_in",  "type": "line", "start_x": 100, "start_y": 250, "end_x": 400, "end_y": 250, "entity": "sensor.solar_power",   "effect": "dot", "dot_color": "primary", "color": "surface2", "thickness": 3 },
{ "id": "grid_in",   "type": "line", "start_x": 400, "start_y": 100, "end_x": 400, "end_y": 250, "entity": "sensor.grid_power",    "effect": "dot", "dot_color": "warning", "color": "surface2", "thickness": 3 },
{ "id": "home_out",  "type": "line", "start_x": 400, "start_y": 250, "end_x": 700, "end_y": 250, "entity": "sensor.home_power",    "effect": "dot", "dot_color": "text",    "color": "surface2", "thickness": 3 }
```
