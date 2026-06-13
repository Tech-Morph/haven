/* ============================================================
   HAven - Thermostat Widget (renderThermostat)
   Drop this file's content into app.js where renderThermostat
   is referenced in the switch statement, or load it as a
   separate module and call it from there.

   Config keys:
     entity          - climate.* entity id (required)
     unit            - "F" (default) or "C"
     min             - minimum setpoint in display unit (default 64)
     max             - maximum setpoint in display unit (default 90)
     step            - setpoint step (default 1)
     mode_layout     - "chips" | "dropdown" | "none" (default "chips")
     line_width      - arc stroke width px (default 14)
     background      - widget background token (default "surface")
     color           - arc fill color token (default "primary")
     heat_color      - arc color when hvac_mode=heat (default "warning")
     cool_color      - arc color when hvac_mode=cool (default "primary")
     label_color     - sub-label color token (default "text_muted")
     radius          - corner radius of widget bg card (default 16)
   ============================================================ */

  // -- Thermostat --
  // Arc/gauge thermostat widget for HA climate entities.
  // Supports single and dual setpoint, HVAC mode chips/dropdown/none,
  // and F/C display with auto-conversion from entity's native unit.
  function renderThermostat(el, w) {
    el.className += ' widget-thermostat';

    // ---- Config resolution --------------------------------
    var displayUnit  = String(w.unit || 'F').toUpperCase();
    if (displayUnit !== 'C') displayUnit = 'F';

    var cfgMin  = (w.min  !== undefined) ? parseFloat(w.min)  : (displayUnit === 'C' ? 18  : 64);
    var cfgMax  = (w.max  !== undefined) ? parseFloat(w.max)  : (displayUnit === 'C' ? 32  : 90);
    var cfgStep = (w.step !== undefined) ? parseFloat(w.step) : 1;
    if (isNaN(cfgMin))  cfgMin  = (displayUnit === 'C' ? 18 : 64);
    if (isNaN(cfgMax))  cfgMax  = (displayUnit === 'C' ? 32 : 90);
    if (isNaN(cfgStep) || cfgStep <= 0) cfgStep = 1;
    if (cfgMax <= cfgMin) cfgMax = cfgMin + cfgStep;

    var modeLayout = String(w.mode_layout || 'chips').toLowerCase();
    if (modeLayout !== 'dropdown' && modeLayout !== 'none') modeLayout = 'chips';

    var lineWidth   = (w.line_width !== undefined) ? parseFloat(w.line_width) : 14;
    if (isNaN(lineWidth) || lineWidth < 4) lineWidth = 14;

    var bgColor     = w.background  || 'surface';
    var arcColor    = w.color       || 'primary';
    var heatColor   = w.heat_color  || 'warning';
    var coolColor   = w.cool_color  || 'primary';
    var lblColor    = w.label_color || 'text_muted';
    var cardRadius  = (w.radius !== undefined) ? w.radius : 16;

    // ---- Live state cache ---------------------------------
    var latestState = w.entity ? (entityStates[w.entity] || null) : null;

    // ---- Helper: convert to/from display unit -------------
    function toDisplay(valC_or_F, entityUnit) {
      // entityUnit: 'C' or 'F' as reported by HA attributes
      if (displayUnit === 'F' && entityUnit === 'C') {
        return valC_or_F * 9 / 5 + 32;
      }
      if (displayUnit === 'C' && entityUnit === 'F') {
        return (valC_or_F - 32) * 5 / 9;
      }
      return valC_or_F;
    }

    function toEntityUnit(displayVal, entityUnit) {
      if (displayUnit === 'F' && entityUnit === 'C') {
        return (displayVal - 32) * 5 / 9;
      }
      if (displayUnit === 'C' && entityUnit === 'F') {
        return displayVal * 9 / 5 + 32;
      }
      return displayVal;
    }

    function getEntityUnit(state) {
      if (!state || !state.attributes) return displayUnit;
      var u = String(state.attributes.temperature_unit || state.attributes.unit_of_measurement || displayUnit).toUpperCase();
      return (u === 'C' || u === '°C') ? 'C' : 'F';
    }

    function fmtTemp(val) {
      if (val === null || val === undefined || isNaN(val)) return '--';
      var rounded = Math.round(val * 10) / 10;
      return rounded + '°' + displayUnit;
    }

    // ---- Geometry -----------------------------------------
    var size = Math.min(w.w, w.h);
    var cx   = w.w / 2;
    var cy   = w.h / 2;
    var r    = (size / 2) - (lineWidth / 2) - 2;

    var START_ANG = 135;
    var END_ANG   = 405;

    // ---- Background card ----------------------------------
    el.style.background   = resolveColor(bgColor);
    el.style.borderRadius = cardRadius + 'px';
    el.style.overflow     = 'visible';

    // ---- SVG arc layer ------------------------------------
    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width',  w.w);
    svg.setAttribute('height', w.h);
    svg.style.position = 'absolute';
    svg.style.top  = '0';
    svg.style.left = '0';
    svg.style.overflow = 'visible';
    svg.style.pointerEvents = 'none';

    var trackPath = document.createElementNS(ns, 'path');
    trackPath.setAttribute('fill', 'none');
    trackPath.setAttribute('stroke', resolveColor('surface2'));
    trackPath.setAttribute('stroke-width', lineWidth);
    trackPath.setAttribute('stroke-linecap', 'round');
    trackPath.setAttribute('d', describeArc(cx, cy, r, START_ANG, END_ANG));
    svg.appendChild(trackPath);

    // Primary value arc (single or heat-low in dual mode)
    var valuePath = document.createElementNS(ns, 'path');
    valuePath.setAttribute('fill', 'none');
    valuePath.setAttribute('stroke-width', lineWidth);
    valuePath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(valuePath);

    // Secondary arc for heat_high in dual mode
    var valuePath2 = document.createElementNS(ns, 'path');
    valuePath2.setAttribute('fill', 'none');
    valuePath2.setAttribute('stroke-width', Math.round(lineWidth * 0.55));
    valuePath2.setAttribute('stroke-linecap', 'round');
    valuePath2.setAttribute('stroke-dasharray', '4 6');
    valuePath2.style.display = 'none';
    svg.appendChild(valuePath2);

    el.appendChild(svg);

    // ---- Centre label stack ------------------------------
    // Vertically centred inside the arc circle.
    // Layout (top→bottom): current temp | setpoint | mode icon
    var labelWrap = document.createElement('div');
    labelWrap.style.cssText = [
      'position:absolute',
      'top:0', 'left:0',
      'width:'  + w.w + 'px',
      'height:' + w.h + 'px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'pointer-events:none'
    ].join(';');

    var currentTempEl = document.createElement('div');
    currentTempEl.style.cssText = [
      'font-size:'   + Math.round(size * 0.18) + 'px',
      'font-weight:700',
      'line-height:1',
      'color:'       + resolveColor('text')
    ].join(';');
    currentTempEl.textContent = '--';
    labelWrap.appendChild(currentTempEl);

    var setpointEl = document.createElement('div');
    setpointEl.style.cssText = [
      'font-size:'   + Math.round(size * 0.11) + 'px',
      'font-weight:500',
      'line-height:1',
      'margin-top:4px',
      'color:'       + resolveColor(lblColor)
    ].join(';');
    setpointEl.textContent = 'Set --';
    labelWrap.appendChild(setpointEl);

    var modeIconEl = document.createElement('div');
    modeIconEl.style.cssText = [
      'font-size:'   + Math.round(size * 0.13) + 'px',
      'line-height:1',
      'margin-top:6px',
      'color:'       + resolveColor(lblColor)
    ].join(';');
    modeIconEl.textContent = '';
    labelWrap.appendChild(modeIconEl);

    el.appendChild(labelWrap);

    // ---- Mode icon map -----------------------------------
    var MODE_ICONS = {
      'heat':       '[mdi:fire]',
      'cool':       '[mdi:snowflake]',
      'heat_cool':  '[mdi:autorenew]',
      'auto':       '[mdi:thermostat-auto]',
      'dry':        '[mdi:water-percent]',
      'fan_only':   '[mdi:fan]',
      'off':        '[mdi:power]'
    };

    var MODE_LABELS = {
      'heat':       'Heat',
      'cool':       'Cool',
      'heat_cool':  'Heat/Cool',
      'auto':       'Auto',
      'dry':        'Dry',
      'fan_only':   'Fan',
      'off':        'Off'
    };

    function getModeArcColor(mode) {
      if (mode === 'heat')       return resolveColor(heatColor);
      if (mode === 'cool')       return resolveColor(coolColor);
      if (mode === 'heat_cool')  return resolveColor(heatColor);
      if (mode === 'auto')       return resolveColor(arcColor);
      if (mode === 'dry')        return resolveColor('warning');
      if (mode === 'fan_only')   return resolveColor('text_muted');
      return resolveColor('text_muted');
    }

    // ---- Setpoint controls (+ / − buttons + label) -------
    // Rendered below the arc, laid out in a row.
    // In dual mode: [heat_low row] and [heat_high row].
    var controlsWrap = document.createElement('div');
    controlsWrap.style.cssText = [
      'position:absolute',
      'left:0',
      'right:0',
      'bottom:' + Math.round(size * 0.04) + 'px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:4px'
    ].join(';');
    el.appendChild(controlsWrap);

    var btnSize     = Math.max(24, Math.round(size * 0.14));
    var btnFontSize = Math.round(btnSize * 0.55);
    var spLabelSize = Math.round(size * 0.09);

    function makeSetpointRow(labelText, onMinus, onPlus) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;pointer-events:auto;';

      var lbl = document.createElement('span');
      lbl.style.cssText = [
        'font-size:' + spLabelSize + 'px',
        'color:' + resolveColor(lblColor),
        'min-width:28px',
        'text-align:center'
      ].join(';');
      lbl.textContent = labelText;

      var btnMinus = makePlusMinusBtn('−', onMinus);
      var spValEl  = document.createElement('span');
      spValEl.style.cssText = [
        'font-size:' + Math.round(size * 0.10) + 'px',
        'font-weight:600',
        'color:' + resolveColor('text'),
        'min-width:' + Math.round(size * 0.22) + 'px',
        'text-align:center',
        'display:inline-block'
      ].join(';');
      spValEl.textContent = '--';
      var btnPlus = makePlusMinusBtn('+', onPlus);

      row.appendChild(lbl);
      row.appendChild(btnMinus);
      row.appendChild(spValEl);
      row.appendChild(btnPlus);
      return { row: row, valEl: spValEl };
    }

    function makePlusMinusBtn(label, handler) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = [
        'width:'          + btnSize + 'px',
        'height:'         + btnSize + 'px',
        'border:none',
        'border-radius:'  + Math.round(btnSize / 2) + 'px',
        'background:'     + resolveColor('surface2'),
        'color:'          + resolveColor('text'),
        'font-size:'      + btnFontSize + 'px',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:0',
        'font-family:inherit',
        'line-height:1'
      ].join(';');
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        handler();
        resetReturnTimer();
      });
      btn.addEventListener('mousedown',  function() { btn.style.opacity = '0.7'; });
      btn.addEventListener('mouseup',    function() { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', function() { btn.style.opacity = '1'; });
      btn.addEventListener('touchstart', function() { btn.style.opacity = '0.7'; }, { passive: true });
      btn.addEventListener('touchend',   function() { btn.style.opacity = '1'; });
      return btn;
    }

    // Single setpoint row
    var singleSetpoint = 72;
    var singleRow = makeSetpointRow('', function() { adjustSetpoint(-cfgStep); }, function() { adjustSetpoint(cfgStep); });
    controlsWrap.appendChild(singleRow.row);

    // Dual setpoint rows
    var dualLowSetpoint  = 68;
    var dualHighSetpoint = 76;
    var dualRowLow  = makeSetpointRow('Lo', function() { adjustDualLow(-cfgStep); },  function() { adjustDualLow(cfgStep); });
    var dualRowHigh = makeSetpointRow('Hi', function() { adjustDualHigh(-cfgStep); }, function() { adjustDualHigh(cfgStep); });
    controlsWrap.appendChild(dualRowLow.row);
    controlsWrap.appendChild(dualRowHigh.row);
    dualRowLow.row.style.display  = 'none';
    dualRowHigh.row.style.display = 'none';

    // ---- Mode selector -----------------------------------
    var modeWrap = document.createElement('div');
    modeWrap.style.cssText = [
      'position:absolute',
      'left:0',
      'right:0',
      'top:' + Math.round(size * 0.03) + 'px',
      'display:flex',
      'justify-content:center',
      'pointer-events:auto'
    ].join(';');
    if (modeLayout === 'none') modeWrap.style.display = 'none';
    el.appendChild(modeWrap);

    var modeDropdown = null;
    var modeChipsMap  = {};
    var currentModes  = [];
    var currentMode   = '';
    var isDual        = false;

    function buildModeChips(modes) {
      modeWrap.innerHTML = '';
      modeChipsMap = {};
      if (!modes || !modes.length) return;

      var chipH    = Math.max(20, Math.round(size * 0.08));
      var chipFont = Math.round(chipH * 0.58);

      var chipRow = document.createElement('div');
      chipRow.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:4px;padding:0 8px;';

      for (var i = 0; i < modes.length; i++) {
        (function(mode) {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.style.cssText = [
            'border:none',
            'border-radius:' + Math.round(chipH / 2) + 'px',
            'height:' + chipH + 'px',
            'padding:0 8px',
            'font-size:' + chipFont + 'px',
            'cursor:pointer',
            'font-family:inherit',
            'display:flex',
            'align-items:center',
            'gap:4px',
            'line-height:1'
          ].join(';');

          var iconSpan = document.createElement('span');
          setContent(iconSpan, MODE_ICONS[mode] || '[mdi:thermostat]');
          iconSpan.style.fontSize = chipFont + 'px';
          chip.appendChild(iconSpan);

          var lblSpan = document.createElement('span');
          lblSpan.textContent = MODE_LABELS[mode] || mode;
          chip.appendChild(lblSpan);

          chip.addEventListener('click', function(e) {
            e.stopPropagation();
            sendMode(mode);
            resetReturnTimer();
          });
          chip.addEventListener('mousedown',  function() { chip.style.opacity = '0.7'; });
          chip.addEventListener('mouseup',    function() { chip.style.opacity = '1'; });
          chip.addEventListener('mouseleave', function() { chip.style.opacity = '1'; });
          chip.addEventListener('touchstart', function() { chip.style.opacity = '0.7'; }, { passive: true });
          chip.addEventListener('touchend',   function() { chip.style.opacity = '1'; });

          chipRow.appendChild(chip);
          modeChipsMap[mode] = chip;
        })(modes[i]);
      }
      modeWrap.appendChild(chipRow);
    }

    function buildModeDropdown(modes) {
      modeWrap.innerHTML = '';
      if (!modes || !modes.length) return;

      var sel = document.createElement('select');
      sel.style.cssText = [
        'border:none',
        'border-radius:' + Math.round(size * 0.04) + 'px',
        'background:' + resolveColor('surface2'),
        'color:' + resolveColor('text'),
        'font-size:' + Math.round(size * 0.065) + 'px',
        'padding:2px 6px',
        'font-family:inherit',
        'cursor:pointer'
      ].join(';');

      for (var i = 0; i < modes.length; i++) {
        var opt = document.createElement('option');
        opt.value = modes[i];
        opt.textContent = MODE_LABELS[modes[i]] || modes[i];
        sel.appendChild(opt);
      }

      sel.addEventListener('change', function() {
        sendMode(sel.value);
        resetReturnTimer();
      });

      modeDropdown = sel;
      modeWrap.appendChild(sel);
    }

    function updateModeUI(mode, modes) {
      if (modeLayout === 'none') return;

      if (modeLayout === 'dropdown') {
        if (modeDropdown) {
          modeDropdown.value = mode || '';
        } else if (modes && modes.length) {
          buildModeDropdown(modes);
          if (modeDropdown) modeDropdown.value = mode || '';
        }
        return;
      }

      // chips
      var needRebuild = false;
      if (modes && modes.length !== currentModes.length) {
        needRebuild = true;
      } else if (modes) {
        for (var mi = 0; mi < modes.length; mi++) {
          if (modes[mi] !== currentModes[mi]) { needRebuild = true; break; }
        }
      }

      if (needRebuild && modes) {
        currentModes = modes.slice();
        buildModeChips(modes);
      }

      for (var mk in modeChipsMap) {
        if (!modeChipsMap.hasOwnProperty(mk)) continue;
        var chip = modeChipsMap[mk];
        var isActive = (mk === mode);
        chip.style.background = isActive ? getModeArcColor(mk) : resolveColor('surface2');
        chip.style.color      = isActive ? resolveColor('background') : resolveColor('text');
      }
    }

    // ---- Service calls -----------------------------------
    function sendTemperature(tempInDisplayUnit) {
      if (!w.entity) return;
      var state = latestState;
      var eu    = getEntityUnit(state);
      var val   = toEntityUnit(tempInDisplayUnit, eu);
      // Round to 1 decimal for HA
      val = Math.round(val * 2) / 2;

      var data = { entity_id: w.entity };
      if (isDual) {
        data.target_temp_low  = toEntityUnit(dualLowSetpoint,  eu);
        data.target_temp_high = toEntityUnit(dualHighSetpoint, eu);
      } else {
        data.temperature = val;
      }
      handleAction({
        type: 'service',
        service: 'climate.set_temperature',
        data: data
      });
    }

    function sendTemperatureDual() {
      if (!w.entity) return;
      var state = latestState;
      var eu    = getEntityUnit(state);
      var low  = Math.round(toEntityUnit(dualLowSetpoint,  eu) * 2) / 2;
      var high = Math.round(toEntityUnit(dualHighSetpoint, eu) * 2) / 2;
      handleAction({
        type: 'service',
        service: 'climate.set_temperature',
        data: { entity_id: w.entity, target_temp_low: low, target_temp_high: high }
      });
    }

    function sendMode(mode) {
      if (!w.entity) return;
      handleAction({
        type: 'service',
        service: 'climate.set_hvac_mode',
        data: { entity_id: w.entity, hvac_mode: mode }
      });
      currentMode = mode;
      updateModeUI(mode, null);
      redrawArc();
    }

    // ---- Setpoint adjusters ------------------------------
    function clampSetpoint(val) {
      val = Math.round(val / cfgStep) * cfgStep;
      if (val < cfgMin) val = cfgMin;
      if (val > cfgMax) val = cfgMax;
      return Math.round(val * 10) / 10;
    }

    function adjustSetpoint(delta) {
      singleSetpoint = clampSetpoint(singleSetpoint + delta);
      singleRow.valEl.textContent = fmtTemp(singleSetpoint);
      redrawArc();
      sendTemperature(singleSetpoint);
    }

    function adjustDualLow(delta) {
      dualLowSetpoint = clampSetpoint(dualLowSetpoint + delta);
      if (dualLowSetpoint > dualHighSetpoint - cfgStep) {
        dualLowSetpoint = dualHighSetpoint - cfgStep;
      }
      dualRowLow.valEl.textContent = fmtTemp(dualLowSetpoint);
      redrawArc();
      sendTemperatureDual();
    }

    function adjustDualHigh(delta) {
      dualHighSetpoint = clampSetpoint(dualHighSetpoint + delta);
      if (dualHighSetpoint < dualLowSetpoint + cfgStep) {
        dualHighSetpoint = dualLowSetpoint + cfgStep;
      }
      dualRowHigh.valEl.textContent = fmtTemp(dualHighSetpoint);
      redrawArc();
      sendTemperatureDual();
    }

    // ---- Arc draw ----------------------------------------
    function setpointToArcPct(sp) {
      var pct = (sp - cfgMin) / (cfgMax - cfgMin);
      if (pct < 0) pct = 0;
      if (pct > 1) pct = 1;
      return pct;
    }

    function redrawArc() {
      var color = getModeArcColor(currentMode);

      if (isDual) {
        var pctLow  = setpointToArcPct(dualLowSetpoint);
        var pctHigh = setpointToArcPct(dualHighSetpoint);
        var angLow  = START_ANG + pctLow  * (END_ANG - START_ANG);
        var angHigh = START_ANG + pctHigh * (END_ANG - START_ANG);

        // Primary arc: track up to heat_low
        valuePath.setAttribute('stroke', resolveColor(heatColor));
        if (pctLow <= 0) {
          valuePath.setAttribute('d', '');
        } else {
          valuePath.setAttribute('d', describeArc(cx, cy, r, START_ANG, angLow > START_ANG ? angLow : START_ANG + 0.01));
        }

        // Secondary dashed arc: heat_low → heat_high
        valuePath2.setAttribute('stroke', resolveColor(coolColor));
        valuePath2.style.display = '';
        if (pctHigh <= pctLow) {
          valuePath2.setAttribute('d', '');
        } else {
          valuePath2.setAttribute('d', describeArc(cx, cy, r, angLow, angHigh));
        }

        setpointEl.textContent = fmtTemp(dualLowSetpoint) + ' – ' + fmtTemp(dualHighSetpoint);
      } else {
        var pct = setpointToArcPct(singleSetpoint);
        var ang = START_ANG + pct * (END_ANG - START_ANG);

        valuePath.setAttribute('stroke', color);
        if (pct <= 0) {
          valuePath.setAttribute('d', '');
        } else if (pct >= 1) {
          valuePath.setAttribute('d', describeArc(cx, cy, r, START_ANG, END_ANG - 0.01));
        } else {
          valuePath.setAttribute('d', describeArc(cx, cy, r, START_ANG, ang));
        }

        valuePath2.style.display = 'none';
        setpointEl.textContent = 'Set ' + fmtTemp(singleSetpoint);
      }

      // Mode icon
      setContent(modeIconEl, MODE_ICONS[currentMode] || '');
      modeIconEl.style.color = color;
      currentTempEl.style.color = color;
    }

    // ---- State update ------------------------------------
    function applyState(state) {
      if (!state) return;
      var attrs = state.attributes || {};
      var eu    = getEntityUnit(state);

      // Current temperature
      var curRaw = parseFloat(attrs.current_temperature);
      if (!isNaN(curRaw)) {
        currentTempEl.textContent = fmtTemp(toDisplay(curRaw, eu));
      } else {
        currentTempEl.textContent = '--';
      }

      // HVAC mode
      var mode  = String(state.state || '').toLowerCase();
      currentMode = mode;

      // Available modes
      var availModes = attrs.hvac_modes || [];
      if (modeLayout !== 'none' && availModes.length) {
        updateModeUI(mode, availModes);
      } else {
        updateModeUI(mode, null);
      }

      // Detect dual setpoint
      var newDual = (mode === 'heat_cool' &&
        attrs.target_temp_low  !== undefined &&
        attrs.target_temp_high !== undefined);

      isDual = newDual;

      if (isDual) {
        var rawLow  = parseFloat(attrs.target_temp_low);
        var rawHigh = parseFloat(attrs.target_temp_high);
        if (!isNaN(rawLow))  dualLowSetpoint  = clampSetpoint(toDisplay(rawLow,  eu));
        if (!isNaN(rawHigh)) dualHighSetpoint = clampSetpoint(toDisplay(rawHigh, eu));
        dualRowLow.valEl.textContent  = fmtTemp(dualLowSetpoint);
        dualRowHigh.valEl.textContent = fmtTemp(dualHighSetpoint);
        singleRow.row.style.display   = 'none';
        dualRowLow.row.style.display  = '';
        dualRowHigh.row.style.display = '';
      } else {
        var rawTemp = parseFloat(attrs.temperature);
        if (!isNaN(rawTemp)) singleSetpoint = clampSetpoint(toDisplay(rawTemp, eu));
        singleRow.valEl.textContent   = fmtTemp(singleSetpoint);
        singleRow.row.style.display   = '';
        dualRowLow.row.style.display  = 'none';
        dualRowHigh.row.style.display = 'none';
      }

      redrawArc();
    }

    // ---- Register entity callback -----------------------
    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        latestState = state;
        applyState(state);
      });
      if (latestState) applyState(latestState);
    }

    // Initial draw (no state yet)
    redrawArc();
  }
