// interpolation
export const lerp = (a, b, i) => a + i * (b - a);
// color interpolation
export const clerp = (a, b, i) => [
  lerp(a[0], b[0], i),
  lerp(a[1], b[1], i),
  lerp(a[2], b[2], i),
  lerp(a[3], b[3], i),
];

// get pixel value at x/y of imagedata
export function getPixel(id, x, y) {
  if (x < 0 || y < 0 || x >= id.width || y >= id.height) {
    return [0, 0, 0, 0];
  }
  let i = (y * id.width + x) * 4;
  return id.data.slice(i, i + 4);
}

// set pixel value at x/y of imagedata
export function setPixel(id, x, y, r, g, b, a = 255) {
  let i = (y * id.width + x) * 4;
  id.data[i] = r;
  id.data[i + 1] = g;
  id.data[i + 2] = b;
  id.data[i + 3] = a;
}

// implementation of the "painter's algorithm" aka "source-over" blending
export const paint = (src, dest) => {
  let a1 = src[3] / 255;
  let a2 = dest[3] / 255;
  return [
    src[0] * a1 + dest[0] * a2 * (1 - a1),
    src[1] * a1 + dest[1] * a2 * (1 - a1),
    src[2] * a1 + dest[2] * a2 * (1 - a1),
    (a1 + a2 * (1 - a1)) * 255,
  ];
};

// calculates color "between" pixels using bilinear interpolation
export function samplePixel(id, x, y) {
  let x1 = Math.floor(x);
  let x2 = Math.ceil(x);
  let y1 = Math.floor(y);
  let y2 = Math.ceil(y);
  let ix = ((x % 1) + 1) % 1;
  let iy = ((y % 1) + 1) % 1;
  // return getPixel(id, Math.round(x),Math.round(y));
  return clerp(
    clerp(getPixel(id, x1, y1), getPixel(id, x2, y1), ix),
    clerp(getPixel(id, x1, y2), getPixel(id, x2, y2), ix),
    iy
  );
}

export const bezier3 = (a, b, c, t) => lerp(lerp(a, b, t), lerp(b, c, t), t);

export const bezier4 = (a, b, c, d, t) =>
  lerp(bezier3(a, b, c, t), bezier3(b, c, d, t), t);

export function bezier(x2, y2, x3, y3, t) {
  return [bezier4(0, x2, x3, 1, t), bezier4(0, y2, y3, 1, t)];
}

// converts bezier to cartesian space and finds y given x
export function bezierAlgebraic(x2, y2, x3, y3, x) {
  let t = 0.5;
  let step = 0.5;
  const EPSILON = 1 / 512;
  while (step > EPSILON) {
    let current = bezier(x2, y2, x3, y3, t)[0];
    let tplus = bezier(x2, y2, x3, y3, Math.min(t + step, 1))[0];
    let tminus = bezier(x2, y2, x3, y3, Math.max(t - step, 0))[0];
    let d = Math.abs(current - x);
    let dplus = Math.abs(tplus - x);
    let dminus = Math.abs(tminus - x);
    if (dplus < dminus && dplus < d) {
      t = Math.min(t + step, 1);
    } else if (dminus < dplus && dminus < d) {
      t = Math.max(t - step, 0);
    }
    step = step / 2;
  }
  return t;
}

export function bezierByX(x1, y1, x2, y2, x) {
  return bezier(x1, y1, x2, y2, bezierAlgebraic(x1, y1, x2, y2, x));
}
