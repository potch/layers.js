var Layers = (function (exports) {
  'use strict';

  const lerp = (a, b, i) => a + i * (b - a);
  const clerp = (a, b, i) => [
    lerp(a[0], b[0], i),
    lerp(a[1], b[1], i),
    lerp(a[2], b[2], i),
    lerp(a[3], b[3], i)
  ];

  function getPixel(id, x, y) {
    if (x < 0 || y < 0 || x >= id.width || y >= id.height) {    
      return [0,0,0,0]
    }
    let i = (y * id.width + x) * 4;
    return id.data.slice(i, i + 4);
  }

  function setPixel(id, x, y, r, g, b, a) {
    let i = (y * id.width + x) * 4;
    id.data[i] = r;
    id.data[i+1] = g;
    id.data[i+2] = b;
    id.data[i+3] = a;
  }

  const paint = (src, dest) => {
    let a1 = src[3] / 255;
    let a2 = dest[3] / 255;
    return [
      src[0] * a1 + dest[0] * a2 * (1 - a1),
      src[1] * a1 + dest[1] * a2 * (1 - a1),
      src[2] * a1 + dest[2] * a2 * (1 - a1),
      (a1 + a2 * (1 - a1)) * 255
    ];
  };

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

  const bezier3 = (a, b, c, t) => lerp(
    lerp(a, b, t),
    lerp(b, c, t),
    t
  );

  const bezier4 = (a, b, c, d, t) => lerp(
    bezier3(a, b, c, t),
    bezier3(b, c, d, t),
    t
  );

  function bezier(x2, y2, x3, y3, t) {
    return [
      bezier4(0, x2, x3, 1, t),
      bezier4(0, y2, y3, 1, t)
    ];
  }

  function bezierAlgebraic(x2, y2, x3, y3, x) {
    let t = 0.5;
    let step = 0.5;
    const EPSILON = 1/512;
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

  var _utils = /*#__PURE__*/Object.freeze({
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

  const utils = _utils;

  const cache = {};

  const isDef = o => typeof o !== 'undefined';
  const PERCENT_RE = /^(\d+(\.\d+)?)%$/;

  const rect = ({x=0, y=0, width, height, x2, y2}) => {
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
      x, y, width, height
    }
  };


  function placeRect(a, b, position, anchor) {
    let anchorX = a.width / 2;
    let anchorY = a.height / 2;
    let posX = b.width / 2;
    let posY = b.height / 2;
    if (anchor) {
      if (anchor.x) {              
        let a = anchor.x;
        if (typeof a === 'string') {
          if (PERCENT_RE.test(a)) {
            let pct = parseFloat(a.match(PERCENT_RE)[1]) / 100;
            anchorX = a.width * pct;
          } else if (a === 'left') {
            anchorX = 0;
          } else if (a === 'right') {
            anchorX = a.width;
          }
        }
        if (typeof a === 'number') {
          anchorX = a;
        }
      }
      if (anchor.y) {              
        let a = anchor.y;
        if (typeof a === 'string') {
          if (PERCENT_RE.test(a)) {
            let pct = parseFloat(a.match(PERCENT_RE)[1]) / 100;
            anchorY = b.height * pct;
          } else if (a === 'top') {
            anchorY = 0;
          } else if (a === 'bottom') {
            anchorY = b.height;
          }
        }
        if (typeof a === 'number') {
          anchorY = a;
        }
      }
    }
    if (position) {
      if (position.x) {
        let pos = position.x;
        if (typeof pos === 'string') {
          if (PERCENT_RE.test(pos)) {
            let pct = parseFloat(pos.match(PERCENT_RE)[1]) / 100;
            posX = b.width * pct;
          } else if (pos === 'left') {
            posX = 0;
          } else if (pos === 'right') {
            posX = b.width;
          }
        }
        if (typeof pos === 'number') {
          posY = pos;
        }
      }
      if (position.y) {
        let pos = position.y;
        if (typeof pos === 'string') {
          if (PERCENT_RE.test(pos)) {
            let pct = parseFloat(pos.match(PERCENT_RE)[1]) / 100;
            posY = b.height * pct;
          } else if (pos === 'top') {
            posY = 0;
          } else if (pos === 'bottom') {
            posY = b.height;
          }
        }
        if (typeof pos === 'number') {
          posY = pos;
        }
      }
    }
    return {
      x: posX - anchorX,
      y: posY - anchorY
    }
  }

  class Stack {
    constructor({ canvas, width, height, layers, container }) {
      this.layers = layers || [];
      this.canvas = canvas || document.createElement("canvas");
      if (container) {
        if (container instanceof HTMLElement) {
          container.append(this.canvas);
        } else if (typeof container === 'string') {
          document.querySelector(container).append(this.canvas);
        }
      }
      this.width = width;
      this.height = height;
    }

    layer(id) {
      if (typeof id === "number") {
        return this.layers[id];
      } else if (typeof id === "string") {
        return this.layers.find(l => l.name === id);
      }
    }

    async draw() {
      let ctx = this.canvas.getContext("2d");
      ctx.clearRect(0, 0, this.width, this.height);
      for (let i = this.layers.length - 1; i >= 0; i--) {
        let layer = this.layers[i];
        if (layer.disabled) continue;
        
        ctx.save();
        ctx.globalCompositeOperation = layer.mode || "source-over";
        ctx.globalAlpha = layer.opacity || 1;
        
        if (layer.transform) {
          if (layer.transform.x || layer.transform.y) {
            ctx.translate(layer.transform.x || 0, layer.transform.y || 0);
          }
          if (layer.transform.rotate) {
            ctx.translate(this.width / 2, this.height / 2);
            ctx.rotate(layer.transform.rotate * Math.PI / 180);
            ctx.translate(-this.width / 2, -this.height / 2);
          }
        }
              
        if (layer.image) {
          let image = layer.image.source;
          if (layer.image.url) {
            try {
              image = await this.loadImage(layer.image.url);
            } catch (e) {
              console.warn("Unable to load image " + layer.image.url, e);
            }
          }
          if (image) {
            let anchor = layer.image.anchor;
            let position = layer.image.position;
            let size = layer.image.size;
            let iWidth = image.width;
            let iHeight = image.height;
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
                image.width / this.width,
                image.height / this.height
              );
              iWidth = image.width / scale;
              iHeight = image.height / scale;
            }
            if (size === "contain") {
              let scale = Math.max(
                image.width / this.width,
                image.height / this.height
              );
              iWidth = image.width / scale;
              iHeight = image.height / scale;
            }
            if (typeof size === 'string' && PERCENT_RE.test(size)) {
              let pct = parseFloat(size.match(PERCENT_RE)[1]) / 100;
              let scale = Math.max(
                image.width / this.width,
                image.height / this.height
              );
              iWidth = image.width / scale * pct;
              iHeight = image.height / scale * pct;
            }
            let placement = placeRect({
              width: iWidth,
              height: iHeight
            }, rect(this), position, anchor);
            ctx.drawImage(image, placement.x, placement.y, iWidth, iHeight);
          }
        } else if (layer.draw) {
          await layer.draw(ctx, this);
        } else if (layer.filter) {
          let id = await layer.filter(
            ctx.getImageData(0, 0, this.width, this.height),
            layer.filterOptions
          );
          ctx.putImageData(id, 0, 0);
        } else if (layer.group) {
          let group = new Stack({
            width: this.width,
            height: this.height,
            layers: layer.group
          });
          await group.draw();
          ctx.drawImage(group.canvas, 0, 0);
        } else if (layer.text) {
          let font = layer.font || {};
          let family = font.family || 'sans-serif';
          let size = font.size || '12px';
          let weight = font.weight || 'normal';
          ctx.fillStyle = layer.color || '#000';
          ctx.strokeStyle = layer.stroke || '#000';
          ctx.lineWidth = layer.strokeWidth || 1;
          ctx.font = `${weight} ${size} ${family}`;
          ctx.textAlign = font.align || 'center';
          ctx.textBaseline = font.verticalAlign || 'middle';
          let position = layer.position;
          let placement = placeRect({ width: 0, height: 0 }, this, position);
          if ('stroke' in layer) {
            ctx.lineJoin = "round";
            ctx.strokeText(layer.text, placement.x, placement.y);
          }
          ctx.fillText(layer.text, placement.x, placement.y);
        } else if (layer.shape) {
          let shape = layer.shape;
          let anchor = shape.anchor;
          let position = shape.position;
          let width = 0;
          let height = 0;
          if (shape.width) {
            let w = shape.width;
            if (typeof w === 'string' && PERCENT_RE.test(w)) {
              let pct = parseFloat(w.match(PERCENT_RE)[1]) / 100;
              width = this.width * pct;
            } else {
              width = w;
            }
            if (!('height' in shape)) {
              height = w;
            }
          }
          if (shape.height) {
            let h = shape.height;
            if (typeof h === 'string' && PERCENT_RE.test(h)) {
              let pct = parseFloat(h.match(PERCENT_RE)[1]) / 100;
              height = this.height * pct;
            } else {
              height = h;
            }
            if (!('width' in shape)) {
              width = h;
            }
          }
          
          let placement = placeRect({ width, height }, this, position, anchor);
          ctx.fillStyle = layer.fill;
          ctx.strokeStyle = layer.stroke;
          let type = shape.type;
          if (type === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse(
              placement.x + width / 2, placement.y + height / 2,
              width / 2, height / 2,
              0, 0, Math.PI * 2
            );
            ctx.fill();
          } else {
            ctx.fillRect(placement.x, placement.y, width, height);
          }
        } else if (layer.fill) {
          ctx.fillStyle = layer.fill;
          ctx.fillRect(0, 0, this.width, this.height);
        }
        
        ctx.restore();
      }
      return this.canvas;
    }

    loadImage(url) {
      if (cache[url]) {
        return cache[url];
      }
      return new Promise((resolve, reject) => {
        let i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => {
          cache[url] = i;
          resolve(i);
        };
        i.onerror = () => reject();
        i.src = url;
      });
    }
    
    set width(w) {
      this.canvas.width = w;
    }
    get width() {
      return this.canvas.width;
    }

    set height(h) {
      this.canvas.height = h;
    }
    get height() {
      return this.canvas.height;
    }
  }

  const { setPixel: setPixel$1, samplePixel: samplePixel$1, getPixel: getPixel$1 } = _utils;

  const filters = {
    
    GrayscaleFilter(imageData) {
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
    },

    ContrastFilter(imageData, { amount }) {
      let data = imageData.data;
      for (let i = 0; i < data.length; i = i + 4) {
        data[i] = (data[i] - 128) * amount + 128;
        data[i + 1] = (data[i + 1] - 128) * amount + 128;
        data[i + 2] = (data[i + 2] - 128) * amount + 128;
      }
      return imageData;
    },
    
    CurvesFilter(imageData, { x1, y1, x2, y2, amount }) {
      let data = imageData.data;
      
      if (typeof amount === 'number') {
        x1 = Math.max(Math.min(.5 + amount / 2, 1), 0);
        y1 = Math.min(Math.max(.5 - amount / 2, 0), 1);
        x2 = Math.min(Math.max(.5 - amount / 2, 0), 1);
        y2 = Math.max(Math.min(.5 + amount / 2, 1), 0);
      }
      
      const memo = {};
      const curve = v => {
        if (!(v in memo)) {
          memo[v] = utils.bezierByX(x1, y1, x2, y2, v / 255)[1] * 255;
        }
        return memo[v];
      };
      
      for (let i = 0; i < data.length; i = i + 4) {
        data[i] = curve(data[i]);
        data[i + 1] = curve(data[i + 1]);
        data[i + 2] = curve(data[i + 2]);
      }
      return imageData;
    },
    
    DisplacementFilter(imageData, { displace }) {
      let id = new ImageData(imageData.data.slice(0),imageData.width);
      let { data, width, height } = id;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let [dx, dy] = displace(x, y);
          let c = samplePixel$1(imageData, x - dx, y - dy, 'hold');
          setPixel$1(id, x, y, ...c);
        }
      }
      return id;
    },
    
    ProjectionFilter(imageData, { project }) {
      let id = new ImageData(imageData.data.slice(0),imageData.width);
      let { data, width, height } = id;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let [px, py] = project(x, y);
          let c = samplePixel$1(imageData, px, py, 'hold');
          setPixel$1(id, x, y, ...c);
        }
      }
      return id;
    }
  };

  exports.Stack = Stack;
  exports.filters = filters;
  exports.utils = utils;

  return exports;

}({}));
