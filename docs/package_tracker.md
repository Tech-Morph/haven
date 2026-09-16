# package_tracker Widget

Displays active shipments tracked by the Package Tracker MQTT service, with
optional USPS Informed Delivery mailpiece image thumbnails.

## Example

\`\`\`json
{
  "type": "package_tracker",
  "id": 42,
  "x": 20, "y": 20, "w": 400, "h": 300,
  "entity": "sensor.package_tracker_package_tracker_count",
  "entity2": "sensor.package_tracker_usps_informed_delivery",
  "title": "Packages",
  "max_packages": 5,
  "background": "surface",
  "radius": 12
}
\`\`\`

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `entity` | string | - | Package count summary sensor |
| `entity2` | string | - | USPS Informed Delivery sensor (optional) |
| `max_packages` | number | 5 | Cap on rows shown |
| `show_carrier_icon` | bool | true | Show MDI carrier icon |
| `show_mail_images` | bool | true | Show mailpiece thumbnail strip |
| `empty_text` | string | "No packages in transit" | Empty-state text |
| `title` | string | - | Optional header |
| `background` | color token | "surface" | Card background |
| `radius` | number | 12 | Corner radius (px) |
| `text_color` | color token | "text" | Carrier/tracking line color |
| `text_size` | number | 14 | Carrier/tracking font size |
| `detail_size` | number | 12 | Status line font size |
| `mail_image_height` | number | 90 | Mailpiece thumbnail height (px) |