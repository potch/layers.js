var Layers = (function (exports) {
  'use strict';

  // helpers
  const isDef = o => typeof o !== "undefined";
  const PERCENT_RE = /^(\d+(\.\d+)?)%$/;
  const percent = string => parseFloat(string.match(PERCENT_RE)[1]) / 100;

  // internal state
  const registeredFilters = new Map();
  const imageCache = new Map();

  // we can't assume that a runtime environment has the DOM/canvas
  // so we can swap out for other canvas implementations
  const DOMCanvasEngine = {
    createCanvas(width, height) {
      let canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    loadImage(url) {
      if (imageCache.has(url)) {
        return imageCache.get(url);
      }
      return new Promise((resolve, reject) => {
        let i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => {
          imageCache.set(url, i);
          resolve(i);
        };
        i.onerror = () => {
          console.warn("error loading image:", url);
          reject();
        };
        i.src = url;
      });
    },
  };

  let canvasEngine = DOMCanvasEngine;

  function useCanvasEngine(engine) {
    canvasEngine = engine;
  }

  // Functions for calculating placements of layer content
  // simple primitive used for layout
  const rect = ({ x = 0, y = 0, width, height, x2, y2 }) => {
    if (!isDef(width) && isDef(x2)) {
      width = Math.abs(x2 - x);
    }
    if (x > x2) {
      [x2, x] = [x, x2];
    }
    if (!isDef(height) && isDef(y2)) {
      height = Math.abs(y2 - y);
    }
    if (y > y2) {
      [y2, y] = [y, y2];
    }
    return {
      x,
      y,
      width,
      height,
    };
  };

  // place rectangle a in rectangle b
  // anchor refers to the point on a to be positioned within b
  function placeRect(a, b, position, anchor) {
    // assume it's the center unless otherwise defined
    let anchorX = a.width / 2;
    let anchorY = a.height / 2;
    let posX = b.width / 2;
    let posY = b.height / 2;
    if (anchor) {
      if (anchor.x) {
        let a = anchor.x;
        if (typeof a === "string") {
          if (PERCENT_RE.test(a)) {
            anchorX = a.width * percent(a);
          } else if (a === "left") {
            anchorX = 0;
          } else if (a === "right") {
            anchorX = a.width;
          }
        }
        if (typeof a === "number") {
          anchorX = a;
        }
      }
      if (anchor.y) {
        let a = anchor.y;
        if (typeof a === "string") {
          if (PERCENT_RE.test(a)) {
            anchorY = b.height * percent(a);
          } else if (a === "top") {
            anchorY = 0;
          } else if (a === "bottom") {
            anchorY = b.height;
          }
        }
        if (typeof a === "number") {
          anchorY = a;
        }
      }
    }
    // TODO support string positions like "top right" or "60% 40px"
    if (position) {
      if (position.x) {
        let pos = position.x;
        if (typeof pos === "string") {
          if (PERCENT_RE.test(pos)) {
            posX = b.width * percent(pos);
          } else if (pos === "left") {
            posX = 0;
          } else if (pos === "right") {
            posX = b.width;
          }
        }
        if (typeof pos === "number") {
          posY = pos;
        }
      }
      if (position.y) {
        let pos = position.y;
        if (typeof pos === "string") {
          if (PERCENT_RE.test(pos)) {
            posY = b.height * percent(pos);
          } else if (pos === "top") {
            posY = 0;
          } else if (pos === "bottom") {
            posY = b.height;
          }
        }
        if (typeof pos === "number") {
          posY = pos;
        }
      }
    }
    return {
      x: posX - anchorX,
      y: posY - anchorY,
    };
  }

  function parsePlacement(canvasRect, p) {
    if (typeof p === "object") {
      if (!("x" in p)) {
        p.x = "center";
      }
      if (!("y" in p)) {
        p.y = "center";
      }
      if (typeof p.y === "string") {
        if (PERCENT_RE.test(p.y)) {
          p.y = canvasRect.height * percent(p.y);
        } else if (p.y === "top") {
          p.y = 0;
        } else if (p.y === "center") {
          p.y = canvasRect.height / 2;
        } else if (p.y === "bottom") {
          p.y = canvasRect.height;
        }
      }
      if (typeof p.x === "string") {
        if (PERCENT_RE.test(p.x)) {
          p.x = canvasRect.width * percent(p.x);
        } else if (p.x === "top") {
          p.x = 0;
        } else if (p.x === "center") {
          p.x = canvasRect.width / 2;
        } else if (p.x === "bottom") {
          p.x = canvasRect.width;
        }
      }
      return p;
    }
    return {
      x: canvasRect.width / 2,
      y: canvasRect.height / 2,
    };
  }

  function parseFill(ctx, canvasRect, fill) {
    if (typeof fill === "string") return fill;
    if (typeof fill === "object") {
      if (fill.gradient) {
        let { start, end, colors } = fill.gradient;
        start = start
          ? parsePlacement(canvasRect, start)
          : { x: canvasRect.width / 2, y: 0 };
        end = end
          ? parsePlacement(canvasRect, end)
          : { x: canvasRect.width / 2, y: canvasRect.height };
        let gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        colors.forEach((stop, i) => {
          let position = i / (colors.length - 1);
          let color = stop;
          if (stop instanceof Array) {
            position = stop[0];
            color = stop[1];
          }
          gradient.addColorStop(position, color);
        });
        return gradient;
      }
    }
  }

  // the main rendering function
  // takes a "stack", consisting of { width, height, layers: [] }
  // optionally takes a canvas and a dom container to place it in
  // returns a canvas
  async function render(stack, { canvas, container } = {}) {
    if (stack instanceof Stack) {
      stack = stack.stack;
    }
    const { width: WIDTH, height: HEIGHT, layers } = stack;
    if (!canvas) {
      canvas = canvasEngine.createCanvas(WIDTH, HEIGHT);
    }
    if (container) {
      let containerEl;
      if (container instanceof HTMLElement) {
        containerEl = container;
      } else if (typeof container === "string") {
        containerEl = document.querySelector(container);
      }
      if (containerEl && canvas.parentNode !== containerEl) {
        containerEl.append(canvas);
      }
    }

    // avoid resizing canvas if unneccesary
    if (canvas.width !== WIDTH) canvas.width = WIDTH;
    if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
    let canvasRect = rect({ width: WIDTH, height: HEIGHT });

    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // render layers from bottom to top
    for (let i = layers.length - 1; i >= 0; i--) {
      let layer = layers[i];
      if (layer.disabled) continue;

      // save transforms and styles
      ctx.save();
      ctx.globalCompositeOperation = layer.mode || "source-over";
      ctx.globalAlpha = layer.opacity || 1;

      // layer transforms
      if (layer.transform) {
        if (layer.transform.x || layer.transform.y) {
          ctx.translate(layer.transform.x || 0, layer.transform.y || 0);
        }
        if (layer.transform.rotate) {
          ctx.translate(WIDTH / 2, HEIGHT / 2);
          ctx.rotate((layer.transform.rotate * Math.PI) / 180);
          ctx.translate(-WIDTH / 2, -HEIGHT / 2);
        }
      }

      if (layer.image) {
        await renderImageLayer(ctx, canvasRect, layer.image);
      } else if (layer.filter) {
        await renderFilterLayer(
          ctx,
          canvasRect,
          layer.filter,
          layer.filterOptions
        );
      } else if (layer.group) {
        // Layer group
        let group = await render({
          width: WIDTH,
          height: HEIGHT,
          layers: layer.group,
        });
        ctx.drawImage(group, 0, 0);
      } else if (layer.text) {
        renderTextLayer(ctx, canvasRect, layer.text);
      } else if (layer.shape) {
        renderShapeLayer(ctx, canvasRect, layer.shape);
      } else if (layer.fill) {
        // Basic fill layer
        ctx.fillStyle = parseFill(ctx, canvasRect, layer.fill);
        ctx.fillRect(
          canvasRect.x,
          canvasRect.y,
          canvasRect.width,
          canvasRect.height
        );
      }

      ctx.restore();
    }
    return canvas;
  }

  async function renderImageLayer(
    ctx,
    canvasRect,
    { source, url, anchor, position, size }
  ) {
    // optionally accept an Image object as source
    let image = source;
    if (!image && url) {
      try {
        image = await canvasEngine.loadImage(url);
      } catch (e) {
        console.warn("Unable to load image " + url, e);
      }
    }
    if (!image) return;
    let iWidth = image.width;
    let iHeight = image.height;
    // compute rendered image size
    if (size.width) {
      iWidth = size.width;
      if (!size.height) {
        iHeight = (image.height / image.width) * iWidth;
      }
    }
    if (size.height) {
      iHeight = size.height;
      if (!size.height) {
        iWidth = (image.width / image.height) * iHeight;
      }
    }
    if (size === "cover") {
      let scale = Math.min(
        image.width / canvasRect.width,
        image.height / canvasRect.height
      );
      iWidth = image.width / scale;
      iHeight = image.height / scale;
    }
    if (size === "contain") {
      let scale = Math.max(
        image.width / canvasRect.width,
        image.height / canvasRect.height
      );
      iWidth = image.width / scale;
      iHeight = image.height / scale;
    }
    if (typeof size === "string" && PERCENT_RE.test(size)) {
      let pct = percent(size);
      let scale = Math.max(
        image.width / canvasRect.width,
        image.height / canvasRect.height
      );
      iWidth = (image.width / scale) * pct;
      iHeight = (image.height / scale) * pct;
    }
    // generate placement
    let placement = placeRect(
      {
        width: iWidth,
        height: iHeight,
      },
      canvasRect,
      position,
      anchor
    );
    ctx.drawImage(image, placement.x, placement.y, iWidth, iHeight);
  }

  function renderTextLayer(
    ctx,
    canvasRect,
    {
      text,
      font: { weight = "normal", size = "12px", family = "sans-serif" },
      fill = "#000",
      stroke = "#000",
      strokeWidth = 1,
      align = "center",
      verticalAlign = "middle",
      position,
    }
  ) {
    ctx.fillStyle = parseFill(ctx, canvasRect, fill);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.font = `${weight} ${size} ${family}`;
    ctx.textAlign = align;
    ctx.textBaseline = verticalAlign;
    let placement = placeRect({ width: 0, height: 0 }, canvasRect, position);
    if (stroke) {
      ctx.lineJoin = "round";
      ctx.strokeText(text, placement.x, placement.y);
    }
    ctx.fillText(text, placement.x, placement.y);
  }

  async function renderFilterLayer(ctx, canvasRect, filter, options) {
    if (typeof filter === "string" && registeredFilters.has(filter)) {
      filter = registeredFilters.get(filter);
    } else if (typeof filter === "function") {
      filter = filter;
    } else {
      console.warn(`failed to apply invalid filter "${filter}"`);
      return;
    }
    if (filter) {
      let id = await filter(
        ctx.getImageData(0, 0, canvasRect.width, canvasRect.height),
        options
      );
      ctx.putImageData(id, 0, 0);
    } else {
      console.warn(`failed to apply unknown filter "${layer.filter}"`);
    }
  }

  function renderShapeLayer(
    ctx,
    canvasRect,
    { anchor, position, type, width, height, fill = "#000", stroke }
  ) {
    if (width) {
      if (typeof width === "string" && PERCENT_RE.test(width)) {
        let pct = percent(width);
        width = canvasRect.width * pct;
      }
      if (!height) {
        height = width;
      }
    }
    if (height) {
      if (typeof height === "string" && PERCENT_RE.test(height)) {
        let pct = percent(height);
        height = canvasRect.height * pct;
      }
      if (!width) {
        width = height;
      }
    }

    let placement = placeRect({ width, height }, canvasRect, position, anchor);
    ctx.fillStyle = parseFill(ctx, canvasRect, fill);
    if (stroke) ctx.strokeStyle = stroke;
    if (type === "ellipse") {
      // ellipse/circle
      ctx.beginPath();
      ctx.ellipse(
        placement.x + width / 2,
        placement.y + height / 2,
        width / 2,
        height / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else {
      // default is rectangle
      ctx.fillRect(placement.x, placement.y, width, height);
    }
  }

  // helper class for interactive layer stacks
  class Stack {
    constructor(stack, { canvas, container } = {}) {
      this.stack = stack || {
        layers: [],
        width: 1,
        height: 1,
      };
      this.canvas = canvas;
      this.container = container;
    }

    layer(id) {
      if (typeof id === "number") {
        return this.stack.layers[id];
      } else if (typeof id === "string") {
        return this.stack.layers.find(l => l.name === id);
      }
    }

    render({ canvas, container } = {}) {
      return render(this.stack, {
        canvas: canvas || this.canvas,
        container: container || this.container,
      });
    }
  }

  /* filters */
  function registerFilter(name, filter) {
    registeredFilters.set(name, filter);
  }

  // interpolation
  const lerp = (a, b, i) => a + i * (b - a);
  // color interpolation
  const clerp = (a, b, i) => [
    lerp(a[0], b[0], i),
    lerp(a[1], b[1], i),
    lerp(a[2], b[2], i),
    lerp(a[3], b[3], i),
  ];

  // get pixel value at x/y of imagedata
  function getPixel(id, x, y) {
    if (x < 0 || y < 0 || x >= id.width || y >= id.height) {
      return [0, 0, 0, 0];
    }
    let i = (y * id.width + x) * 4;
    return id.data.slice(i, i + 4);
  }

  // set pixel value at x/y of imagedata
  function setPixel(id, x, y, r, g, b, a = 255) {
    let i = (y * id.width + x) * 4;
    id.data[i] = r;
    id.data[i + 1] = g;
    id.data[i + 2] = b;
    id.data[i + 3] = a;
  }

  // implementation of the "painter's algorithm" aka "source-over" blending
  const paint = (src, dest) => {
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
  function samplePixel(id, x, y) {
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

  const bezier3 = (a, b, c, t) => lerp(lerp(a, b, t), lerp(b, c, t), t);

  const bezier4 = (a, b, c, d, t) =>
    lerp(bezier3(a, b, c, t), bezier3(b, c, d, t), t);

  function bezier(x2, y2, x3, y3, t) {
    return [bezier4(0, x2, x3, 1, t), bezier4(0, y2, y3, 1, t)];
  }

  // converts bezier to cartesian space and finds y given x
  function bezierAlgebraic(x2, y2, x3, y3, x) {
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

  function bezierByX(x1, y1, x2, y2, x) {
    return bezier(x1, y1, x2, y2, bezierAlgebraic(x1, y1, x2, y2, x));
  }

  var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    lerp: lerp,
    clerp: clerp,
    getPixel: getPixel,
    setPixel: setPixel,
    paint: paint,
    samplePixel: samplePixel,
    bezier3: bezier3,
    bezier4: bezier4,
    bezier: bezier,
    bezierAlgebraic: bezierAlgebraic,
    bezierByX: bezierByX
  });

  // converts to grayscale based on luminosity
  function GrayscaleFilter(imageData) {
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
  function ContrastFilter(imageData, { amount }) {
    let data = imageData.data;
    for (let i = 0; i < data.length; i = i + 4) {
      data[i] = (data[i] - 128) * amount + 128;
      data[i + 1] = (data[i + 1] - 128) * amount + 128;
      data[i + 2] = (data[i + 2] - 128) * amount + 128;
    }
    return imageData;
  }

  // applies a bezier curve to component
  function CurvesFilter(imageData, { x1, y1, x2, y2, amount }) {
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

  function DisplacementFilter(
    imageData,
    { displace = identityDisplacement }
  ) {
    let id = new ImageData(imageData.data.slice(0), imageData.width);
    let { data, width, height } = id;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let [dx, dy] = displace(x, y);
        let c = samplePixel(imageData, x - dx, y - dy);
        setPixel(id, x, y, ...c);
      }
    }
    return id;
  }

  const identityProjection = (x, y) => [x, y];

  function ProjectionFilter(imageData, { project = identityProjection }) {
    let id = new ImageData(imageData.data.slice(0), imageData.width);
    let { data, width, height } = id;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let [px, py] = project(x, y);
        let c = samplePixel(imageData, px, py);
        setPixel(id, x, y, ...c);
      }
    }
    return id;
  }

  var _filters = /*#__PURE__*/Object.freeze({
    __proto__: null,
    GrayscaleFilter: GrayscaleFilter,
    ContrastFilter: ContrastFilter,
    CurvesFilter: CurvesFilter,
    DisplacementFilter: DisplacementFilter,
    ProjectionFilter: ProjectionFilter
  });

  registerFilter("grayscale", GrayscaleFilter);
  registerFilter("displacment", DisplacementFilter);
  registerFilter("contrast", ContrastFilter);
  registerFilter("curves", CurvesFilter);
  registerFilter("projection", ProjectionFilter);

  const filters = _filters;

  exports.DOMCanvasEngine = DOMCanvasEngine;
  exports.Stack = Stack;
  exports.filters = filters;
  exports.registerFilter = registerFilter;
  exports.render = render;
  exports.useCanvasEngine = useCanvasEngine;
  exports.utils = utils;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
