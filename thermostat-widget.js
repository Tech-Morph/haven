/* ============================================================
   HAven - Thermostat Widget  v10

   Changes vs v9:
     - ALL container divs (root, arcZone, pillsZone, centreDiv,
       txtWrap) have background:transparent / none explicitly set
     - overflow:hidden removed from root and arcZone so no
       invisible box clips/shows through
     - Pills and buttons keep their rgba(255,255,255,0.10) face
       so they still look like tappable elements, but the
       surrounding area is fully see-through
     - bgToken path still lets user opt-in to a solid card bg

   RULE: Never write el.style.left/top/width/height - engine owns those.
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

    var lineWidth  = Math.min(14, Math.max(4, parseFloat(w.line_width) || 12));
    var bgToken    = w.background || null;
    var arcToken   = w.color       || 'primary';
    var heatToken  = w.heat_color  || 'warning';
    var coolToken  = w.cool_color  || 'primary';
    var lblToken   = w.label_color || 'text_muted';
    var cardRadius = isNaN(parseInt(w.radius, 10)) ? 16 : parseInt(w.radius, 10);

    /* ------------------------------------------------------------------
       2.  Helpers
    ------------------------------------------------------------------ */
    function rc(tok) { return resolveColor(tok); }
    function rcEl()    { return 'rgba(255,255,255,0.10)'; }
    function rcTrack() { return 'rgba(255,255,255,0.18)'; }
    function rcMuted() {
      var v = rc(lblToken);
      return (v && v !== 'undefined' && v !== 'null') ? v : 'rgba(255,255,255,0.70)';
    }
    function rcText() {
      var v = rc('text');
      return (v && v !== 'undefined' && v !== 'null') ? v : '#ffffff';
    }

    var latestState = w.entity ? (entityStates[w.entity] || null) : null;

    function getEU(state) {
      if (!state || !state.attributes) return displayUnit;
      var raw = String(
        state.attributes.temperature_unit ||
        state.attributes.unit_of_measurement || displayUnit
      ).replace('\u00b0','').toUpperCase();
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
    ------------------------------------------------------------------ */
    var ARC_START = 135;
    var ARC_SWEEP = 270;
    var ARC_END   = ARC_START + ARC_SWEEP;

    function polar(cx, cy, r, deg) {
      var rad = deg * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }
    function arcPath(cx, cy, r, startDeg, endDeg) {
      var sweep = endDeg - startDeg;
      while (sweep <= 0)  sweep += 360;
      while (sweep > 360) sweep -= 360;
      if (sweep < 0.1) return '';
      var s = polar(cx, cy, r, startDeg);
      var e = polar(cx, cy, r, endDeg);
      return ['M',s.x,s.y,'A',r,r,0,(sweep>180?1:0),1,e.x,e.y].join(' ');
    }

    /* ------------------------------------------------------------------
       3.  Dimensions
    ------------------------------------------------------------------ */
    var wW = w.w, wH = w.h;
    var pillH    = Math.max(32, Math.round(wH * 0.16));
    var pillGap  = 4;
    var arcZoneH = wH - pillH - pillGap;
    var margin   = lineWidth + 6;
    var r  = Math.min(wW / 2, arcZoneH * 0.46) - margin;
    if (r < 12) r = 12;
    var cx = wW / 2;
    var cy = arcZoneH * 0.48;
    var circleBottom = cy + r;

    /* ------------------------------------------------------------------
       4.  Root element — transparent, no overflow clip
    ------------------------------------------------------------------ */
    el.style.position        = 'absolute';
    el.style.display         = 'flex';
    el.style.flexDirection   = 'column';
    el.style.boxSizing       = 'border-box';
    el.style.userSelect      = 'none';
    el.style.overflow        = 'visible';   /* no invisible box */
    if (bgToken) {
      el.style.background    = rc(bgToken);
      el.style.borderRadius  = cardRadius + 'px';
      el.style.overflow      = 'hidden';
    } else {
      el.style.background    = 'transparent';
      el.style.borderRadius  = '0';
    }

    /* ------------------------------------------------------------------
       5.  Arc zone — transparent, no overflow clip
    ------------------------------------------------------------------ */
    var arcZone = document.createElement('div');
    arcZone.style.cssText = [
      'position:relative',
      'flex:0 0 ' + arcZoneH + 'px',
      'width:100%',
      'background:transparent',
      'overflow:visible'
    ].join(';');
    el.appendChild(arcZone);

    /* SVG */
    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width',  wW);
    svg.setAttribute('height', arcZoneH);
    svg.style.cssText = 'display:block;position:absolute;top:0;left:0;pointer-events:none;overflow:visible;background:transparent;';
    arcZone.appendChild(svg);

    var trackEl = document.createElementNS(ns, 'path');
    trackEl.setAttribute('fill','none');
    trackEl.setAttribute('stroke', rcTrack());
    trackEl.setAttribute('stroke-width', lineWidth);
    trackEl.setAttribute('stroke-linecap','round');
    trackEl.setAttribute('d', arcPath(cx, cy, r, ARC_START, ARC_END));
    svg.appendChild(trackEl);

    var valueEl = document.createElementNS(ns, 'path');
    valueEl.setAttribute('fill','none');
    valueEl.setAttribute('stroke-width', lineWidth);
    valueEl.setAttribute('stroke-linecap','round');
    valueEl.setAttribute('stroke', rc(arcToken));
    svg.appendChild(valueEl);

    var value2El = document.createElementNS(ns, 'path');
    value2El.setAttribute('fill','none');
    value2El.setAttribute('stroke-width', Math.max(4, Math.round(lineWidth * 0.6)));
    value2El.setAttribute('stroke-linecap','round');
    value2El.setAttribute('stroke-dasharray','5 7');
    value2El.style.display = 'none';
    svg.appendChild(value2El);

    /* ------------------------------------------------------------------
       6.  Centre label overlay — transparent
    ------------------------------------------------------------------ */
    var centreDiv = document.createElement('div');
    centreDiv.style.cssText = [
      'position:absolute','top:0','left:0',
      'width:100%','height:100%',
      'display:flex','flex-direction:column',
      'align-items:center','justify-content:center',
      'text-align:center','pointer-events:none',
      'background:transparent',
      'padding-bottom:' + Math.round(arcZoneH * 0.10) + 'px'
    ].join(';');
    arcZone.appendChild(centreDiv);

    var fsModeLabel = Math.max(9, Math.round(wW * 0.075));
    var modeLabelEl = document.createElement('div');
    modeLabelEl.style.cssText = [
      'font-size:'     + fsModeLabel + 'px',
      'font-weight:500',
      'color:'         + rcMuted(),
      'line-height:1.2',
      'letter-spacing:0.04em',
      'text-transform:capitalize',
      'background:transparent'
    ].join(';');
    modeLabelEl.textContent = 'Off';
    centreDiv.appendChild(modeLabelEl);

    var fsCur  = Math.max(24, Math.round(wW * 0.22));
    var fsUnit = Math.max(11, Math.round(fsCur * 0.36));
    var curWrap = document.createElement('div');
    curWrap.style.cssText = [
      'display:flex','align-items:flex-start','justify-content:center',
      'line-height:1','margin-top:2px','background:transparent'
    ].join(';');

    var curNumEl = document.createElement('span');
    curNumEl.style.cssText = [
      'font-size:'         + fsCur + 'px',
      'font-weight:700',
      'letter-spacing:-0.02em',
      'color:'             + rcText(),
      'background:transparent'
    ].join(';');
    curNumEl.textContent = '--';
    curWrap.appendChild(curNumEl);

    var curUnitEl = document.createElement('span');
    curUnitEl.style.cssText = [
      'font-size:'   + fsUnit + 'px',
      'font-weight:600',
      'color:'       + rcMuted(),
      'margin-top:'  + Math.round(fsCur * 0.08) + 'px',
      'margin-left:2px',
      'background:transparent'
    ].join(';');
    curUnitEl.textContent = '\u00b0' + displayUnit;
    curWrap.appendChild(curUnitEl);
    centreDiv.appendChild(curWrap);

    var fsSP = Math.max(8, Math.round(wW * 0.07));
    var spLabelEl = document.createElement('div');
    spLabelEl.style.cssText = [
      'font-size:'  + fsSP + 'px',
      'font-weight:500',
      'color:'      + rcMuted(),
      'margin-top:3px',
      'line-height:1',
      'background:transparent'
    ].join(';');
    spLabelEl.textContent = 'Set --';
    centreDiv.appendChild(spLabelEl);

    /* ------------------------------------------------------------------
       7.  +/- buttons
    ------------------------------------------------------------------ */
    var btnSize    = Math.max(22, Math.round(wW * 0.13));
    var btnFS      = Math.max(13, Math.round(btnSize * 0.50));
    var btnSpacing = Math.round(wW * 0.12);
    var btnNudge   = Math.round(arcZoneH * 0.05);
    var btnY = Math.round(circleBottom - btnSize * 0.5) + btnNudge;
    if (btnY + btnSize > arcZoneH - 2) btnY = arcZoneH - btnSize - 2;
    if (btnY < 2) btnY = 2;

    function makePMBtn(label, onclick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = [
        'position:absolute',
        'width:'         + btnSize + 'px',
        'height:'        + btnSize + 'px',
        'border-radius:' + Math.round(btnSize / 2) + 'px',
        'border:1px solid rgba(255,255,255,0.22)',
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
       8.  Pills zone — transparent background
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
      'width:100%',
      'background:transparent'
    ].join(';');
    el.appendChild(pillsZone);

    var pillFS1    = Math.max(7,  Math.round(pillH * 0.22));
    var pillFS2    = Math.max(8,  Math.round(pillH * 0.26));
    var pillIconFS = Math.max(9,  Math.round(pillH * 0.32));

    function makePill(iconStr, topText, bottomText) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.style.cssText = [
        'flex:1 1 0',
        'min-width:0',
        'border:1px solid rgba(255,255,255,0.14)',
        'border-radius:' + Math.round(pillH * 0.3) + 'px',
        'background:'    + rcEl(),
        'color:'         + rcText(),
        'display:flex',
        'flex-direction:row',
        'align-items:center',
        'justify-content:flex-start',
        'gap:4px',
        'padding:0 6px',
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
        'color:'     + rcMuted(),
        'background:transparent'
      ].join(';');
      pill.appendChild(iconSpan);

      var txtWrap = document.createElement('div');
      txtWrap.style.cssText = [
        'display:flex','flex-direction:column',
        'align-items:flex-start','min-width:0',
        'background:transparent'
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
        'max-width:100%',
        'background:transparent'
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
        'max-width:100%',
        'background:transparent'
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

    var modePill  = makePill('[mdi:power]',                'Mode',       'Off');
    var fanPill   = makePill('[mdi:fan]',                  'Fan mode',   'Auto');
    var swingPill = makePill('[mdi:arrow-split-vertical]', 'Swing mode', 'Off');
    [modePill, fanPill, swingPill].forEach(function(p) { pillsZone.appendChild(p.pill); });

    /* ------------------------------------------------------------------
       Picker overlay
    ------------------------------------------------------------------ */
    var activeOverlay  = null;
    var activeCloseExt = null;

    function closeActiveOverlay() {
      if (activeOverlay && activeOverlay.parentNode)
        activeOverlay.parentNode.removeChild(activeOverlay);
      if (activeCloseExt)
        document.removeEventListener('click', activeCloseExt);
      activeOverlay = null; activeCloseExt = null;
    }

    function makeListPicker(options, onSelect) {
      closeActiveOverlay();
      var overlay = document.createElement('div');
      var overlayBg = bgToken
        ? rc(bgToken)
        : (rc('surface') || rc('surface_2') || 'rgba(24,24,28,0.97)');
      overlay.style.cssText = [
        'position:absolute',
        'bottom:' + (pillH + pillGap) + 'px',
        'left:'   + pillGap + 'px',
        'right:'  + pillGap + 'px',
        'background:'    + overlayBg,
        'border-radius:' + Math.round(pillH * 0.3) + 'px',
        'padding:6px',
        'display:flex',
        'flex-wrap:wrap',
        'gap:4px',
        'justify-content:center',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
        'z-index:10'
      ].join(';');

      var chipH  = Math.max(20, Math.round(pillH * 0.70));
      var chipFS = Math.max(9,  Math.round(chipH  * 0.52));

      options.forEach(function(opt) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.style.cssText = [
          'border:1px solid rgba(255,255,255,0.14)',
          'border-radius:' + Math.round(chipH / 2) + 'px',
          'height:'        + chipH + 'px',
          'padding:0 8px',
          'background:rgba(255,255,255,0.10)',
          'color:'         + rcText(),
          'font-size:'     + chipFS + 'px',
          'font-family:inherit',
          'cursor:pointer',
          'display:flex',
          'align-items:center',
          'gap:4px'
        ].join(';');
        if (opt.icon) {
          var ic = document.createElement('span');
          setContent(ic, opt.icon);
          ic.style.fontSize = chipFS + 'px';
          chip.appendChild(ic);
        }
        var tx = document.createElement('span');
        tx.textContent = opt.label;
        chip.appendChild(tx);
        chip.addEventListener('click', function(e) {
          e.stopPropagation();
          onSelect(opt.value);
          closeActiveOverlay();
          if (typeof resetReturnTimer === 'function') resetReturnTimer();
        });
        overlay.appendChild(chip);
      });

      el.appendChild(overlay);
      activeOverlay = overlay;
      setTimeout(function() {
        activeCloseExt = function() { closeActiveOverlay(); };
        document.addEventListener('click', activeCloseExt);
      }, 0);
    }

    /* mode / fan / swing pickers */
    var HVAC_ICONS  = { heat:'[mdi:fire]', cool:'[mdi:snowflake]', heat_cool:'[mdi:autorenew]',
                        auto:'[mdi:thermostat-auto]', dry:'[mdi:water-percent]',
                        fan_only:'[mdi:fan]', off:'[mdi:power]' };
    var HVAC_LABELS = { heat:'Heat', cool:'Cool', heat_cool:'Heat/Cool', auto:'Auto',
                        dry:'Dry', fan_only:'Fan', off:'Off' };
    var DEFAULT_HVAC = ['auto','heat','cool','heat_cool','dry','fan_only','off'];

    modePill.pill.addEventListener('click', function(e) {
      e.stopPropagation();
      var avail = (latestState && latestState.attributes && latestState.attributes.hvac_modes)
        ? latestState.attributes.hvac_modes : DEFAULT_HVAC;
      makeListPicker(avail.map(function(m) {
        return { value:m, label:HVAC_LABELS[m]||m, icon:HVAC_ICONS[m]||'[mdi:thermostat]' };
      }), function(mode) { sendMode(mode); });
      if (typeof resetReturnTimer === 'function') resetReturnTimer();
    });

    var FAN_ICONS  = { auto:'[mdi:fan-auto]', low:'[mdi:fan-speed-1]', medium:'[mdi:fan-speed-2]',
                       high:'[mdi:fan-speed-3]', medium_high:'[mdi:fan-speed-3]',
                       quiet:'[mdi:fan-off]', 'on':'[mdi:fan]', 'off':'[mdi:fan-off]' };
    var FAN_LABELS = { auto:'Auto', low:'Low', medium:'Medium', high:'High',
                       medium_high:'Med-High', quiet:'Quiet', 'on':'On', 'off':'Off' };
    var DEFAULT_FAN = ['auto','low','medium','high','off'];

    fanPill.pill.addEventListener('click', function(e) {
      e.stopPropagation();
      var avail = (latestState && latestState.attributes && latestState.attributes.fan_modes)
        ? latestState.attributes.fan_modes : DEFAULT_FAN;
      makeListPicker(avail.map(function(f) {
        return { value:f, label:FAN_LABELS[f]||f, icon:FAN_ICONS[f]||'[mdi:fan]' };
      }), function(fm) { sendFanMode(fm); });
      if (typeof resetReturnTimer === 'function') resetReturnTimer();
    });

    var SWING_ICONS  = { 'off':'[mdi:arrow-collapse-vertical]', both:'[mdi:arrow-split-vertical]',
                          vertical:'[mdi:arrow-up-down]', horizontal:'[mdi:arrow-left-right]',
                          upper:'[mdi:arrow-up]' };
    var SWING_LABELS = { 'off':'Off', both:'Both', vertical:'Vertical',
                          horizontal:'Horizontal', upper:'Upper' };
    var DEFAULT_SWING = ['off','vertical','horizontal','both'];

    swingPill.pill.addEventListener('click', function(e) {
      e.stopPropagation();
      var avail = (latestState && latestState.attributes && latestState.attributes.swing_modes)
        ? latestState.attributes.swing_modes : DEFAULT_SWING;
      makeListPicker(avail.map(function(s) {
        return { value:s, label:SWING_LABELS[s]||s, icon:SWING_ICONS[s]||'[mdi:arrow-split-vertical]' };
      }), function(sm) { sendSwingMode(sm); });
      if (typeof resetReturnTimer === 'function') resetReturnTimer();
    });

    /* ------------------------------------------------------------------
       9.  Setpoint state
    ------------------------------------------------------------------ */
    var singleSP = clamp((cfgMin + cfgMax) / 2);
    var dualLow  = clamp(cfgMin + (cfgMax - cfgMin) * 0.35);
    var dualHigh = clamp(cfgMin + (cfgMax - cfgMin) * 0.65);
    var isDual   = false;
    var curMode  = 'off';

    function modeColor(m) {
      if (m === 'heat' || m === 'dry')     return rc(heatToken);
      if (m === 'cool' || m === 'auto')    return rc(coolToken);
      if (m === 'heat_cool')               return rc(heatToken);
      if (m === 'fan_only' || m === 'off') return rcMuted();
      return rc(arcToken);
    }

    function spToPct(sp) {
      var p = (sp - cfgMin) / (cfgMax - cfgMin);
      return p < 0 ? 0 : p > 1 ? 1 : p;
    }
    function redraw() {
      var col = modeColor(curMode);
      curNumEl.style.color = col;
      if (isDual) {
        var pLo = spToPct(dualLow), pHi = spToPct(dualHigh);
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

    function adjustSetpoint(delta) {
      singleSP = clamp(singleSP + delta);
      redraw(); sendSingleTemp();
    }
    function adjustDualLow(delta) {
      dualLow = clamp(dualLow + delta);
      if (dualLow >= dualHigh) dualLow = clamp(dualHigh - cfgStep);
      redraw(); sendDualTemp();
    }
    function adjustDualHigh(delta) {
      dualHigh = clamp(dualHigh + delta);
      if (dualHigh <= dualLow) dualHigh = clamp(dualLow + cfgStep);
      redraw(); sendDualTemp();
    }

    function sendSingleTemp() {
      if (!w.entity) return;
      var eu = getEU(latestState);
      handleAction({ type:'service', service:'climate.set_temperature',
        data:{ entity_id:w.entity, temperature: Math.round(toEU(singleSP,eu)*2)/2 } });
    }
    function sendDualTemp() {
      if (!w.entity) return;
      var eu = getEU(latestState);
      handleAction({ type:'service', service:'climate.set_temperature',
        data:{ entity_id:w.entity,
          target_temp_low:  Math.round(toEU(dualLow, eu)*2)/2,
          target_temp_high: Math.round(toEU(dualHigh,eu)*2)/2 } });
    }
    function sendMode(mode) {
      if (!w.entity) return;
      handleAction({ type:'service', service:'climate.set_hvac_mode',
        data:{ entity_id:w.entity, hvac_mode:mode } });
    }
    function sendFanMode(fm) {
      if (!w.entity) return;
      handleAction({ type:'service', service:'climate.set_fan_mode',
        data:{ entity_id:w.entity, fan_mode:fm } });
    }
    function sendSwingMode(sm) {
      if (!w.entity) return;
      handleAction({ type:'service', service:'climate.set_swing_mode',
        data:{ entity_id:w.entity, swing_mode:sm } });
    }

    var LABELS_MODE  = { heat:'Heat', cool:'Cool', heat_cool:'Heat/Cool', auto:'Auto',
                         dry:'Dry', fan_only:'Fan', off:'Off' };
    var LABELS_FAN   = { auto:'Auto', low:'Low', medium:'Med', high:'High',
                         medium_high:'Med-Hi', quiet:'Quiet', 'on':'On', 'off':'Off' };
    var LABELS_SWING = { 'off':'Off', both:'Both', vertical:'Vertical',
                         horizontal:'Horizontal', upper:'Upper' };
    var ICONS_MODE   = { heat:'[mdi:fire]', cool:'[mdi:snowflake]', heat_cool:'[mdi:autorenew]',
                         auto:'[mdi:thermostat-auto]', dry:'[mdi:water-percent]',
                         fan_only:'[mdi:fan]', off:'[mdi:power]' };

    function applyState(state) {
      if (!state) return;
      var attrs = state.attributes || {};
      var eu    = getEU(state);

      var cur = parseFloat(attrs.current_temperature);
      curNumEl.textContent = isNaN(cur) ? '--' : fmt(toDisplay(cur, eu));

      curMode = String(state.state || '').toLowerCase();
      var modeStr = LABELS_MODE[curMode] || curMode;
      modeLabelEl.textContent    = modeStr;
      modePill.line2.textContent = modeStr;
      setContent(modePill.icon, ICONS_MODE[curMode] || '[mdi:thermostat]');

      fanPill.line2.textContent   = LABELS_FAN[String(attrs.fan_mode   || attrs.fan_speed || 'auto').toLowerCase()] || String(attrs.fan_mode || 'auto');
      swingPill.line2.textContent = LABELS_SWING[String(attrs.swing_mode || 'off').toLowerCase()] || String(attrs.swing_mode || 'off');

      var newDual = curMode === 'heat_cool' &&
                    attrs.target_temp_low !== undefined &&
                    attrs.target_temp_high !== undefined;
      if (newDual !== isDual) {
        isDual = newDual;
        minusBtn.style.display = plusBtn.style.display = isDual ? 'none' : 'flex';
        [minusBtnLo,plusBtnLo,minusBtnHi,plusBtnHi].forEach(function(b) {
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

    if (w.entity) {
      registerEntityCallback(w.entity, function(state) {
        latestState = state;
        applyState(state);
      });
      if (latestState) applyState(latestState);
    }

    redraw();
  }
