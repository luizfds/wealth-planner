import { escapeAttr } from "./html.js";

var SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs){
  var el = document.createElementNS(SVG_NS, tag);
  for(var k in attrs){ el.setAttribute(k, attrs[k]); }
  return el;
}

// A tiny inline trend line built straight from a logged history[] array (no axes, grid, or
// tooltip — those belong to renderLineChart's full charts). Returns an HTML string rather than
// mutating a container, since every caller so far splices this into a row's template string
// (a holdings row, a future watchlist card) rather than owning a dedicated container element.
// Empty string with fewer than two points, matching historyTrendHtml's "nothing to show yet"
// convention, so callers can splice it in with no extra "no data" placeholder cluttering rows
// nobody has logged twice yet.
export function sparklineHtml(history, opts){
  opts = opts || {};
  if(!history || history.length < 2) return "";
  var w = opts.width || 56, h = opts.height || 22;
  var values = history.map(function(p){ return Number(p.value) || 0; });
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  if(min === max){ min -= 1; max += 1; }
  var stepX = w / (values.length - 1);
  var d = values.map(function(v, i){
    var x = i * stepX;
    var y = h - ((v - min) / (max - min)) * h;
    return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  var trendCls = values[values.length - 1] > values[0] ? "up" : (values[values.length - 1] < values[0] ? "down" : "");
  return '<svg class="sparkline' + (trendCls ? " " + trendCls : "") + '" width="' + w + '" height="' + h +
    '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

// A faint dashed placeholder for wherever sparklineHtml() would otherwise return nothing (fewer
// than 2 logged snapshots) — without this, a row that's meant to show a trend chart just shows a
// blank gap where one should be, which reads as broken rather than "not enough data yet".
export function sparklinePlaceholderHtml(width, height){
  width = width || 56; height = height || 22;
  var y = height / 2;
  return '<svg class="sparkline sparkline-empty" width="' + width + '" height="' + height +
    '" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">' +
    '<title>Log this holding at least twice to see a trend line</title>' +
    '<line x1="2" y1="' + y + '" x2="' + (width - 2) + '" y2="' + y + '" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"/></svg>';
}

// The x-axis label format a dated chart should use, given how much time it spans.
//
// "Aug 2026 / Sep 2026" says almost nothing across a four-week window — inside a quarter the useful
// unit is the day, and across years it is the month. Shared rather than written out at each call
// site, because the four charts that need it were already drifting: the range controls make the
// same chart span a day or a decade depending on which button is pressed.
export function dateAxisFormat(points){
  var pts = points || [];
  var spanDays = pts.length > 1 ? (pts[pts.length - 1].x - pts[0].x) / 86400000 : 0;
  var fmt = spanDays <= 100
    ? { day: "numeric", month: "short" }
    : { year: "numeric", month: "short" };
  return function(ms){ return new Date(ms).toLocaleDateString(undefined, fmt); };
}

// ---------------- Shared sizing ----------------
// Both full charts stretch to fill their container, and both used to be laid out in a nominal
// 720-unit box regardless of the box they actually got. That distorts text in two different ways
// depending on how the SVG scales: the stacked chart (preserveAspectRatio="none") squashed its
// labels to 44% of their width, and the line chart (uniform scale, height:auto) shrank an 11px
// font to 6px — unreadable on a phone. Measuring first makes the scale 1:1 in both.
//
// A container that isn't laid out yet measures 0 — which is the normal case, because the first
// render of every chart happens inside renderAll() while its page is still display:none. The old
// nominal width is the fallback, and observeWidth() below redraws once a real one exists.
function measuredWidth(container, fallback){
  var w = Math.round(container.getBoundingClientRect().width);
  return w > 80 ? w : fallback;
}
// Redraw when the container's width changes by enough to matter: the hidden-page case above,
// window resizes, and a collapsible ledger being reopened — in one place, rather than every caller
// remembering to redraw on every event that changes a width.
function observeWidth(container, drawnAt, redraw){
  if(typeof ResizeObserver !== "function") return;
  if(container._chartRO){ container._chartRO.disconnect(); container._chartRO = null; }
  var ro = new ResizeObserver(function(entries){
    var now = Math.round(entries[0].contentRect.width);
    // >2px, or a redraw that nudges the width by a rounding error observes itself forever.
    if(now > 80 && Math.abs(now - drawnAt) > 2){
      ro.disconnect();
      if(container._chartRO === ro) container._chartRO = null;
      redraw();
    }
  });
  ro.observe(container);
  container._chartRO = ro;
}
// The left gutter has to hold the widest y label, which depends on the numbers *and* the caller's
// formatter — a fixed 60 fits "$4,200" and clips "$664,908". Estimated rather than measured
// (measuring means rendering, and the gutter decides where to render), at ~6.3px per character for
// an 11px face, then capped so a chart of very large numbers still has a chart left in it.
function gutterFor(labels, W, fontPx){
  var widest = labels.reduce(function(m, l){ return Math.max(m, String(l).length); }, 0);
  return Math.min(Math.round(W * 0.4), Math.max(34, Math.ceil(widest * ((fontPx || 11) * 0.575)) + 12));
}

export function renderLineChart(container, series, opts){
  opts = opts || {};
  container.innerHTML = "";
  var validSeries = series.filter(function(s){ return s.points && s.points.length; });
  if(!validSeries.length){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">' + (opts.emptyMessage || "Not enough data yet.") + '</p>';
    return;
  }
  var W = measuredWidth(container, 720), H = opts.height || 260;
  observeWidth(container, W, function(){ renderLineChart(container, series, opts); });
  var padR = 16, padT = 14, padB = 26;

  var xs = [], ys = [];
  validSeries.forEach(function(s){ s.points.forEach(function(p){ xs.push(p.x); ys.push(p.y); }); });
  var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
  if(xMin === xMax) xMax = xMin + 1;
  var yLo = Math.min.apply(null, ys), yHi = Math.max.apply(null, ys);
  var yMin = Math.min(0, yLo);
  var yMax = yHi;
  // opts.baseline === "auto": start the axis near the data instead of at zero.
  //
  // A zero baseline on a $560k net worth puts every real movement inside the top fifth of the
  // chart — and once the range control lets you zoom to a week, that week is a flat line whatever
  // happened in it. A line chart can honestly do this where a bar chart cannot: bars encode
  // magnitude as length from zero, a line encodes it as position against a labelled axis, and
  // every gridline here carries its own dollar figure.
  //
  // Zero still wins whenever the data is actually near it, or spans enough of its own magnitude
  // that the zoom buys nothing — so an account growing from nothing keeps its true shape.
  var truncated = false;
  if(opts.baseline === "auto" && yLo > 0 && (yHi - yLo) < yHi * 0.4){
    var span = (yHi - yLo) || Math.abs(yHi) * 0.02 || 1;
    yMin = yLo - span * 0.25;
    yMax = yHi + span * 0.25;
    truncated = true;
  }
  // An all-zero series has no range to draw. Nudging yMax by 1 keeps the arithmetic safe but puts
  // "$0 / $1" on the axis of an empty projection, which reads as a portfolio of one dollar rather
  // than as nothing entered yet — so the caller's empty message is the honest answer instead.
  if(yMax === yMin){
    if(yMax === 0){
      container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">' +
        (opts.emptyMessage || "Nothing to chart yet.") + '</p>';
      return;
    }
    yMax = yMin + 1;
  }
  var yPad = (yMax - yMin) * 0.08;
  yMax += yPad; if(yMin < 0) yMin -= yPad;

  var ticks = 5;
  var yLabels = [];
  for(var li = 0; li <= ticks; li++){
    var lv = yMin + (yMax - yMin) * li / ticks;
    yLabels.push(opts.yFormat ? opts.yFormat(lv) : Math.round(lv));
  }
  var padL = gutterFor(yLabels, W, 10);
  var innerW = W - padL - padR, innerH = H - padT - padB;

  function xScale(x){ return padL + (x - xMin) / (xMax - xMin) * innerW; }
  function yScale(y){ return padT + innerH - (y - yMin) / (yMax - yMin) * innerH; }
  function xInvert(px){ return xMin + (px - padL) / innerW * (xMax - xMin); }

  var wrap = document.createElement("div");
  wrap.className = "proj-chart-wrap";

  // Session-only (not persisted) — which series are hidden via the legend toggle below.
  // Axis scale stays fixed to all series' data regardless of what's toggled off, so hiding a
  // line never rescales/jumps the chart; only that line's path/dot/tooltip row disappear.
  var hiddenIdx = {};

  if(validSeries.length > 1 || opts.alwaysLegend){
    var legend = document.createElement("div");
    legend.className = "proj-legend";
    validSeries.forEach(function(s, idx){
      var item = document.createElement("div");
      item.className = "proj-legend-item" + (opts.interactiveLegend ? " proj-legend-item-toggle" : "");
      item.innerHTML = '<span class="proj-swatch ' + s.colorClass + '"></span><b>' + escapeAttr(s.label) + '</b>';
      if(opts.interactiveLegend){
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-pressed", "true");
        item.title = "Click to hide/show this line on the chart";
        var toggle = function(){
          hiddenIdx[idx] = !hiddenIdx[idx];
          var isHidden = !!hiddenIdx[idx];
          item.classList.toggle("is-hidden", isHidden);
          item.setAttribute("aria-pressed", isHidden ? "false" : "true");
          var line = svg.querySelector('[data-series-idx="' + idx + '"].series-line');
          var dot = svg.querySelector('[data-series-idx="' + idx + '"].series-dot');
          if(line) line.style.display = isHidden ? "none" : "";
          if(dot) dot.style.display = isHidden ? "none" : "";
        };
        item.addEventListener("click", toggle);
        item.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); toggle(); } });
      }
      legend.appendChild(item);
    });
    wrap.appendChild(legend);
  }

  var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "proj-svg", role: "img", "aria-label": opts.ariaLabel || "Chart" });

  for(var i = 0; i <= ticks; i++){
    var yVal = yMin + (yMax - yMin) * i / ticks;
    var yPix = yScale(yVal);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: yPix, y2: yPix, class: "proj-grid" }));
    var lbl = svgEl("text", { x: padL - 8, y: yPix + 4, "text-anchor": "end", class: "proj-axislabel" });
    lbl.textContent = opts.yFormat ? opts.yFormat(yVal) : Math.round(yVal);
    svg.appendChild(lbl);
  }
  if(yMin < 0 && yMax > 0){
    var zp = yScale(0);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: zp, y2: zp, class: "proj-zero" }));
  }
  var xTickCount = Math.max(2, opts.xTickCount || 7);
  // A short date range (e.g. a few weeks of logged history) formatted at month granularity can
  // put two+ evenly-spaced ticks in the same calendar month — skip re-rendering an immediately
  // repeated label rather than showing "Jul 2026" twice in a row with nothing distinguishing
  // them. Only checked against the *previous* tick, not all previous ticks, so a label is free
  // to legitimately recur later (e.g. a multi-year axis crossing back into "Q1" territory).
  var lastXLabel = null, lastXPix = -Infinity;
  // Also drop any label that would land within a label's width of the previous one. Skipping only
  // *identical* neighbours was enough while the canvas was a nominal 720 units wide, because the
  // labels were being shrunk to 6px along with everything else. Now that they render at their
  // real size, seven ticks across a 316px phone is about 36px apart — and "Aug 24" printed on top
  // of "Aug 27" at both ends of the axis.
  var minGap = Math.max(44, Math.round(W / 7));
  for(var ti = 0; ti < xTickCount; ti++){
    var xv = xMin + (xMax - xMin) * ti / (xTickCount - 1);
    var xPix = xScale(xv);
    var isLast = ti === xTickCount - 1;
    var xvLabel = (ti === 0) ? xMin : isLast ? xMax : Math.round(xv);
    var xText = opts.xFormat ? opts.xFormat(xvLabel) : xvLabel;
    if(xText === lastXLabel) continue;
    // The last tick is the one label worth crowding for — it says where the line ends — so it
    // evicts its neighbour rather than being dropped by it.
    if(xPix - lastXPix < minGap){
      if(!isLast) continue;
      if(svg.lastChild && svg.lastChild.getAttribute && svg.lastChild.getAttribute("class") === "proj-axislabel"){
        svg.removeChild(svg.lastChild);
      }
    }
    lastXLabel = xText; lastXPix = xPix;
    var anchor = ti === 0 ? "start" : (isLast ? "end" : "middle");
    var xlbl = svgEl("text", { x: xPix, y: H - 8, "text-anchor": anchor, class: "proj-axislabel" });
    xlbl.textContent = xText;
    svg.appendChild(xlbl);
  }

  validSeries.forEach(function(s, idx){
    // opts.stepped: hold each value until the next reading, instead of joining two observations
    // with a diagonal.
    //
    // For *logged history* the diagonal is a claim nobody made. On the reference data the only
    // observations were July 2025, August 2025, then nothing until August 2026 — and the line drew
    // net worth climbing steadily from $166k to $650k across that year. What happened was flat
    // super for twelve months and a jump in one week, when the property and shares were first
    // entered into the app. A snapshot says "this was its value on this date, and it held until
    // the next reading"; a step draws that, a diagonal invents a year of growth out of the gap.
    //
    // For a *projection* the diagonal is correct — a continuous model really does pass through
    // every point between its samples. So it is per-series first, falling back to per-call: the
    // projection-accuracy panel overlays exactly these two kinds on one pair of axes, a modelled
    // line that should slope and a logged one that should step.
    var stepped = s.stepped !== undefined ? s.stepped : opts.stepped;
    var d = s.points.map(function(p, pidx){
      var x = xScale(p.x).toFixed(1), y = yScale(p.y).toFixed(1);
      if(pidx === 0) return "M" + x + "," + y;
      if(!stepped) return "L" + x + "," + y;
      return "L" + x + "," + yScale(s.points[pidx - 1].y).toFixed(1) + " L" + x + "," + y;
    }).join(" ");
    svg.appendChild(svgEl("path", { d: d, class: "series-line " + s.colorClass, "data-series-idx": idx }));
    var last = s.points[s.points.length - 1];
    svg.appendChild(svgEl("circle", { cx: xScale(last.x), cy: yScale(last.y), r: 3.5, class: "series-dot " + s.colorClass, "data-series-idx": idx }));
  });

  var crosshair = svgEl("line", { y1: padT, y2: H - padB, class: "proj-crosshair", visibility: "hidden" });
  svg.appendChild(crosshair);
  var hitRect = svgEl("rect", { x: padL, y: padT, width: innerW, height: innerH, fill: "transparent" });
  hitRect.style.cursor = "crosshair";
  svg.appendChild(hitRect);

  var tooltip = document.createElement("div");
  tooltip.className = "viz-tooltip";
  wrap.appendChild(svg);
  wrap.appendChild(tooltip);
  container.appendChild(wrap);
  // Say so when the axis doesn't start at zero. Every gridline carries its own figure, so the
  // scale is readable — but a drop that runs most of the way down the panel reads as "nearly
  // halved" at a glance, and it is worth one line to stop that glance being wrong.
  if(truncated){
    var axisNote = document.createElement("p");
    axisNote.className = "chart-axis-note";
    axisNote.textContent = "Zoomed in — the bottom of this chart is " +
      (opts.yFormat ? opts.yFormat(yMin) : Math.round(yMin)) + ", not $0.";
    container.appendChild(axisNote);
  }

  function nearestIndexInPoints(points, xData){
    var best = 0, bestDist = Infinity;
    points.forEach(function(p, idx){
      var dist = Math.abs(p.x - xData);
      if(dist < bestDist){ bestDist = dist; best = idx; }
    });
    return best;
  }
  function nearestPointIndex(xData){
    return nearestIndexInPoints(validSeries[0].points, xData);
  }

  hitRect.addEventListener("mousemove", function(e){
    var rect = svg.getBoundingClientRect();
    var scaleX = W / rect.width;
    var px = (e.clientX - rect.left) * scaleX;
    var xData = xInvert(px);
    var idx = nearestPointIndex(xData);
    var xVal = validSeries[0].points[idx].x;
    var xPix = xScale(xVal);
    crosshair.setAttribute("x1", xPix); crosshair.setAttribute("x2", xPix);
    crosshair.setAttribute("visibility", "visible");
    var rows = validSeries.map(function(s, sidx){
      if(hiddenIdx[sidx]) return "";
      // Looked up independently per series (not the shared `idx` from series[0]'s grid) so two
      // series with different point counts/spacing — e.g. a yearly reference projection overlaid
      // with sparse, irregularly-dated actual net-worth log entries — each show their own nearest
      // real data point instead of series[0]'s index misapplied to a shorter/differently-spaced one.
      var pt = s.points[nearestIndexInPoints(s.points, xData)];
      return '<div class="viz-tooltip-row"><span class="proj-swatch ' + s.colorClass + '"></span>' + escapeAttr(s.label) + ': <b>' + (opts.yFormat ? opts.yFormat(pt.y) : Math.round(pt.y)) + '</b></div>';
    }).join("");
    tooltip.innerHTML = '<div style="margin-bottom:4px;color:var(--paper);opacity:.75">' + (opts.xFormat ? opts.xFormat(xVal) : xVal) + '</div>' + rows;
    tooltip.classList.add("show");
    var rectW = rect.width;
    var leftPct = (xPix / W) * 100;
    var tipWidthGuess = 150;
    var leftPx = (xPix / W) * rectW;
    var clampedLeft = Math.min(Math.max(leftPx, 4), rectW - tipWidthGuess - 4);
    tooltip.style.left = clampedLeft + "px";
    tooltip.style.top = "4px";
  });
  hitRect.addEventListener("mouseleave", function(){
    crosshair.setAttribute("visibility", "hidden");
    tooltip.classList.remove("show");
  });
}

// A stacked area chart, for showing composition over time — what a single net-worth line cannot
// say: whether the mix is shifting.
//
// Deliberately not a variant of renderLineChart. A stacked chart answers a different question and
// needs different rules: bands are filled rather than stroked, the y-axis is always the running
// total rather than each series' own value, and the series order is fixed so a band can't swap
// places with its neighbour between renders.
//
// `series` is [{ key, label, colorClass, points:[{x,y,dateLabel}] }], all sharing one x sequence.
// Series order is bottom-to-top and is the caller's; colour travels with the series' own key, never
// with its position, so a band that empties out doesn't hand its colour to the next one along.
export function renderStackedAreaChart(container, series, opts){
  opts = opts || {};
  container.innerHTML = "";
  var live = (series || []).filter(function(s){ return s.points && s.points.length; });
  if(live.length < 1 || live[0].points.length < 2){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">' +
      (opts.emptyMessage || "Not enough logged history yet.") + '</p>';
    return;
  }
  // Sized to the box it will occupy, and redrawn once it has one — see measuredWidth/observeWidth.
  var W = measuredWidth(container, 720);
  observeWidth(container, W, function(){ renderStackedAreaChart(container, series, opts); });
  var H = opts.height || 240;
  var padR = 12, padT = 12, padB = 24;
  var n = live[0].points.length;

  // Running totals per x, which is both the stack geometry and the y-scale.
  var stackTops = [];
  for(var i = 0; i < n; i++){
    var running = 0;
    stackTops.push(live.map(function(s){ running += Math.max(0, (s.points[i] && s.points[i].y) || 0); return running; }));
  }
  var yMax = stackTops.reduce(function(m, col){ return Math.max(m, col[col.length - 1]); }, 0);
  if(yMax <= 0) yMax = 1;

  var ticks = 4;
  var tickLabels = [];
  for(var w = 0; w <= ticks; w++){
    var wv = (yMax / ticks) * w;
    tickLabels.push(opts.yFormat ? opts.yFormat(wv) : Math.round(wv));
  }
  var padL = gutterFor(tickLabels, W, 11);
  var innerW = W - padL - padR, innerH = H - padT - padB;
  var xs = live[0].points.map(function(p){ return p.x; });
  var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
  var xSpan = xMax - xMin || 1;
  var px = function(x){ return padL + ((x - xMin) / xSpan) * innerW; };
  var py = function(v){ return padT + innerH - (v / yMax) * innerH; };

  var svg = svgEl("svg", {
    viewBox: "0 0 " + W + " " + H, width: "100%", height: String(H),
    preserveAspectRatio: "none", role: "img",
    "aria-label": opts.ariaLabel || "Composition over time"
  });

  // Recessive grid, drawn first so every band sits on top of it.
  for(var g = 0; g <= ticks; g++){
    var gv = (yMax / ticks) * g;
    var gy = py(gv);
    svg.appendChild(svgEl("line", { x1: padL, y1: gy, x2: W - padR, y2: gy,
      stroke: "var(--border)", "stroke-width": 1, "shape-rendering": "crispEdges" }));
    var lbl = svgEl("text", { x: padL - 8, y: gy + 4, "text-anchor": "end",
      fill: "var(--ink-soft)", "font-size": "11" });
    lbl.textContent = opts.yFormat ? opts.yFormat(gv) : String(Math.round(gv));
    svg.appendChild(lbl);
  }

  // Bands, bottom-up. Each is the area between the running total below it and its own.
  // Stepped, never interpolated. A logged snapshot says "this was its value on this date, and it
  // held until the next reading" — which is exactly what valueOn() computes. Joining two
  // observations with a diagonal asserts something else entirely: on the reference data the
  // property was first logged in August 2026, and a straight line back to July 2025 drew a house
  // being gradually acquired over twelve months. A step says "nothing, then this", which is what
  // actually happened.
  var stepPairs = function(idx, valueFor){
    var pts = [];
    for(var i = 0; i < n; i++){
      var x = px(live[0].points[i].x);
      if(i > 0) pts.push(x + "," + py(valueFor(i - 1)));   // hold the previous value to here…
      pts.push(x + "," + py(valueFor(i)));                  // …then step to this one
    }
    return pts;
  };
  live.forEach(function(s, si){
    var top = stepPairs(si, function(i){ return stackTops[i][si]; });
    var bottom = stepPairs(si, function(i){ return si === 0 ? 0 : stackTops[i][si - 1]; });
    var d = "M" + top.join(" L") + " L" + bottom.reverse().join(" L") + " Z";
    var band = svgEl("path", { d: d, class: "stack-band " + (s.colorClass || ""), fill: "var(--series-color)" });
    var title = svgEl("title");
    title.textContent = s.label || s.key;
    band.appendChild(title);
    svg.appendChild(band);
    // The 2px surface-coloured separator the mark spec calls for: without it two adjacent bands of
    // similar lightness merge into one shape and the composition is unreadable.
    //
    // --paper-raised, not --paper: every chart in this app is drawn inside a `.ledger` or `.panel`
    // card, and those are the raised surface. Stroking the *page* background made the separator
    // invisible on white and a black hairline on dark — the one colour it must never be is
    // "a colour", since the whole point is that it reads as a gap.
    if(si < live.length - 1){
      var sepTop = stepPairs(si, function(i){ return stackTops[i][si]; });
      svg.appendChild(svgEl("path", { d: "M" + sepTop.join(" L"), fill: "none",
        stroke: "var(--paper-raised)", "stroke-width": 2, "stroke-linejoin": "round" }));
    }
  });

  // Ticks spaced by *time*, not by array position. Observation dates cluster — a year of quarterly
  // snapshots followed by a fortnight of daily ones — so picking every nth point put four labels
  // inside the last centimetre, overprinted into a smear. Walking the time axis instead, and then
  // dropping any label that would land within 56px of the previous one, keeps them readable
  // however lumpy the logging was.
  var xLabels = svgEl("g", {});
  var labelCount = Math.max(2, Math.min(opts.xTickCount || 5, n));
  var lastX = -Infinity, lastText = null;
  for(var t = 0; t < labelCount; t++){
    var atTime = xMin + (xSpan * (labelCount === 1 ? 0 : t / (labelCount - 1)));
    var x = px(atTime);
    var text = opts.xFormat ? opts.xFormat(atTime) : new Date(atTime).toISOString().slice(0, 10);
    if(x - lastX < 56 || text === lastText) continue;
    var anchor = t === 0 ? "start" : (t === labelCount - 1 ? "end" : "middle");
    var tx = svgEl("text", { x: x, y: H - 6, "text-anchor": anchor,
      fill: "var(--ink-soft)", "font-size": "11" });
    tx.textContent = text;
    xLabels.appendChild(tx);
    lastX = x; lastText = text;
  }
  svg.appendChild(xLabels);
  container.appendChild(svg);

  // A legend is not optional with two or more bands: a stacked chart encodes identity in colour
  // alone, and the values in it also discharge the contrast warning on the lighter series. The one
  // exception, opts.legend === false, is for a caller that already shows the *same* key — same
  // colours, same buckets — immediately above the chart.
  if(opts.legend === false) return;
  var legend = document.createElement("div");
  legend.className = "rule-legend stack-legend";
  // opts.legendValues === false: names only. The caller already shows each band's current value
  // somewhere better — repeating it under the stack makes two sets of numbers that have to be
  // compared to discover they are the same, which is the opposite of a key.
  legend.innerHTML = live.map(function(s){
    var last = s.points[s.points.length - 1];
    var value = opts.legendValues === false ? "" :
      ' <b>' + (opts.yFormat ? opts.yFormat(last.y) : Math.round(last.y)) + '</b>';
    return '<div class="rule-legend-item"><span class="rule-swatch ' + (s.colorClass || "") + '"></span>' +
      escapeAttr(s.label || s.key) + value + '</div>';
  }).join("");
  container.appendChild(legend);
}
