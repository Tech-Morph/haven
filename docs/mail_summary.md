# mail_summary Widget

Displays a USPS Informed Delivery status summary — mail count, tracked/advertised
package counts, sender, last-updated time, per-mailpiece detail lines, and a
preview image strip. Designed as a fixed-canvas equivalent of a Lovelace
markdown card built against a USPS Informed Delivery sensor.

## Example

```json
{
  "type": "mail_summary",
  "id": 50,
  "x": 20, "y": 20, "w": 420, "h": 420,
  "entity": "sensor.package_tracker_usps_informed_delivery",
  "title": "Today's USPS Mail",
  "show_images": true,
  "max_images": 6
}
```

## Entity Contract

`entity` — USPS Informed Delivery sensor, e.g.
`sensor.package_tracker_usps_informed_delivery`.

| Field | Location | Description |
|---|---|---|
| `state` | state | `"No mail detected"`, `"unknown"`, `"unavailable"`, or a status string |
| `mail_count` | attribute | Number of mail pieces expected |
| `package_count` | attribute | Number of tracked packages (falls back to `0`) |
| `advertised_package_count` | attribute | Package count mentioned in digest text, used when `package_count` is `0` |
| `sender` | attribute | Source line shown as "Source" |
| `mailpieces` | attribute | Array of strings, rendered as a bulleted "Mail details" list |
| `mailpiece_images` | attribute | Array of image URLs (relative or absolute), rendered as a thumbnail strip |
| `last_updated` | standard HA field | Used to render the "Updated" timestamp |

## Rendering Behavior

- If `state` is `unknown` or `unavailable`, shows "USPS Informed Delivery is not available yet." and nothing else.
- If `state` is exactly `"No mail detected"`, shows "No USPS mail or packages were detected in the latest digest." and nothing else.
- Otherwise renders, in order: Status, Mail expected, Packages (tracked, else advertised, else "None detected"), Source (if present), Updated (if timestamp parses), Mail details list (if `mailpieces` non-empty), Preview images strip (if `show_images` is true).
- When `show_images` is true but `mailpiece_images` is empty, shows `empty_images_text` instead of an empty strip.

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `entity` | string | - | USPS Informed Delivery sensor (required) |
| `title` | string | `"Today's USPS Mail"` | Header text; set `""` to hide |
| `show_images` | bool | `true` | Show preview image strip |
| `max_images` | number | `6` | Cap on images rendered |
| `image_height` | number | `90` | Thumbnail height (px) |
| `empty_images_text` | string | `"No USPS mailpiece preview images were available in the latest digest."` | Shown when `show_images` is true and no images exist |
| `background` | color token | `"surface"` | Card background |
| `radius` | number | `12` | Corner radius (px) |
| `padding` | number | `14` | Inner padding (px) |
| `title_color` | color token | `"text"` | Header color |
| `title_size` | number | `16` | Header font size |
| `text_size` | number | `13` | Body line font size |
| `opacity` | number | - | Widget opacity |

## Notes

- All entity-derived text (`sender`, `mailpieces` entries, status strings) is set via `textContent`, never `innerHTML`, so no HTML injection risk from mail content.
- Timestamp formatting is done manually in JS (no strftime in ES5); output matches e.g. `Jul 29, 2:59 PM`.
- This is a separate widget from `package_tracker`. Use `package_tracker` for the multi-shipment list view; use `mail_summary` for the single-sensor USPS digest summary. Both can be placed on the same page as independent widgets.