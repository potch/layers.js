// helpers
const isDef = o => typeof o !== "undefined";
const PERCENT_RE = /^(\d+(\.\d+)?)%$/;
const percent = string => parseFloat(string.match(PERCENT_RE)[1]) / 100;

// internal state
const registeredFilters = new Map();
const imageCache = new Map();

// we can't assume that a runtime environment has the DOM/canvas
// so we can swap out for other canvas implementations
export const DOMCanvasEngine = {
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
      i.onerror = () => reject();
      i.src = url;
    });
  },
};

let canvasEngine = DOMCanvasEngine;

export function useCanvasEngine(engine) {
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

// the main rendering function
// takes a "stack", consisting of { width, height, layers: [] }
// optionally takes a canvas and a dom container to place it in
// returns a canvas
export async function render(stack, { canvas, container } = {}) {
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
      // optionally accept an Image object as source
      let image = layer.image.source;
      if (layer.image.url) {
        try {
          image = await canvasEngine.loadImage(layer.image.url);
        } catch (e) {
          console.warn("Unable to load image " + layer.image.url, e);
        }
      }
      if (image) {
        // Image layer
        let anchor = layer.image.anchor;
        let position = layer.image.position;
        let size = layer.image.size;
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
          let scale = Math.min(image.width / WIDTH, image.height / HEIGHT);
          iWidth = image.width / scale;
          iHeight = image.height / scale;
        }
        if (size === "contain") {
          let scale = Math.max(image.width / WIDTH, image.height / HEIGHT);
          iWidth = image.width / scale;
          iHeight = image.height / scale;
        }
        if (typeof size === "string" && PERCENT_RE.test(size)) {
          let pct = percent(size);
          let scale = Math.max(image.width / WIDTH, image.height / HEIGHT);
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
    } else if (layer.filter) {
      // Filter layer
      let filter;
      if (
        typeof layer.filter === "string" &&
        registeredFilters.has(layer.filter)
      ) {
        filter = registeredFilters.get(layer.filter);
      }
      if (typeof layer.filter === "function") {
        filter = layer.filter;
      }
      if (filter) {
        let id = await filter(
          ctx.getImageData(0, 0, WIDTH, HEIGHT),
          layer.filterOptions
        );
        ctx.putImageData(id, 0, 0);
      } else {
        console.warn(`failed to apply unknown filter "${layer.filter}"`);
      }
    } else if (layer.group) {
      // Layer group
      let group = await render({
        width: WIDTH,
        height: HEIGHT,
        layers: layer.group,
      });
      ctx.drawImage(group, 0, 0);
    } else if (layer.text) {
      // Text layer
      let text = layer.text;
      let font = text.font || {};
      let family = font.family || "sans-serif";
      let size = font.size || "12px";
      let weight = font.weight || "normal";
      ctx.fillStyle = text.color || "#000";
      ctx.strokeStyle = text.stroke || "#000";
      ctx.lineWidth = text.strokeWidth || 1;
      ctx.font = `${weight} ${size} ${family}`;
      ctx.textAlign = text.align || "center";
      ctx.textBaseline = text.verticalAlign || "middle";
      let position = text.position;
      let placement = placeRect({ width: 0, height: 0 }, canvasRect, position);
      if ("stroke" in text) {
        ctx.lineJoin = "round";
        ctx.strokeText(text.text, placement.x, placement.y);
      }
      ctx.fillText(text.text, placement.x, placement.y);
    } else if (layer.shape) {
      // Shape layer
      let shape = layer.shape;
      let anchor = shape.anchor;
      let position = shape.position;
      let width = 0;
      let height = 0;
      if (shape.width) {
        let w = shape.width;
        if (typeof w === "string" && PERCENT_RE.test(w)) {
          let pct = percent(w);
          width = WIDTH * pct;
        } else {
          width = w;
        }
        if (!("height" in shape)) {
          height = w;
        }
      }
      if (shape.height) {
        let h = shape.height;
        if (typeof h === "string" && PERCENT_RE.test(h)) {
          let pct = percent(h);
          height = HEIGHT * pct;
        } else {
          height = h;
        }
        if (!("width" in shape)) {
          width = h;
        }
      }

      let placement = placeRect(
        { width, height },
        canvasRect,
        position,
        anchor
      );
      ctx.fillStyle = shape.color;
      ctx.strokeStyle = shape.stroke;
      let type = shape.type;
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
    } else if (layer.fill) {
      // Basic fill layer
      ctx.fillStyle = layer.fill;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    ctx.restore();
  }
  return canvas;
}

// helper class for interactive layer stacks
export class Stack {
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
export function registerFilter(name, filter) {
  registeredFilters.set(name, filter);
}
