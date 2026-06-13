/* ============================================================
   HAven - Thermostat Widget  v5

   Visual layout:
     ┌──────────────────────────────┐
     │   horseshoe arc (gap bottom) │
     │     mode label  (muted)      │
     │     75°F        (large bold) │
     │     Set 68°F    (muted)      │
     │      [ − ]  [ + ]            │  ← inside arc gap
     ├──────────────────────────────┤
     │  [Mode/Off][Fan/Auto][Swing] │
     └──────────────────────────────┘

   Arc geometry (SVG convention: 0°=right, clockwise positive)
     Gap  : bottom of circle, from 45° (lower-right) to 135° (lower-left)
     Track: clockwise from 135° → 405° (= 45°), sweep = 270°
     polar(deg): x = cx + r·cos(deg·π/180)
                 y = cy + r·sin(deg·π/180)

   Color strategy (v5):
     - rcEl()  → elevated surface: tries surface_2/surface2, falls back to
                 rgba(255,255,255,0.14) so buttons/pills are always visible
                 on dark backgrounds.
     - rcTrack() → arc track ring: rgba(255,255,255,0.22) — clearly visible
                   but not distracting behind the value arc.
     - Labels promoted to rc('text') or rgba(255,255,255,0.70) so they read
                   clearly without being as loud as the temperature number.

   RULE: Never write el.style.left/top/width/height – engine owns those.
   ============================================================ */

  function renderThermostat(el, w) {

    /* ------------------------------------------------------------------
       1.  Config
    ------------------------------------------------------------------ */
    var displayUnit = String(w.unit || 'F').toUpperCase() === 'C' ? 'C' : 'F';
    var defMin  = displayUnit === 'C' ? 18 : 64;
    var defMax  = displayUnit === 'C' ? 32 : 90;
    var cfgMin  = isNaN(parseFloat(w.min))  ? defMin  : parseFloat(w.min);
    var cfgMax  = isNaN(parseFloat(w.max))  ? defMax  : parseFloat(w.max);
    var cfgStep = isNaN(parseFloat(w.step)) ? 1 : Math.max(0.1, parseFloat(w.step));
    if (cfgMax <= cfgMin) cfgMax = cfgMin + cfgStep;

    var lineWidth  = Math.max(4, parseFloat(w.line_width) || 18);
    var bgToken    = w.background  || 'surface';
    var arcToken   = w.color       || 'primary';
    var heatToken  = w.heat_color  || 'warning';
    var coolToken  = w.cool_color  || 'primary';
    var lblToken   = w.label_color || 'text_muted';
    var cardRadius = isNaN(parseInt(w.radius, 10)) ? 16 : parseInt(w.radius, 10);

    /* ------------------------------------------------------------------
       2.  Helpers
    ------------------------------------------------------------------ */
    function rc(tok)  { return resolveColor(tok); }

    /* Elevated surface for buttons / pills / chips.
       Uses the theme token when it resolves to a non-empty string,
       otherwise falls back to a visible semi-transparent white so
       elements are always legible on dark widget backgrounds. */
    function rcEl() {
      var v = rc('surface_2') || rc('surface2');
      if (v && v !== 'undefined' && v !== 'null') return v;
      return 'rgba(255,255,255,0.14)';
    }

    /* Arc track — needs to be clearly visible as the "empty" portion
       of the ring. Slightly brighter than the button surface. */
    function rcTrack() {
      return 'rgba(255,255,255,0.22)';
    }

    /* Muted label colour — readable but secondary.
       Prefers the theme token; falls back to 70% white. */
    function rcMuted() {
      var v = rc(lblToken);
      if (v && v !== 'undefined' && v !== 'null') return v;
      return 'rgba(255,255,255,0.70)';
    }

    /* Full text colour — white on dark, dark on light. */
    function rcText() {
      var v = rc('text');
      if (v && v !== 'undefined' && v !== 'null') return v;
      return '#ffffff';
    }

    var latestState = w.entity ? (entityStates[w.entity] || null) : null;

    function getEU(state) {
      if (!state || !state.attributes) return displayUnit;
      var raw = String(
        state.attributes.temperature_unit ||
        state.attributes.unit_of_measurement || displayUnit
      ).replace('\u00b0', '').toUpperCase();
      return raw === 'C' ? 'C' : 'F';
    }
    function toDisplay(v, eu) {
      if (displayUnit === 'F' && eu === 'C') return v * 9 / 5 + 32;
      if (displayUnit === 'C' && eu === 'F') return (v - 32) * 5 / 9;
      return v;
    }
    function toEU(v, eu) {
      if (displayUnit === 'F' && eu === 'C') return (v - 32) * 5 / 9;
      if (displayUnit === 'C' && eu === 'F') return v * 9 / 5 + 32;
      return v;
    }
    function fmt(v) {
      if (v === null || v === undefined || isNaN(v)) return '--';
      return Math.round(v * 10) / 10 + '';
    }
    function clamp(v) {
      v = Math.round(v / cfgStep) * cfgStep;
      if (v < cfgMin) v = cfgMin;
      if (v > cfgMax) v = cfgMax;
      return Math.round(v * 10) / 10;
    }

    /* ------------------------------------------------------------------
       Arc geometry
       Gap is at the bottom. The arc runs CLOCKWISE from 135° to 405°.
       SVG convention: 0° = 3 o'clock, angles increase clockwise.
       polar() maps degrees to SVG x/y.
    ------------------------------------------------------------------ */
    var ARC_START = 135;   /* lower-left  */
    var ARC_SWEEP = 270;   /* degrees, clockwise */
    var ARC_END   = ARC_START + ARC_SWEEP;  /* 405 = same as 45° */

    function polar(cx, cy, r, deg) {
      var rad = deg * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    /* Draw a clockwise arc from startDeg to endDeg */
    function arcPath(cx, cy, r, startDeg, endDeg) {
      var sweep = endDeg - startDeg;
      /* normalise sweep to (0, 360] */
      while (sweep <= 0)   sweep += 360;
      while (sweep > 360)  sweep -= 360;
      if (sweep < 0.1) return '';
      var s     = polar(cx, cy, r, startDeg);
      var e     = polar(cx, cy, r, endDeg);
      var large = sweep > 180 ? 1 : 0;
      return ['M', s.x, s.y, 'A', r, r, 0, large, 1, e.x, e.y].join(' ');
    }

    /* ------------------------------------------------------------------
       3.  Dimensions  (never write back to el.style)
    ------------------------------------------------------------------ */
    var wW = w.w;
    var wH = w.h;

    var pillH    = Math.max(36, Math.round(wH * 0.18));
    var pillGap  = 4;
    var arcZoneH = wH - pillH - pillGap;

    var margin = lineWidth + 8;
    var r  = Math.min(wW / 2, arcZoneH * 0.56) - margin;
    if (r < 12) r = 12;
    var cx = wW / 2;
    var cy = arcZoneH * 0.46;

    /* Bottom of the circle (geometric) */
    var circleBottom = cy + r;

    /* ------------------------------------------------------------------
       4.  Root element — NEVER touch left/top/width/height
    ------------------------------------------------------------------ */
    el.style.position      = 'absolute';
    el.style.overflow      = 'hidden';
    el.style.display       = 'flex';
    el.style.flexDirection = 'column';
    el.style.boxSizing     = 'border-box';
    el.style.background    = rc(bgToken);
    el.style.borderRadius  = cardRadius + 'px';
    el.style.userSelect    = 'none';

    /* ------------------------------------------------------------------
       5.  Arc zone
    ------------------------------------------------------------------ */
    var arcZone = document.createElement('div');
    arcZone.style.cssText = [
      'position:relative',
      'flex:0 0 ' + arcZoneH + 'px',
      'width:100%',
      'overflow:visible'
    ].join(';');
    el.appendChild(arcZone);

    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width',  wW);
    svg.setAttribute('height', arcZoneH);
    svg.style.cssText = 'display:block;position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';
    arcZone.appendChild(svg);

    /* Track ring — clearly visible "empty" portion */
    var trackEl = document.createElementNS(ns, 'path');
    trackEl.setAttribute('fill',          'none');
    trackEl.setAttribute('stroke',         rcTrack());
    trackEl.setAttribute('stroke-width',   lineWidth);
    trackEl.setAttribute('stroke-linecap', 'round');
    trackEl.setAttribute('d', arcPath(cx, cy, r, ARC_START, ARC_END));
    svg.appendChild(trackEl);

    /* Value arc */
    var valueEl = document.createElementNS(ns, 'path');
    valueEl.setAttribute('fill',          'none');
    valueEl.setAttribute('stroke-width',   lineWidth);
    valueEl.setAttribute('stroke-linecap', 'round');
    valueEl.setAttribute('stroke',         rc(arcToken));
    svg.appendChild(valueEl);

    /* Value arc 2 — dual heat_cool mode */
    var value2El = document.createElementNS(ns, 'path');
    value2El.setAttribute('fill',           'none');
    value2El.setAttribute('stroke-width',   Math.max(4, Math.round(lineWidth * 0.6)));
    value2El.setAttribute('stroke-linecap', 'round');
    value2El.setAttribute('stroke-dasharray', '5 7');
    value2El.style.display = 'none';
    svg.appendChild(value2El);

    /* ------------------------------------------------------------------
       6.  Centre label overlay
    ------------------------------------------------------------------ */
    var centreDiv = document.createElement('div');
    centreDiv.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      'width:100%', 'height:100%',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'text-align:center', 'pointer-events:none',
      'padding-bottom:' + Math.round(arcZoneH * 0.12) + 'px'
    ].join(';');
    arcZone.appendChild(centreDiv);

    /* Mode label — muted but readable */
    var fsModeLabel = Math.max(10, Math.round(wW * 0.09));
    var modeLabelEl = document.createElement('div');
    modeLabelEl.style.cssText = [
      'font-size:'      + fsModeLabel + 'px',
      'font-weight:500',
      'color:'          + rcMuted(),
      'line-height:1.2',
      'letter-spacing:0.04em',
      'text-transform:capitalize'
    ].join(';');
    modeLabelEl.textContent = 'Off';
    centreDiv.appendChild(modeLabelEl);

    /* Current temperature — large with superscript unit */
    var fsCur  = Math.max(28, Math.round(wW * 0.28));
    var fsUnit = Math.max(12, Math.round(fsCur * 0.38));
    var curWrap = document.createElement('div');
    curWrap.style.cssText = [
      'display:flex', 'align-items:flex-start', 'justify-content:center',
      'line-height:1', 'margin-top:2px'
    ].join(';');
    var curNumEl = document.createElement('span');
    curNumEl.style.cssText = [
      'font-size:'     + fsCur + 'px',
      'font-weight:700',
      'letter-spacing:-0.02em',
      'color:'         + rcText()
    ].join(';');
    curNumEl.textContent = '--';
    curWrap.appendChild(curNumEl);
    var curUnitEl = document.createElement('span');
    curUnitEl.style.cssText = [
      'font-size:'   + fsUnit + 'px',
      'font-weight:600',
      'color:'       + rcMuted(),
      'margin-top:'  + Math.round(fsCur * 0.08) + 'px',
      'margin-left:2px'
    ].join(';');
    curUnitEl.textContent = '\u00b0' + displayUnit;
    curWrap.appendChild(curUnitEl);
    centreDiv.appendChild(curWrap);

    /* Setpoint label — muted but readable */
    var fsSP = Math.max(9, Math.round(wW * 0.08));
    var spLabelEl = document.createElement('div');
    spLabelEl.style.cssText = [
      'font-size:'  + fsSP + 'px',
      'font-weight:500',
      'color:'      + rcMuted(),
      'margin-top:4px',
      'line-height:1'
    ].join(';');
    spLabelEl.textContent = 'Set --';
    centreDiv.appendChild(spLabelEl);

    /* ------------------------------------------------------------------
       7.  ± buttons — centred in the gap at the bottom of the arc
    ------------------------------------------------------------------ */
    var btnSize = Math.max(24, Math.round(wW * 0.16));
    var btnFS   = Math.max(14, Math.round(btnSize * 0.52));
    var btnSpacing = Math.round(wW * 0.14);
    var btnY = Math.round(circleBottom - btnSize * 0.5);
    if (btnY + btnSize > arcZoneH) btnY = arcZoneH - btnSize - 2;
    if (btnY < 0) btnY = 2;

    function makePMBtn(label, onclick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = [
        'position:absolute',
        'width:'         + btnSize + 'px',
        'height:'        + btnSize + 'px',
        'border-radius:' + Math.round(btnSize / 2) + 'px',
        'border:1px solid rgba(255,255,255,0.18)',
        'background:'    + rcEl(),
        'color:'         + rcText(),
        'font-size:'     + btnFS + 'px',
        'font-family:inherit',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:0',
        'line-height:1',
        'top:'           + btnY + 'px',
        'pointer-events:auto'
      ].join(';');
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        onclick();
        if (typeof resetReturnTimer === 'function') resetReturnTimer();
      });
      btn.addEventListener('mousedown',  function() { btn.style.opacity = '0.5'; });
      btn.addEventListener('mouseup',    function() { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', function() { btn.style.opacity = '1'; });
      btn.addEventListener('touchstart', function() { btn.style.opacity = '0.5'; }, { passive: true });
      btn.addEventListener('touchend',   function() { btn.style.opacity = '1'; });
      return btn;
    }

    var minusBtn = makePMBtn('\u2212', function() { adjustSetpoint(-cfgStep); });
    var plusBtn  = makePMBtn('+',      function() { adjustSetpoint(cfgStep);  });
    minusBtn.style.left = Math.round(cx - btnSpacing - btnSize) + 'px';
    plusBtn.style.left  = Math.round(cx + btnSpacing) + 'px';
    arcZone.appendChild(minusBtn);
    arcZone.appendChild(plusBtn);

    /* Dual ± buttons (heat_cool mode) */
    var minusBtnLo = makePMBtn('\u2212', function() { adjustDualLow(-cfgStep); });
    var plusBtnLo  = makePMBtn('+',      function() { adjustDualLow(cfgStep);  });
    var minusBtnHi = makePMBtn('\u2212', function() { adjustDualHigh(-cfgStep); });
    var plusBtnHi  = makePMBtn('+',      function() { adjustDualHigh(cfgStep);  });
    var dualYLo = Math.max(2, btnY - Math.round(btnSize * 1.3));
    var dualYHi = btnY;
    minusBtnLo.style.left = minusBtnHi.style.left = minusBtn.style.left;
    plusBtnLo.style.left  = plusBtnHi.style.left  = plusBtn.style.left;
    minusBtnLo.style.top  = plusBtnLo.style.top   = dualYLo + 'px';
    minusBtnHi.style.top  = plusBtnHi.style.top   = dualYHi + 'px';
    [minusBtnLo, plusBtnLo, minusBtnHi, plusBtnHi].forEach(function(b) { b.style.display = 'none'; });
    arcZone.appendChild(minusBtnLo);
    arcZone.appendChild(plusBtnLo);
    arcZone.appendChild(minusBtnHi);
    arcZone.appendChild(plusBtnHi);

    /* ------------------------------------------------------------------
       8.  Pills zone  (Mode · Fan mode · Swing mode)
    ------------------------------------------------------------------ */
    var pillsZone = document.createElement('div');
    pillsZone.style.cssText = [
      'flex:0 0 ' + pillH + 'px',
      'display:flex',
      'flex-direction:row',
      'align-items:stretch',
      'gap:' + pillGap + 'px',
      'padding:0 ' + pillGap + 'px ' + pillGap + 'px ' + pillGap + 'px',
      'box-sizing:border-box',
      'width:100%'
    ].join(';');
    el.appendChild(pillsZone);

    var pillFS1    = Math.max(8,  Math.round(pillH * 0.24));
    var pillFS2    = Math.max(9,  Math.round(pillH * 0.28));
    var pillIconFS = Math.max(10, Math.round(pillH * 0.36));

    function makePill(iconStr, topText, bottomText) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.style.cssText = [
        'flex:1 1 0',
        'min-width:0',
        'border:1px solid rgba(255,255,255,0.12)',
        'border-radius:' + Math.round(pillH * 0.3) + 'px',
        'background:'    + rcEl(),
        'color:'         + rcText(),
        'display:flex',
        'flex-direction:row',
        'align-items:center',
        'justify-content:flex-start',
        'gap:5px',
        'padding:0 7px',
        'box-sizing:border-box',
        'cursor:pointer',
        'font-family:inherit',
        'overflow:hidden'
      ].join(';');

      var iconSpan = document.createElement('span');
      setContent(iconSpan, iconStr);
      iconSpan.style.cssText = [
        'font-size:' + pillIconFS + 'px',
        'flex:0 0 auto',
        'color:'     + rcMuted()
      ].join(';');
      pill.appendChild(iconSpan);

      var txtWrap = document.createElement('div');
      txtWrap.style.cssText = [
        'display:flex', 'flex-direction:column',
        'align-items:flex-start', 'min-width:0'
      ].join(';');

      var line1 = document.createElement('span');
      line1.style.cssText = [
        'font-size:'    + pillFS1 + 'px',
        'font-weight:400',
        'color:'        + rcMuted(),
        'line-height:1.1',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'max-width:100%'
      ].join(';');
      line1.textContent = topText;

      var line2 = document.createElement('span');
      line2.style.cssText = [
        'font-size:'    + pillFS2 + 'px',
        'font-weight:600',
        'color:'        + rcText(),
        'line-height:1.1',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'max-width:100%'
      ].join(';');
      line2.textContent = bottomText;

      txtWrap.appendChild(line1);
      txtWrap.appendChild(line2);
      pill.appendChild(txtWrap);

      pill.addEventListener('mousedown',  function() { pill.style.opacity = '0.6'; });
      pill.addEventListener('mouseup',    function() { pill.style.opacity = '1'; });
      pill.addEventListener('mouseleave', function() { pill.style.opacity = '1'; });
      pill.addEventListener('touchstart', function() { pill.style.opacity = '0.6'; }, { passive: true });
      pill.addEventListener('touchend',   function() { pill.style.opacity = '1'; });

      return { pill: pill, icon: iconSpan, line1: line1, line2: line2 };
    }

    var modePill  = makePill('[mdi:power]',                 'Mode',       'Off');
    var fanPill   = makePill('[mdi:fan]',                   'Fan mode',   'Auto');
    var swingPill = makePill('[mdi:arrow-split-vertical]',  'Swing mode', 'Off');
    [modePill, fanPill, swingPill].forEach(function(p) { pillsZone.appendChild(p.pill); });

    /* Mode picker overlay */
    var modeOverlay    = null;
    var modePickerOpen = false;

    modePill.pill.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleModePicker();
      if (typeof resetReturnTimer === 'function') resetReturnTimer();
    });

    function toggleModePicker() {
      if (modePickerOpen) { closeModePicker(); return; }
      modePickerOpen = true;
      modeOverlay = document.createElement('div');
      modeOverlay.style.cssText = [
        'position:absolute',
        'bottom:' + (pillH + pillGap) + 'px',
        'left:'   + pillGap + 'px',
        'right:'  + pillGap + 'px',
        'background:'    + rc(bgToken),
        'border-radius:' + Math.round(pillH * 0.3) + 'px',
        'padding:6px',
        'display:flex',
        'flex-wrap:wrap',
        'gap:4px',
        'justify-content:center',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
        'z-index:10'
      ].join(';');

      var MODES  = ['auto', 'heat', 'cool', 'heat_cool', 'dry', 'fan_only', 'off'];
      var ICONS  = {
        heat:'[mdi:fire]', cool:'[mdi:snowflake]', heat_cool:'[mdi:autorenew]',
        auto:'[mdi:thermostat-auto]', dry:'[mdi:water-percent]',
        fan_only:'[mdi:fan]', off:'[mdi:power]'
      };
      var LABELS = {
        heat:'Heat', cool:'Cool', heat_cool:'Heat/Cool',
        auto:'Auto', dry:'Dry',   fan_only:'Fan', off:'Off'
      };
      var availModes = (latestState && latestState.attributes && latestState.attributes.hvac_modes)
        ? latestState.attributes.hvac_modes
        : MODES;

      availModes.forEach(function(mode) {
        var chip   = document.createElement('button');
        chip.type  = 'button';
        var chipH2  = Math.max(20, Math.round(pillH * 0.70));
        var chipFS2 = Math.max(9,  Math.round(chipH2 * 0.52));
        chip.style.cssText = [
          'border:1px solid rgba(255,255,255,0.14)',
          'border-radius:' + Math.round(chipH2 / 2) + 'px',
          'height:'        + chipH2 + 'px',
          'padding:0 8px',
          'background:'    + rcEl(),
          'color:'         + rcText(),
          'font-size:'     + chipFS2 + 'px',
          'font-family:inherit',
          'cursor:pointer',
          'display:flex',
          'align-items:center',
          'gap:4px'
        ].join(';');
        var ic = document.createElement('span');
        setContent(ic, ICONS[mode] || '[mdi:thermostat]');
        ic.style.fontSize = chipFS2 + 'px';
        chip.appendChild(ic);
        var tx = document.createElement('span');
        tx.textContent = LABELS[mode] || mode;
        chip.appendChild(tx);
        chip.addEventListener('click', function(e) {
          e.stopPropagation();
          sendMode(mode);
          closeModePicker();
          if (typeof resetReturnTimer === 'function') resetReturnTimer();
        });
        modeOverlay.appendChild(chip);
      });

      el.appendChild(modeOverlay);
      setTimeout(function() {
        document.addEventListener('click', closeModePickerExternal);
      }, 0);
    }

    function closeModePickerExternal() { closeModePicker(); }
    function closeModePicker() {
      if (modeOverlay && modeOverlay.parentNode) modeOverlay.parentNode.removeChild(modeOverlay);
      modeOverlay     = null;
      modePickerOpen  = false;
      document.removeEventListener('click', closeModePickerExternal);
    }

    /* ------------------------------------------------------------------
       9.  Setpoint state
    ------------------------------------------------------------------ */
    var singleSP = clamp((cfgMin + cfgMax) / 2);
    var dualLow  = clamp(cfgMin + (cfgMax - cfgMin) * 0.35);
    var dualHigh = clamp(cfgMin + (cfgMax - cfgMin) * 0.65);
    var isDual   = false;
    var curMode  = 'off';

    /* ------------------------------------------------------------------
       10. Arc colour helpers
    ------------------------------------------------------------------ */
    function modeColor(m) {
      if (m === 'heat' || m === 'dry')        return rc(heatToken);
      if (m === 'cool' || m === 'auto')       return rc(coolToken);
      if (m === 'heat_cool')                  return rc(heatToken);
      if (m === 'fan_only' || m === 'off')    return rcMuted();
      return rc(arcToken);
    }

    /* ------------------------------------------------------------------
       11. Redraw arc
    ------------------------------------------------------------------ */
    function spToPct(sp) {
      var p = (sp - cfgMin) / (cfgMax - cfgMin);
      return p < 0 ? 0 : p > 1 ? 1 : p;
    }

    function redraw() {
      var col = modeColor(curMode);
      curNumEl.style.color = col;

      if (isDual) {
        var pLo = spToPct(dualLow);
        var pHi = spToPct(dualHigh);
        var aLo = ARC_START + pLo * ARC_SWEEP;
        var aHi = ARC_START + pHi * ARC_SWEEP;

        valueEl.setAttribute('stroke', modeColor('heat'));
        valueEl.setAttribute('d', pLo <= 0 ? '' : arcPath(cx, cy, r, ARC_START, aLo));

        value2El.setAttribute('stroke', modeColor('cool'));
        value2El.style.display = '';
        value2El.setAttribute('d', pHi <= pLo ? '' : arcPath(cx, cy, r, aLo, aHi));

        spLabelEl.textContent = fmt(dualLow) + '\u00b0\u2013' + fmt(dualHigh) + '\u00b0' + displayUnit;
      } else {
        var pct = spToPct(singleSP);
        var ang = ARC_START + pct * ARC_SWEEP;

        valueEl.setAttribute('stroke', col);
        valueEl.setAttribute('d',
          pct <= 0 ? '' :
          pct >= 1 ? arcPath(cx, cy, r, ARC_START, ARC_END - 0.5) :
                     arcPath(cx, cy, r, ARC_START, ang));

        value2El.style.display = 'none';
        spLabelEl.textContent  = 'Set ' + fmt(singleSP) + '\u00b0' + displayUnit;
      }
    }

    /* ------------------------------------------------------------------
       12. Setpoint adjusters
    ------------------------------------------------------------------ */
    function adjustSetpoint(delta) {
      singleSP = clamp(singleSP + delta);
      spLabelEl.textContent = 'Set ' + fmt(singleSP) + '\u00b0' + displayUnit;
      redraw();
      sendSingleTemp();
    }
    function adjustDualLow(delta) {
      dualLow = clamp(dualLow + delta);
      if (dualLow >= dualHigh) dualLow = clamp(dualHigh - cfgStep);
      redraw();
      sendDualTemp();
    }
    function adjustDualHigh(delta) {
      dualHigh = clamp(dualHigh + delta);
      if (dualHigh <= dualLow) dualHigh = clamp(dualLow + cfgStep);
      redraw();
      sendDualTemp();
    }

    /* ------------------------------------------------------------------
       13. Service calls
    ------------------------------------------------------------------ */
    function sendSingleTemp() {
      if (!w.entity) return;
      var eu  = getEU(latestState);
      var val = Math.round(toEU(singleSP, eu) * 2) / 2;
      handleAction({ type: 'service', service: 'climate.set_temperature',
        data: { entity_id: w.entity, temperature: val } });
    }
    function sendDualTemp() {
      if (!w.entity) return;
      var eu = getEU(latestState);
      handleAction({ type: 'service', service: 'climate.set_temperature',
        data: { entity_id: w.entity,
          target_temp_low:  Math.round(toEU(dualLow,  eu) * 2) / 2,
          target_temp_high: Math.round(toEU(dualHigh, eu) * 2) / 2 } });
    }
    function sendMode(mode) {
      if (!w.entity) return;
      handleAction({ type: 'service', service: 'climate.set_hvac_mode',
        data: { entity_id: w.entity, hvac_mode: mode } });
    }

    /* ------------------------------------------------------------------
       14. Apply state from entity
    ------------------------------------------------------------------ */
    var LABELS_MODE  = { heat:'Heat', cool:'Cool', heat_cool:'Heat/Cool',
                         auto:'Auto', dry:'Dry',   fan_only:'Fan', off:'Off' };
    var LABELS_FAN   = { auto:'Auto', low:'Low', medium:'Med', high:'High',
                         medium_high:'Med-Hi', quiet:'Quiet', 'on':'On', 'off':'Off' };
    var LABELS_SWING = { 'off':'Off', both:'Both', vertical:'Vertical',
                         horizontal:'Horizontal', upper:'Upper' };
    var ICONS_MODE   = { heat:'[mdi:fire]', cool:'[mdi:snowflake]',
                         heat_cool:'[mdi:autorenew]', auto:'[mdi:thermostat-auto]',
                         dry:'[mdi:water-percent]', fan_only:'[mdi:fan]', off:'[mdi:power]' };

    function applyState(state) {
      if (!state) return;
      var attrs = state.attributes || {};
      var eu    = getEU(state);

      /* Current temp */
      var cur = parseFloat(attrs.current_temperature);
      curNumEl.textContent = isNaN(cur) ? '--' : fmt(toDisplay(cur, eu));

      /* Mode */
      curMode = String(state.state || '').toLowerCase();
      var modeStr = LABELS_MODE[curMode] || curMode;
      modeLabelEl.textContent    = modeStr;
      modePill.line2.textContent = modeStr;
      setContent(modePill.icon, ICONS_MODE[curMode] || '[mdi:thermostat]');

      /* Fan */
      var fanVal = String(attrs.fan_mode || attrs.fan_speed || 'auto').toLowerCase();
      fanPill.line2.textContent = LABELS_FAN[fanVal] || fanVal;

      /* Swing */
      var swingVal = String(attrs.swing_mode || 'off').toLowerCase();
      swingPill.line2.textContent = LABELS_SWING[swingVal] || swingVal;

      /* Single vs dual */
      var newDual = curMode === 'heat_cool' &&
                    attrs.target_temp_low  !== undefined &&
                    attrs.target_temp_high !== undefined;
      if (newDual !== isDual) {
        isDual = newDual;
        minusBtn.style.display = plusBtn.style.display = isDual ? 'none' : 'flex';
        [minusBtnLo, plusBtnLo, minusBtnHi, plusBtnHi].forEach(function(b) {
          b.style.display = isDual ? 'flex' : 'none';
        });
      }

      if (isDual) {
        var rawLo = parseFloat(attrs.target_temp_low);
        var rawHi = parseFloat(attrs.target_temp_high);
        if (!isNaN(rawLo)) dualLow  = clamp(toDisplay(rawLo, eu));
        if (!isNaN(rawHi)) dualHigh = clamp(toDisplay(rawHi, eu));
      } else {
        var rawT = parseFloat(attrs.temperature);
        if (!isNaN(rawT)) singleSP = clamp(toDisplay(rawT, eu));
      }

      redraw();
    }

    /* ------------------------------------------------------------------
       15. Subscribe & initial paint
    ------------------------------------------------------------------ */
    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        latestState = state;
        applyState(state);
      });
      if (latestState) applyState(latestState);
    }

    redraw();
  }
