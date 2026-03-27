export function createWidgetGroup(w, theme) {
  var group = new Konva.Group({
    x: w.x || 0,
    y: w.y || 0,
    draggable: true,
    id: w.id || ''
  });

  var bg = new Konva.Rect({
    width: w.w || 10,
    height: w.h || 10,
    fill: resolveColor(w.background, theme) || '#2b3642',
    stroke: '#3b4755',
    strokeWidth: 1,
    cornerRadius: w.radius || 0,
    opacity: (w.opacity !== undefined ? w.opacity : 1)
  });

  var label = new Konva.Text({
    x: 6,
    y: 6,
    width: Math.max(0, (w.w || 10) - 12),
    text: (w.id || '') + ' (' + (w.type || 'unknown') + ')',
    fontSize: 12,
    fill: '#cfd6dd',
    wrap: 'none',
    ellipsis: true
  });

  // For label widgets, show their text preview
  if (w.type === 'label' && w.text) {
    label.text(String(w.text));
  }

  // bg is added first so subsequent shapes render on top
  group.add(bg);
  group.add(label);

  // For arc widgets, draw a visual track + value arc preview on top of bg
  if (w.type === 'arc') {
    label.visible(false);
    // Make bg transparent so the arc shows through cleanly
    bg.fill('transparent');
    var arcW = w.w || 10;
    var arcH = w.h || 10;
    var arcSize = Math.min(arcW, arcH);
    var arcLineWidth = w.line_width || 12;
    var arcR = (arcSize / 2) - (arcLineWidth / 2) - 2;
    var startAngle = w.start_angle !== undefined ? w.start_angle : 135;
    var endAngle = w.end_angle !== undefined ? w.end_angle : 405;
    var totalAngle = endAngle - startAngle;
    var arcCx = arcW / 2;
    var arcCy = arcH / 2;
    if (arcR > 4) {
      group.add(new Konva.Arc({
        x: arcCx, y: arcCy,
        innerRadius: Math.max(0, arcR - arcLineWidth / 2),
        outerRadius: arcR + arcLineWidth / 2,
        angle: totalAngle,
        rotation: startAngle - 90,
        fill: resolveColor(w.background, theme) || '#363f4a',
        listening: false
      }));
      group.add(new Konva.Arc({
        x: arcCx, y: arcCy,
        innerRadius: Math.max(0, arcR - arcLineWidth / 2),
        outerRadius: arcR + arcLineWidth / 2,
        angle: totalAngle * 0.65,
        rotation: startAngle - 90,
        fill: resolveColor(w.color, theme) || '#8ADF45',
        listening: false
      }));
      // ID label centred in the arc
      group.add(new Konva.Text({
        x: arcCx - 40,
        y: arcCy - 7,
        width: 80,
        text: w.id || '',
        fontSize: 11,
        fill: '#cfd6dd',
        align: 'center',
        listening: false
      }));
    }
  }

  // For sliders, draw track + fill + thumb preview.
  if (w.type === 'slider') {
    label.visible(false);
    var sw = w.w || 10;
    var sh = w.h || 10;
    var vertical = (w.orientation === 'vertical');
    var thickness = vertical ? sw : sh;
    var radius = (w.radius !== undefined) ? w.radius : Math.round(thickness / 2);
    var thumbSize = (w.thumb_size !== undefined) ? w.thumb_size : Math.max(14, Math.round(thickness * 0.9));
    var ratio = 0.55;

    bg.fill(resolveColor(w.background, theme) || '#363f4a');
    bg.cornerRadius(radius);

    var fill = new Konva.Rect({
      x: 0,
      y: 0,
      width: vertical ? sw : Math.round(sw * ratio),
      height: vertical ? Math.round(sh * ratio) : sh,
      fill: resolveColor(w.color, theme) || '#8ADF45',
      cornerRadius: radius,
      listening: false
    });
    if (vertical) {
      fill.y(sh - fill.height());
    }
    group.add(fill);

    var thumbX = vertical ? Math.round((sw - thumbSize) / 2) : Math.round(sw * ratio - thumbSize / 2);
    var thumbY = vertical ? Math.round((sh - sh * ratio) - thumbSize / 2) : Math.round((sh - thumbSize) / 2);
    if (thumbX < 0) thumbX = 0;
    if (thumbY < 0) thumbY = 0;
    group.add(new Konva.Circle({
      x: thumbX + thumbSize / 2,
      y: thumbY + thumbSize / 2,
      radius: Math.round(thumbSize / 2),
      fill: resolveColor(w.thumb_color, theme) || '#ffffff',
      opacity: 0.95,
      listening: false
    }));
  }
  // For switch widgets, draw track + thumb in the "on" position.
  if (w.type === 'switch') {
    label.visible(false);
    var sw = w.w || 10;
    var sh = w.h || 10;
    var pad = (w.padding !== undefined) ? parseFloat(w.padding) : 3;
    if (isNaN(pad) || pad < 0) pad = 3;
    var radius = (w.radius !== undefined) ? w.radius : Math.round(sh / 2);
    var thumbSize = Math.max(8, sh - pad * 2);
    var travel = Math.max(0, sw - pad * 2 - thumbSize);
    var thumbRadius = (w.thumb_radius !== undefined) ? parseFloat(w.thumb_radius) : Math.round(thumbSize / 2);
    if (isNaN(thumbRadius) || thumbRadius < 0) thumbRadius = Math.round(thumbSize / 2);

    bg.fill(resolveColor(w.color, theme) || '#363f4a');
    bg.cornerRadius(radius);

    group.add(new Konva.Rect({
      x: pad + travel,
      y: pad,
      width: thumbSize,
      height: thumbSize,
      fill: resolveColor(w.thumb_color, theme) || '#ffffff',
      cornerRadius: thumbRadius,
      listening: false
    }));
  }

  // Line widget: special rendering using absolute canvas coords
  if (w.type === 'line') {
    // Collect all absolute points
    var absPts = [{ x: (w.start_x || 0), y: (w.start_y || 0) }];
    if (w.waypoints) {
      for (var lpi = 0; lpi < w.waypoints.length; lpi++) {
        absPts.push({ x: w.waypoints[lpi].x, y: w.waypoints[lpi].y });
      }
    }
    absPts.push({ x: (w.end_x || 200), y: (w.end_y || 0) });

    // Bounding box with padding so strokes and handles are not clipped
    var lMinX = absPts[0].x, lMinY = absPts[0].y;
    var lMaxX = absPts[0].x, lMaxY = absPts[0].y;
    for (var lbi = 1; lbi < absPts.length; lbi++) {
      lMinX = Math.min(lMinX, absPts[lbi].x);
      lMinY = Math.min(lMinY, absPts[lbi].y);
      lMaxX = Math.max(lMaxX, absPts[lbi].x);
      lMaxY = Math.max(lMaxY, absPts[lbi].y);
    }
    var lPad = Math.max((w.thickness || 2), (w.dot_size || 6)) + 10;
    var lgx  = lMinX - lPad;
    var lgy  = lMinY - lPad;
    var lgw  = Math.max(1, lMaxX - lMinX + lPad * 2);
    var lgh  = Math.max(1, lMaxY - lMinY + lPad * 2);

    // Replace the default group with one sized to the bounding box
    group.destroy();
    group = new Konva.Group({
      id:        w.id || '',
      x:         lgx,
      y:         lgy,
      width:     lgw,
      height:    lgh,
      draggable: true
    });

    // Relative point coords (subtract group origin)
    var konvaPts = [];
    for (var kpi = 0; kpi < absPts.length; kpi++) {
      konvaPts.push(absPts[kpi].x - lgx, absPts[kpi].y - lgy);
    }

    var lColor = resolveColor(w.color || 'surface2', theme) || '#8ADF45';

    // Transparent hit rect for easy selection anywhere near the line
    var lHitRect = new Konva.Rect({ x: 0, y: 0, width: lgw, height: lgh, fill: 'transparent', listening: true });
    group.add(lHitRect);

    // Wide invisible stroke for easier path hit-testing
    var lHitLine = new Konva.Line({
      points:      konvaPts,
      stroke:      'rgba(0,0,0,0.01)',
      strokeWidth: Math.max(12, (w.thickness || 2) + 10),
      lineCap:     'round',
      lineJoin:    'round',
      listening:   true
    });
    group.add(lHitLine);

    // Visible track line
    var lTrackLine = new Konva.Line({
      points:      konvaPts,
      stroke:      lColor,
      strokeWidth: w.thickness || 2,
      lineCap:     'round',
      lineJoin:    'round',
      listening:   false
    });
    group.add(lTrackLine);

    // Small circles at each point
    var lPointCircles = [];
    for (var lci = 0; lci < absPts.length; lci++) {
      var lpc = new Konva.Circle({
        x:           absPts[lci].x - lgx,
        y:           absPts[lci].y - lgy,
        radius:      4,
        fill:        lColor,
        stroke:      '#fff',
        strokeWidth: 1,
        listening:   false
      });
      group.add(lpc);
      lPointCircles.push(lpc);
    }

    // ID label
    group.add(new Konva.Text({
      x:         lPad,
      y:         2,
      text:      w.id || '',
      fontSize:  11,
      fill:      '#cfd6dd',
      listening: false
    }));

    group._isLine       = true;
    group._lineBBox     = { x: lgx, y: lgy, w: lgw, h: lgh };
    group._hitRect      = lHitRect;
    group._hitLine      = lHitLine;
    group._trackLine    = lTrackLine;
    group._pointCircles = lPointCircles;
    group._data         = w;
    return group;
  }

  group._rect = bg;
  group._label = label;
  group._data = w;
  return group;
}

function resolveColor(token, theme) {
  if (!token) return null;
  if (token.charAt && (token.charAt(0) === '#' || token.indexOf('rgb') === 0)) return token;
  if (!theme || !theme.colors) return token;
  return theme.colors[token] || token;
}
