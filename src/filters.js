import { setPixel, samplePixel, getPixel, bezierByX } from "./utils.js";

// converts to grayscale based on luminosity
export function GrayscaleFilter(imageData) {
  let data = imageData.data;
  for (let i = 0; i < data.length; i = i + 4) {
    let red = data[i];
    let green = data[i + 1];
    let blue = data[i + 2];
    // https://en.wikipedia.org/wiki/YUV#Conversion_to/from_RGB
    let gray = 0.299 * red + 0.587 * green + 0.114 * blue;
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  return imageData;
}

// takes color values and scales them from midpoint
export function ContrastFilter(imageData, { amount }) {
  let data = imageData.data;
  for (let i = 0; i < data.length; i = i + 4) {
    data[i] = (data[i] - 128) * amount + 128;
    data[i + 1] = (data[i + 1] - 128) * amount + 128;
    data[i + 2] = (data[i + 2] - 128) * amount + 128;
  }
  return imageData;
}

// applies a bezier curve to component
export function CurvesFilter(imageData, { x1, y1, x2, y2, amount }) {
  let data = imageData.data;

  if (typeof amount === "number") {
    x1 = Math.max(Math.min(0.5 + amount / 2, 1), 0);
    y1 = Math.min(Math.max(0.5 - amount / 2, 0), 1);
    x2 = Math.min(Math.max(0.5 - amount / 2, 0), 1);
    y2 = Math.max(Math.min(0.5 + amount / 2, 1), 0);
  }

  const memo = {};
  const curve = v => {
    if (!(v in memo)) {
      memo[v] = bezierByX(x1, y1, x2, y2, v / 255)[1] * 255;
    }
    return memo[v];
  };

  for (let i = 0; i < data.length; i = i + 4) {
    data[i] = curve(data[i]);
    data[i + 1] = curve(data[i + 1]);
    data[i + 2] = curve(data[i + 2]);
  }
  return imageData;
}

const identityDisplacement = (x, y) => [0, 0];

export function DisplacementFilter(
  imageData,
  { displace = identityDisplacement }
) {
  let id = new ImageData(imageData.data.slice(0), imageData.width);
  let { data, width, height } = id;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = (y * width + x) * 4;
      let [dx, dy] = displace(x, y);
      let c = samplePixel(imageData, x - dx, y - dy, "hold");
      setPixel(id, x, y, ...c);
    }
  }
  return id;
}

const identityProjection = (x, y) => [x, y];

export function ProjectionFilter(imageData, { project = identityProjection }) {
  let id = new ImageData(imageData.data.slice(0), imageData.width);
  let { data, width, height } = id;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = (y * width + x) * 4;
      let [px, py] = project(x, y);
      let c = samplePixel(imageData, px, py, "hold");
      setPixel(id, x, y, ...c);
    }
  }
  return id;
}

// TODO finish these
function spherize(cx, cy, radius, amount) {
  return function (x, y) {
    let a = Math.atan2(y - cy, x - cx);
    let d = Math.hypot(x - cx, y - cy);
    if (d < radius) {
      let s = Math.pow(d / radius, amount) * radius;
      return [cx + s * Math.cos(a), cy + s * Math.sin(a)];
    }
    return [x, y];
  };
}

function composeProjections(...fns) {
  return function (x, y) {
    return fns.reduce(
      (out, fn) => {
        return fn(...out);
      },
      [x, y]
    );
  };
}
