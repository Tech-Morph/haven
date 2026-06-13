/* ============================================================
   HAven - Thermostat Widget  (renderThermostat)
   Paste this function body into app.js at the thermostat case.

   IMPORTANT: HAven's layout engine sets el.style.left/top/width/height
   BEFORE calling this function (app.js lines ~965-968). Never overwrite
   those four properties here or the widget loses its x/y position.

   Layout (flex column, three non-overlapping zones):
     ┌─────────────────────────────────┐
     │  MODE ZONE  (chips / dropdown)  │  fixed height
     ├─────────────────────────────────┤
     │     ARC ZONE  (SVG gauge)       │  flex-grow:1
     │   centre: current temp          │
     │           setpoint label        │
     ├─────────────────────────────────┤
     │  CONTROLS ZONE  (− val +)       │  fixed height
     └─────────────────────────────────┘

   Config keys:
     entity        – climate.* entity id (required)
     unit          – "F" (default) or "C"
     min           – min setpoint in display unit (default 64°F / 18°C)
     max           – max setpoint in display unit (default 90°F / 32°C)
     step          – setpoint step (default 1)
     mode_layout   – "chips" | "dropdown" | "none"  (default "chips")
     line_width    – arc stroke width px (default 14)
     background    – bg color token (default "surface")
     color         – arc fill token  (default "primary")
     heat_color    – arc token for heat mode (default "warning")
     cool_color    – arc token for cool mode (default "primary")
     label_color   – sub-label token (default "text_muted")
     radius        – card corner radius px (default 16)
   ============================================================ */

  function renderThermostat(el, w) {
    el.className += ' widget-thermostat';

    /* --------------------------------------------------
       1. Config
    -------------------------------------------------- */
    var displayUnit = String(w.unit || 'F').toUpperCase();
    if (displayUnit !== 'C') displayUnit = 'F';

    var defMin  = displayUnit === 'C' ? 18  : 64;
    var defMax  = displayUnit === 'C' ? 32  : 90;
    var cfgMin  = w.min  !== undefined ? parseFloat(w.min)  : defMin;
    var cfgMax  = w.max  !== undefined ? parseFloat(w.max)  : defMax;
    var cfgStep = w.step !== undefined ? parseFloat(w.step) : 1;
    if (isNaN(cfgMin))                  cfgMin  = defMin;
    if (isNaN(cfgMax))                  cfgMax  = defMax;
    if (isNaN(cfgStep) || cfgStep <= 0) cfgStep = 1;
    if (cfgMax <= cfgMin)               cfgMax  = cfgMin + cfgStep;

    var modeLayout = String(w.mode_layout || 'chips').toLowerCase();
    if (modeLayout !== 'dropdown' && modeLayout !== 'none') modeLayout = 'chips';

    var lineWidth  = parseFloat(w.line_width) || 14;
    if (lineWidth < 4) lineWidth = 14;

    var bgColor    = w.background  || 'surface';
    var arcColor   = w.color       || 'primary';
    var heatColor  = w.heat_color  || 'warning';
    var coolColor  = w.cool_color  || 'primary';
    var lblColor   = w.label_color || 'text_muted';
    var cardRadius = w.radius !== undefined ? parseInt(w.radius, 10) : 16;

    /* --------------------------------------------------
       2. Helpers
    -------------------------------------------------- */
    var latestState = w.entity ? (entityStates[w.entity] || null) : null;

    function getEntityUnit(state) {
      if (!state || !state.attributes) return displayUnit;
      var raw = String(
        state.attributes.temperature_unit ||
        state.attributes.unit_of_measurement ||
        displayUnit
      ).replace('\u00b0', '').toUpperCase();
      return raw === 'C' ? 'C' : 'F';
    }

    function toDisplay(val, eu) {
      if (displayUnit === 'F' && eu === 'C') return val * 9 / 5 + 32;
      if (displayUnit === 'C' && eu === 'F') return (val - 32) * 5 / 9;
      return val;
    }

    function toEntityUnit(val, eu) {
      if (displayUnit === 'F' && eu === 'C') return (val - 32) * 5 / 9;
      if (displayUnit === 'C' && eu === 'F') return val * 9 / 5 + 32;
      return val;
    }

    function fmtTemp(val) {
      if (val === null || val === undefined || isNaN(val)) return '--';
      return (Math.round(val * 10) / 10) + '\u00b0' + displayUnit;
    }

    function clampSetpoint(val) {
      val = Math.round(val / cfgStep) * cfgStep;
      if (val < cfgMin) val = cfgMin;
      if (val > cfgMax) val = cfgMax;
      return Math.round(val * 10) / 10;
    }

    /* resolveColor shorthand */
    function rc(token) { return resolveColor(token); }

    /* Fallback surface token: try surface_2 then surface2 */
    function rcSurface2() {
      return rc('surface_2') || rc('surface2') || 'rgba(255,255,255,0.10)';
    }

    var MODE_ICONS = {
      heat: '[mdi:fire]', cool: '[mdi:snowflake]', heat_cool: '[mdi:autorenew]',
      auto: '[mdi:thermostat-auto]', dry: '[mdi:water-percent]',
      fan_only: '[mdi:fan]', off: '[mdi:power]'
    };
    var MODE_LABELS = {
      heat: 'Heat', cool: 'Cool', heat_cool: 'Heat/Cool',
      auto: 'Auto', dry: 'Dry',  fan_only: 'Fan', off: 'Off'
    };

    function getModeColor(mode) {
      if (mode === 'heat' || mode === 'heat_cool') return rc(heatColor);
      if (mode === 'cool')   return rc(coolColor);
      if (mode === 'auto')   return rc(arcColor);
      if (mode === 'dry')    return rc('warning');
      return rc('text_muted');
    }

    /* --------------------------------------------------
       3. Zone height budget
       Use w.w / w.h (the config dimensions the engine used).
       DO NOT write these back to el.style - engine already did that.
    -------------------------------------------------- */
    var wW = w.w;
    var wH = w.h;

    var modeZoneH    = modeLayout === 'none' ? 0 : Math.round(wH * 0.18);
    var ctrlZoneH    = Math.round(wH * 0.22);
    var arcZoneH     = wH - modeZoneH - ctrlZoneH;
    if (arcZoneH < 40) arcZoneH = 40;

    /* --------------------------------------------------
       4. Root element styling
       ONLY set: position, display, flex-direction, background,
       border-radius, overflow, box-sizing.
       NEVER set: left, top, width, height  (engine owns those).
    -------------------------------------------------- */
    el.style.position     = 'relative';
    el.style.overflow     = 'hidden';
    el.style.display      = 'flex';
    el.style.flexDirection = 'column';
    el.style.boxSizing    = 'border-box';
    el.style.background   = rc(bgColor);
    el.style.borderRadius = cardRadius + 'px';
    /* Note: el already has position:absolute + left/top/width/height from
       the engine. Adding position:relative here overrides that and breaks
       layout. Use position:absolute and rely on flex children for internal
       layout. Reset: */
    el.style.position = 'absolute';  /* keep engine's absolute positioning */

    /* --------------------------------------------------
       5. MODE ZONE
    -------------------------------------------------- */
    var modeZone = document.createElement('div');
    modeZone.style.cssText = [
      'flex:0 0 ' + modeZoneH + 'px',
      'display:' + (modeLayout === 'none' ? 'none' : 'flex'),
      'align-items:center',
      'justify-content:center',
      'overflow:hidden',
      'width:100%',
      'padding:0 6px',
      'box-sizing:border-box'
    ].join(';');
    el.appendChild(modeZone);

    /* --------------------------------------------------
       6. ARC ZONE
    -------------------------------------------------- */
    var arcZone = document.createElement('div');
    arcZone.style.cssText = [
      'position:relative',
      'flex:1 1 0',
      'min-height:0',
      'width:100%',
      'overflow:hidden'
    ].join(';');
    el.appendChild(arcZone);

    /* Geometry: arc fitted inside the arc zone */
    var arcW = wW;
    var arcH = arcZoneH;
    var size = Math.min(arcW, arcH);
    var cx   = arcW / 2;
    var cy   = arcH / 2;
    var r    = (size / 2) - (lineWidth / 2) - 4;
    if (r < 8) r = 8;

    var START_ANG = 135;
    var END_ANG   = 405;

    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width',  arcW);
    svg.setAttribute('height', arcH);
    svg.style.cssText = 'display:block;position:absolute;top:0;left:0;pointer-events:none;';
    arcZone.appendChild(svg);

    /* Track ring */
    var trackPath = document.createElementNS(ns, 'path');
    trackPath.setAttribute('fill',          'none');
    trackPath.setAttribute('stroke',         rcSurface2());
    trackPath.setAttribute('stroke-width',   lineWidth);
    trackPath.setAttribute('stroke-linecap', 'round');
    trackPath.setAttribute('d', describeArc(cx, cy, r, START_ANG, END_ANG));
    svg.appendChild(trackPath);

    /* Value arc - primary / single / heat-low */
    var valuePath = document.createElementNS(ns, 'path');
    valuePath.setAttribute('fill',          'none');
    valuePath.setAttribute('stroke-width',   lineWidth);
    valuePath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(valuePath);

    /* Value arc 2 - heat-high in dual mode (dashed, thinner) */
    var valuePath2 = document.createElementNS(ns, 'path');
    valuePath2.setAttribute('fill',           'none');
    valuePath2.setAttribute('stroke-width',    Math.max(4, Math.round(lineWidth * 0.6)));
    valuePath2.setAttribute('stroke-linecap',  'round');
    valuePath2.setAttribute('stroke-dasharray','5 7');
    valuePath2.style.display = 'none';
    svg.appendChild(valuePath2);

    /* Centre label - absolutely centred inside arcZone */
    var labelDiv = document.createElement('div');
    labelDiv.style.cssText = [
      'position:absolute',
      'top:0', 'left:0',
      'width:100%',
      'height:100%',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'text-align:center',
      'pointer-events:none'
    ].join(';');
    arcZone.appendChild(labelDiv);

    var fsCur = Math.max(14, Math.round(size * 0.20));
    var fsSP  = Math.max(10, Math.round(size * 0.11));

    var currentTempEl = document.createElement('div');
    currentTempEl.style.cssText = [
      'font-size:'   + fsCur + 'px',
      'font-weight:700',
      'line-height:1',
      'color:'       + rc('text')
    ].join(';');
    currentTempEl.textContent = '--';
    labelDiv.appendChild(currentTempEl);

    var setpointLabelEl = document.createElement('div');
    setpointLabelEl.style.cssText = [
      'font-size:'   + fsSP + 'px',
      'font-weight:500',
      'line-height:1',
      'margin-top:4px',
      'color:'       + rc(lblColor)
    ].join(';');
    setpointLabelEl.textContent = 'Set --';
    labelDiv.appendChild(setpointLabelEl);

    /* --------------------------------------------------
       7. CONTROLS ZONE
    -------------------------------------------------- */
    var ctrlZone = document.createElement('div');
    ctrlZone.style.cssText = [
      'flex:0 0 ' + ctrlZoneH + 'px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:4px',
      'width:100%',
      'box-sizing:border-box',
      'padding:0 6px 4px 6px'
    ].join(';');
    el.appendChild(ctrlZone);

    var btnSize  = Math.max(22, Math.round(ctrlZoneH * 0.44));
    var btnFS    = Math.round(btnSize * 0.56);
    var valFS    = Math.max(10, Math.round(ctrlZoneH * 0.30));
    var rowLblFS = Math.max(9,  Math.round(ctrlZoneH * 0.22));

    function makePMBtn(label, handler) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = [
        'flex:0 0 auto',
        'width:'         + btnSize + 'px',
        'height:'        + btnSize + 'px',
        'border:none',
        'border-radius:' + Math.round(btnSize / 2) + 'px',
        'background:'    + rcSurface2(),
        'color:'         + rc('text'),
        'font-size:'     + btnFS + 'px',
        'font-family:inherit',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:0',
        'line-height:1',
        'user-select:none',
        '-webkit-user-select:none'
      ].join(';');
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        handler();
        if (typeof resetReturnTimer === 'function') resetReturnTimer();
      });
      btn.addEventListener('mousedown',  function() { btn.style.opacity = '0.6'; });
      btn.addEventListener('mouseup',    function() { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', function() { btn.style.opacity = '1'; });
      btn.addEventListener('touchstart', function() { btn.style.opacity = '0.6'; }, { passive: true });
      btn.addEventListener('touchend',   function() { btn.style.opacity = '1'; });
      return btn;
    }

    function makeCtrlRow(rowLabel, onMinus, onPlus) {
      var row = document.createElement('div');
      row.style.cssText = [
        'display:flex',
        'flex-direction:row',
        'align-items:center',
        'justify-content:center',
        'gap:8px',
        'width:100%'
      ].join(';');

      var lbl = document.createElement('span');
      lbl.style.cssText = [
        'font-size:' + rowLblFS + 'px',
        'color:'     + rc(lblColor),
        'min-width:16px',
        'text-align:left',
        'flex-shrink:0'
      ].join(';');
      lbl.textContent = rowLabel || '';

      var btnMinus = makePMBtn('\u2212', onMinus);

      var valEl = document.createElement('span');
      valEl.style.cssText = [
        'font-size:'    + valFS + 'px',
        'font-weight:600',
        'color:'        + rc('text'),
        'min-width:'    + Math.round(wW * 0.26) + 'px',
        'text-align:center',
        'flex-shrink:0',
        'display:inline-block'
      ].join(';');
      valEl.textContent = '--';

      var btnPlus = makePMBtn('+', onPlus);

      row.appendChild(lbl);
      row.appendChild(btnMinus);
      row.appendChild(valEl);
      row.appendChild(btnPlus);
      return { row: row, valEl: valEl };
    }

    /* Single setpoint row */
    var singleSetpoint = Math.round((cfgMin + cfgMax) / 2);
    var singleCtrl = makeCtrlRow('',
      function() { adjustSetpoint(-cfgStep); },
      function() { adjustSetpoint(cfgStep);  });
    ctrlZone.appendChild(singleCtrl.row);

    /* Dual setpoint rows */
    var dualLow  = clampSetpoint(cfgMin + (cfgMax - cfgMin) * 0.35);
    var dualHigh = clampSetpoint(cfgMin + (cfgMax - cfgMin) * 0.65);
    var dualCtrlLow  = makeCtrlRow('Lo',
      function() { adjustDualLow(-cfgStep);  },
      function() { adjustDualLow(cfgStep);   });
    var dualCtrlHigh = makeCtrlRow('Hi',
      function() { adjustDualHigh(-cfgStep); },
      function() { adjustDualHigh(cfgStep);  });
    ctrlZone.appendChild(dualCtrlLow.row);
    ctrlZone.appendChild(dualCtrlHigh.row);
    dualCtrlLow.row.style.display  = 'none';
    dualCtrlHigh.row.style.display = 'none';

    /* --------------------------------------------------
       8. Mode selector
    -------------------------------------------------- */
    var modeDropdown = null;
    var modeChipsMap = {};
    var currentModes = [];
    var currentMode  = '';
    var isDual       = false;

    var chipH  = Math.max(18, Math.round(modeZoneH * 0.62));
    var chipFS = Math.max(9,  Math.round(chipH * 0.56));

    function buildChips(modes) {
      modeZone.innerHTML = '';
      modeChipsMap = {};
      if (!modes || !modes.length) return;

      var row = document.createElement('div');
      row.style.cssText = [
        'display:flex',
        'flex-wrap:wrap',
        'justify-content:center',
        'align-items:center',
        'gap:3px',
        'width:100%'
      ].join(';');

      modes.forEach(function(mode) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.style.cssText = [
          'border:none',
          'border-radius:' + Math.round(chipH / 2) + 'px',
          'height:'        + chipH + 'px',
          'padding:0 7px',
          'font-size:'     + chipFS + 'px',
          'font-family:inherit',
          'cursor:pointer',
          'display:flex',
          'align-items:center',
          'gap:3px',
          'line-height:1',
          'white-space:nowrap',
          'user-select:none',
          '-webkit-user-select:none'
        ].join(';');

        var iconEl = document.createElement('span');
        setContent(iconEl, MODE_ICONS[mode] || '[mdi:thermostat]');
        iconEl.style.fontSize = chipFS + 'px';
        chip.appendChild(iconEl);

        var txtEl = document.createElement('span');
        txtEl.textContent = MODE_LABELS[mode] || mode;
        chip.appendChild(txtEl);

        chip.addEventListener('click', function(e) {
          e.stopPropagation();
          sendMode(mode);
          if (typeof resetReturnTimer === 'function') resetReturnTimer();
        });
        chip.addEventListener('mousedown',  function() { chip.style.opacity = '0.6'; });
        chip.addEventListener('mouseup',    function() { chip.style.opacity = '1'; });
        chip.addEventListener('mouseleave', function() { chip.style.opacity = '1'; });
        chip.addEventListener('touchstart', function() { chip.style.opacity = '0.6'; }, { passive: true });
        chip.addEventListener('touchend',   function() { chip.style.opacity = '1'; });

        row.appendChild(chip);
        modeChipsMap[mode] = chip;
      });

      modeZone.appendChild(row);
    }

    function buildDropdown(modes) {
      modeZone.innerHTML = '';
      if (!modes || !modes.length) return;

      var sel = document.createElement('select');
      sel.style.cssText = [
        'border:none',
        'border-radius:6px',
        'background:' + rcSurface2(),
        'color:'      + rc('text'),
        'font-size:'  + Math.max(10, Math.round(modeZoneH * 0.40)) + 'px',
        'padding:2px 8px',
        'font-family:inherit',
        'cursor:pointer',
        'max-width:'  + (wW - 16) + 'px'
      ].join(';');

      modes.forEach(function(mode) {
        var opt = document.createElement('option');
        opt.value = mode;
        opt.textContent = MODE_LABELS[mode] || mode;
        sel.appendChild(opt);
      });

      sel.addEventListener('change', function() {
        sendMode(sel.value);
        if (typeof resetReturnTimer === 'function') resetReturnTimer();
      });
      modeDropdown = sel;
      modeZone.appendChild(sel);
    }

    function styleChips(activeMode) {
      for (var mk in modeChipsMap) {
        if (!modeChipsMap.hasOwnProperty(mk)) continue;
        var chip = modeChipsMap[mk];
        var active = (mk === activeMode);
        chip.style.background = active ? getModeColor(mk) : rcSurface2();
        chip.style.color      = active ? '#ffffff' : rc('text');
      }
    }

    function updateModeUI(mode, modes) {
      if (modeLayout === 'none') return;

      if (modeLayout === 'dropdown') {
        if (!modeDropdown && modes && modes.length) buildDropdown(modes);
        if (modeDropdown) modeDropdown.value = mode || '';
        return;
      }

      /* chips - rebuild if mode list changed */
      var needRebuild = !currentModes.length;
      if (!needRebuild && modes) {
        if (modes.length !== currentModes.length) {
          needRebuild = true;
        } else {
          for (var i = 0; i < modes.length; i++) {
            if (modes[i] !== currentModes[i]) { needRebuild = true; break; }
          }
        }
      }
      if (needRebuild && modes && modes.length) {
        currentModes = modes.slice();
        buildChips(modes);
      }
      styleChips(mode);
    }

    /* --------------------------------------------------
       9. Arc drawing
    -------------------------------------------------- */
    function spToPct(sp) {
      var p = (sp - cfgMin) / (cfgMax - cfgMin);
      return p < 0 ? 0 : p > 1 ? 1 : p;
    }

    function redrawArc() {
      var color = getModeColor(currentMode);
      currentTempEl.style.color = color;

      if (isDual) {
        var pLo = spToPct(dualLow);
        var pHi = spToPct(dualHigh);
        var aLo = START_ANG + pLo * (END_ANG - START_ANG);
        var aHi = START_ANG + pHi * (END_ANG - START_ANG);

        valuePath.setAttribute('stroke', getModeColor('heat'));
        valuePath.setAttribute('d',
          pLo <= 0
            ? ''
            : describeArc(cx, cy, r, START_ANG, Math.max(START_ANG + 0.5, aLo)));

        valuePath2.setAttribute('stroke', getModeColor('cool'));
        valuePath2.style.display = '';
        valuePath2.setAttribute('d',
          pHi <= pLo ? '' : describeArc(cx, cy, r, aLo, aHi));

        setpointLabelEl.textContent = fmtTemp(dualLow) + ' \u2013 ' + fmtTemp(dualHigh);
      } else {
        var pct = spToPct(singleSetpoint);
        var ang = START_ANG + pct * (END_ANG - START_ANG);

        valuePath.setAttribute('stroke', color);
        valuePath.setAttribute('d',
          pct <= 0 ? '' :
          pct >= 1 ? describeArc(cx, cy, r, START_ANG, END_ANG - 0.5) :
                     describeArc(cx, cy, r, START_ANG, ang));

        valuePath2.style.display = 'none';
        setpointLabelEl.textContent = 'Set ' + fmtTemp(singleSetpoint);
      }
    }

    /* --------------------------------------------------
       10. Service calls
    -------------------------------------------------- */
    function sendSingleTemp() {
      if (!w.entity) return;
      var eu  = getEntityUnit(latestState);
      var val = Math.round(toEntityUnit(singleSetpoint, eu) * 2) / 2;
      handleAction({ type: 'service', service: 'climate.set_temperature',
        data: { entity_id: w.entity, temperature: val } });
    }

    function sendDualTemp() {
      if (!w.entity) return;
      var eu = getEntityUnit(latestState);
      handleAction({ type: 'service', service: 'climate.set_temperature',
        data: {
          entity_id:        w.entity,
          target_temp_low:  Math.round(toEntityUnit(dualLow,  eu) * 2) / 2,
          target_temp_high: Math.round(toEntityUnit(dualHigh, eu) * 2) / 2
        }
      });
    }

    function sendMode(mode) {
      if (!w.entity) return;
      handleAction({ type: 'service', service: 'climate.set_hvac_mode',
        data: { entity_id: w.entity, hvac_mode: mode } });
      currentMode = mode;
      styleChips(mode);
      redrawArc();
    }

    /* --------------------------------------------------
       11. Setpoint adjusters
    -------------------------------------------------- */
    function adjustSetpoint(delta) {
      singleSetpoint = clampSetpoint(singleSetpoint + delta);
      singleCtrl.valEl.textContent = fmtTemp(singleSetpoint);
      redrawArc();
      sendSingleTemp();
    }

    function adjustDualLow(delta) {
      dualLow = clampSetpoint(dualLow + delta);
      if (dualLow >= dualHigh) dualLow = clampSetpoint(dualHigh - cfgStep);
      dualCtrlLow.valEl.textContent = fmtTemp(dualLow);
      redrawArc();
      sendDualTemp();
    }

    function adjustDualHigh(delta) {
      dualHigh = clampSetpoint(dualHigh + delta);
      if (dualHigh <= dualLow) dualHigh = clampSetpoint(dualLow + cfgStep);
      dualCtrlHigh.valEl.textContent = fmtTemp(dualHigh);
      redrawArc();
      sendDualTemp();
    }

    /* --------------------------------------------------
       12. State application
    -------------------------------------------------- */
    function applyState(state) {
      if (!state) return;
      var attrs = state.attributes || {};
      var eu    = getEntityUnit(state);

      var curRaw = parseFloat(attrs.current_temperature);
      currentTempEl.textContent = isNaN(curRaw)
        ? '--'
        : fmtTemp(toDisplay(curRaw, eu));

      currentMode = String(state.state || '').toLowerCase();

      var availModes = attrs.hvac_modes || [];
      updateModeUI(currentMode, availModes.length ? availModes : null);

      var newDual = (currentMode === 'heat_cool' &&
                    attrs.target_temp_low  !== undefined &&
                    attrs.target_temp_high !== undefined);

      if (newDual !== isDual) {
        isDual = newDual;
        singleCtrl.row.style.display   = isDual ? 'none' : 'flex';
        dualCtrlLow.row.style.display  = isDual ? 'flex' : 'none';
        dualCtrlHigh.row.style.display = isDual ? 'flex' : 'none';
      }

      if (isDual) {
        var rawLo = parseFloat(attrs.target_temp_low);
        var rawHi = parseFloat(attrs.target_temp_high);
        if (!isNaN(rawLo)) dualLow  = clampSetpoint(toDisplay(rawLo, eu));
        if (!isNaN(rawHi)) dualHigh = clampSetpoint(toDisplay(rawHi, eu));
        dualCtrlLow.valEl.textContent  = fmtTemp(dualLow);
        dualCtrlHigh.valEl.textContent = fmtTemp(dualHigh);
      } else {
        var rawT = parseFloat(attrs.temperature);
        if (!isNaN(rawT)) singleSetpoint = clampSetpoint(toDisplay(rawT, eu));
        singleCtrl.valEl.textContent = fmtTemp(singleSetpoint);
      }

      redrawArc();
    }

    /* --------------------------------------------------
       13. Entity subscription
    -------------------------------------------------- */
    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        latestState = state;
        applyState(state);
      });
      if (latestState) applyState(latestState);
    }

    /* Initial paint */
    singleCtrl.valEl.textContent      = fmtTemp(singleSetpoint);
    dualCtrlLow.valEl.textContent     = fmtTemp(dualLow);
    dualCtrlHigh.valEl.textContent    = fmtTemp(dualHigh);
    redrawArc();
  }
