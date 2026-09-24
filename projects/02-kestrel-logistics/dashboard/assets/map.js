/*
  A South African freight network map.

  Deliberately not a mapping library. There are no tiles to fetch, no attribution to carry and
  no external request: the country is one path, the lanes are arcs between two real
  coordinates, and the whole thing is a few kilobytes of SVG. On a page whose argument is
  "there is no server", pulling map tiles off someone else's would rather undercut it.

  Projection is equirectangular with the horizontal axis corrected by the cosine of the mean
  latitude. Over a country 13 degrees tall that is visually indistinguishable from a proper
  conic projection and costs two lines of arithmetic.
*/

// Simplified national boundary, [lon, lat], traced clockwise from the Orange River mouth
// down the west coast, around the Cape, up the east coast, then back along the northern
// border. Coarse inland, detailed on the coast, because the coastline is the silhouette
// people recognise.
const ZA_OUTLINE = [
  [16.45, -28.58], [16.87, -29.25], [17.10, -30.00], [17.60, -30.80], [17.90, -31.50],
  [18.20, -32.30], [18.30, -32.80], [18.35, -33.30], [18.45, -33.60], [18.37, -34.00],
  [18.47, -34.35], [18.85, -34.10], [19.30, -34.60], [19.98, -34.83], [20.60, -34.45],
  [21.50, -34.40], [22.15, -34.05], [23.00, -34.05], [23.90, -34.05], [24.85, -34.20],
  [25.65, -33.98], [26.50, -33.75], [27.40, -33.30], [27.90, -33.02], [28.80, -32.30],
  [29.90, -31.30], [30.40, -30.70], [30.90, -30.00], [31.05, -29.85], [31.50, -29.20],
  [32.10, -28.70], [32.50, -28.20], [32.70, -27.50], [32.90, -26.85],
  [32.00, -26.40], [31.95, -25.95], [31.30, -25.75], [31.30, -25.20], [31.90, -24.40],
  [31.55, -23.60], [31.30, -22.40], [30.40, -22.35], [29.40, -22.20], [28.50, -22.55],
  [27.50, -23.20], [26.90, -24.20], [26.40, -24.62], [25.80, -25.30], [25.30, -25.75],
  [24.50, -25.80], [23.50, -25.95], [22.60, -26.15], [21.80, -26.70], [20.80, -26.45],
  [20.60, -25.80], [19.98, -24.77], [19.98, -28.45], [19.00, -28.45], [18.20, -28.90],
  [17.40, -28.70], [16.90, -28.45],
];

// Lesotho, landlocked inside the country. Drawn because a South African will notice if the
// map does not have the hole in it.
const LESOTHO = [
  [27.00, -29.63], [27.75, -28.60], [28.60, -28.58], [29.35, -29.30], [29.45, -29.90],
  [28.90, -30.45], [28.10, -30.65], [27.40, -30.30],
];

const BOUNDS = { lonMin: 16.0, lonMax: 33.4, latMin: -35.2, latMax: -21.9 };
const MEAN_LAT_RAD = ((BOUNDS.latMin + BOUNDS.latMax) / 2) * Math.PI / 180;
const LON_SCALE = Math.cos(MEAN_LAT_RAD);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// Labels are placed, not just drawn. Each tries the right of its dot, then the left, and is
// dropped if both would run off the edge or through something already placed. On a phone the
// map is 343px wide: the east coast sits about 30px from the edge, so "Kestrel KZN Hub" was
// cut off mid word, and Kimberley is a few pixels from Bloemfontein, so one of them has to go
// quiet. The dot stays, and the lane table below the map names every destination.
let measureCtx;
function labelPlacer(w, obstacles) {
  const placed = [...obstacles];
  const clear = (b) => b.l >= 2 && b.r <= w - 2 && !placed.some((p) =>
    b.l < p.r + 3 && p.l < b.r + 3 && b.t < p.b + 1 && p.t < b.b + 1);
  // Returns the x attributes for the label, or null when there is nowhere clean to put it.
  // force is for the hubs: they are the names that mean something, so they are never dropped.
  return (x, baseline, gap, text, px, weight = 400, force = false) => {
    measureCtx ||= document.createElement('canvas').getContext('2d');
    measureCtx.font = `${weight} ${px}px ${cssVar('--font-sans')}`;
    const tw = measureCtx.measureText(text).width;
    const t = baseline - px * 0.8;
    const bot = baseline + px * 0.25;
    const right = { l: x + gap, r: x + gap + tw, t, b: bot };
    const left = { l: x - gap - tw, r: x - gap, t, b: bot };
    const attrs = (b) => (b === right
      ? `x="${(x + gap).toFixed(1)}"` : `x="${(x - gap).toFixed(1)}" text-anchor="end"`);
    for (const b of [right, left]) {
      if (clear(b)) { placed.push(b); return attrs(b); }
    }
    if (!force) return null;
    const b = right.r <= w - 2 ? right : left;
    placed.push(b);
    return attrs(b);
  };
}

/** Build a projector that fits the country into a w by h box with padding. */
function projector(w, h, pad = 16) {
  const spanLon = (BOUNDS.lonMax - BOUNDS.lonMin) * LON_SCALE;
  const spanLat = BOUNDS.latMax - BOUNDS.latMin;
  const scale = Math.min((w - pad * 2) / spanLon, (h - pad * 2) / spanLat);
  const offX = (w - spanLon * scale) / 2;
  const offY = (h - spanLat * scale) / 2;
  return (lon, lat) => [
    offX + (lon - BOUNDS.lonMin) * LON_SCALE * scale,
    offY + (BOUNDS.latMax - lat) * scale,
  ];
}

const pathFrom = (pts, project) =>
  pts.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join('') + 'Z';

/**
 * Draw the network.
 *
 * lanes: [{ lane_id, lane_name, origin_lat, origin_lon, destination_lat, destination_lon,
 *           weight, status, tip }]
 *   weight  0..1, drives stroke width, normally revenue share
 *   status  'loss' | 'thin' | 'healthy', drives colour. Colour is never the only channel:
 *           loss-making lanes are also labelled on the map and listed in the table below it.
 * depots: [{ name, lat, lon, dim? }]
 * cities: [{ name, lat, lon }]
 *
 * A lane or hub carrying dim is drawn faintly rather than removed. The hub filter uses it:
 * showing one hub's corridors against the ghost of the rest keeps the network readable, where
 * deleting the other lanes would leave three lines floating on an empty country.
 */
export function networkMap(el, { lanes, depots, cities, height = 560 }) {
  const render = (w) => {
    const project = projector(w, height);
    const colourFor = (s) =>
      s === 'loss' ? cssVar('--breach') : s === 'thin' ? cssVar('--warn') : cssVar('--s1');

    let s = `<svg width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" `
      + `aria-label="Freight network across South Africa, with corridors coloured by contribution">`;

    // Land
    s += `<path d="${pathFrom(ZA_OUTLINE, project)}" fill="${cssVar('--land')}" `
      + `stroke="${cssVar('--land-edge')}" stroke-width="1" stroke-linejoin="round"/>`;
    s += `<path d="${pathFrom(LESOTHO, project)}" fill="${cssVar('--panel')}" `
      + `stroke="${cssVar('--land-edge')}" stroke-width="1"/>`;

    // Lanes, drawn healthy first so the loss-making corridors sit on top and read first
    // Dimmed lanes go down first of all, so a selected hub's corridors always sit on top.
    const order = { healthy: 0, thin: 1, loss: 2 };
    const rank = (l) => (l.dim ? -1 : order[l.status]);
    for (const lane of [...lanes].sort((a, b) => rank(a) - rank(b))) {
      const [x1, y1] = project(lane.origin_lon, lane.origin_lat);
      const [x2, y2] = project(lane.destination_lon, lane.destination_lat);
      const dx = x2 - x1, dy = y2 - y1;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) continue;                       // a metro run, both ends at the same hub

      // Bow the arc perpendicular to the line so the two directions of a corridor separate
      // instead of drawing over each other.
      const bow = Math.min(dist * 0.16, 42);
      const mx = (x1 + x2) / 2 - (dy / dist) * bow;
      const my = (y1 + y2) / 2 + (dx / dist) * bow;

      const width = 1 + lane.weight * 6;
      const colour = colourFor(lane.status);
      s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} `
        + `${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${colour}" `
        + `stroke-width="${width.toFixed(2)}" stroke-linecap="round" `
        + `opacity="${lane.dim ? 0.12 : lane.status === 'healthy' ? 0.55 : 0.95}"/>`;
      // A wide invisible hit path, so a 1px lane is still easy to hover
      s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} `
        + `${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="transparent" stroke-width="16" `
        + `tabindex="0" data-tip="${esc(lane.tip)}" style="cursor:pointer"/>`;
    }

    // Destination cities.
    //
    // A city that already has a hub on it does not get a second label. Cape Town and Kestrel
    // Cape Hub are the same dot, and writing both put one string through the other. The
    // condensed face this map used to set labels in hid the overlap; Verdana is wide enough
    // to expose it. Dropping the redundant label is the fix either way, because the hub name
    // is the one that means something here.
    const depotPoints = depots.map((d) => project(d.lon, d.lat));
    const hasHub = ([x, y]) =>
      depotPoints.some(([dx, dy]) => Math.hypot(dx - x, dy - y) < 14);

    // Every dot is an obstacle, and the hub labels are placed before any city's.
    const cityPoints = cities.map((c) => project(c.lon, c.lat));
    const place = labelPlacer(w, [
      ...depotPoints.map(([x, y]) => ({ l: x - 7, r: x + 7, t: y - 7, b: y + 7 })),
      ...cityPoints.map(([x, y]) => ({ l: x - 2.5, r: x + 2.5, t: y - 2.5, b: y + 2.5 })),
    ]);
    const hubLabels = depots.map((d, i) =>
      place(depotPoints[i][0], depotPoints[i][1] + 4, 12, d.name, 12, 600, true));

    cities.forEach((c, i) => {
      const [x, y] = cityPoints[i];
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${cssVar('--text-3')}"/>`;
      if (hasHub([x, y])) return;
      const at = place(x, y + 3.5, 7, c.name, 10.5);
      if (!at) return;
      s += `<text ${at} y="${(y + 3.5).toFixed(1)}" font-size="10.5" `
        + `fill="${cssVar('--text-3')}" font-family="${cssVar('--font-sans')}">${esc(c.name)}</text>`;
    });

    // Hubs, drawn last so they sit above every lane
    depots.forEach((d, i) => {
      const [x, y] = depotPoints[i];
      const fade = d.dim ? ' opacity="0.45"' : '';
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="none" `
        + `stroke="${cssVar('--s1')}" stroke-width="1.5" opacity="0.5"/>`;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${cssVar('--s1')}" `
        + `stroke="${cssVar('--panel')}" stroke-width="2"${fade}/>`;
      s += `<text ${hubLabels[i]} y="${(y + 4).toFixed(1)}" font-size="12"${fade} `
        + `font-weight="600" fill="${cssVar('--text')}" `
        + `font-family="${cssVar('--font-sans')}">${esc(d.name)}</text>`;
    });

    return s + '</svg>';
  };
  return render;
}
