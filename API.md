# Layers.js API Documentation

## Drawing

### `render(stack[, options])`

draws a canvas using the provided data:

- `stack`: (required) [`<StackDescription>`](#stackdescription)
- `options`:
  - `canvas`: HTMLCanvas (browser) or Canvas (node). If not provided, a canvas will be created.
  - `container`: HTMLElement or String. If provided, the canvas will be appended as a child to either the provided DOM element or the first element matching the string as a selector as passed to `document.querySelector`.
- Returns: `<Promise>`, resolving to a canvas containing the rendered results of the stack.

### `<StackDescription>`

An `Object` describing the contents of a canvas.

- `width`: (required) `Number`, the width of the canvas in pixels
- `height`: (required) `Number`, the height of the canvas in pixels
- `layers`: (required) an `Array` of [`<LayerDescription>`](#layerdescription) objects.

### `<LayerDescription>`

An `Object` describing the contents of a layer.

#### Global properties

- `disabled`: `Boolean` whether to draw the layer. Defaults to `true`.
- `name`: `String` used to look up a layer in a `Stack`.
- `transform`: `Object` defining a transformation of that layer:
  - `x`: `Number` amount to translate the layer horizontally in pixels.
  - `y`: `Number` amount to translate the layer vertically in pixels.
  - `rotate`: `Number` amount to rotate the layer clockwise in degrees.
- `mode`: `String` the blending mode used when drawing this layer. See [Canvas globalCompositeOperation on MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) for supported values.
- `opacity`: `Number` opacity of the layer, from `0` to `1`.

#### Image Layer

- `image`: `Object` describing the image:
  - `url`: `String` URL of the image to load. Image will be loaded using [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) in browsers and subject to CORS restrictions. multiple references to the same URL will be cached by the string.
  - `source`: [`Image`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/Image) image object to be drawn. This can be provided instead of `url` if you already have a reference to a loaded image.
  - `size`: `String` | `Object` the size to draw the image.
    - As a string:
      - `cover`: image will be resized to fill the whole layer, while preserving its aspect ratio. This means parts of the image may be cropped.
      - `cover`: image will be resized to fit within the layer, and may be "letterboxed" if not the same shape as the canvas.
      - as a percentage like `45%`, where the image will be resized along its more constrained axis to be a percentage of the canvas in that direction.
    - As an object:
      - `width`: `Number` width of image in pixels.
      - `height`: `Number` height of image in pixels.
      - if `width` is provided without height (or vice versa) the other value will be computed based on the aspect ratio of the image.
  - `anchor`: [`<Placement>`](#placement) describing the anchor point of the image. defaults to "center".
  - `position`: [`<Placement>`](#placement) describing the position of the anchor point within the layer. defaults to "center".

Example:

```js
{
  url: "https://example.com/test.png",
  size: "50%",
  position: {
  	x: "50%",
  	y: 0
  }
}
```

#### Text Layer

- `text`: `Object` describing the properties of the text layer:
  - `text`: `String` the text to draw on the layer.
  - `font`: `Object` describing the font to use when drawing text:
    - `family`: `String` name of font to use.
    - `size`: `String` size of text. See [Canvas `font` docs on MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font) for supported values.
    - `weight`: `String` | `Number` weight of text to draw.
  - `align`: `String` horizontal alignment of text based on its anchor. maps to [Canvas `textAlign`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign). Defaults to `"center"`.
  - `verticalAlign`: `String` vertical alignment of text based on its anchor. maps to [Canvas `textBaseline `](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline). Defaults to `"middle"`.
  - `color`: `String` fill color of text.
  - `stroke`: `String` stroke color of text. If not provided, no stroke will be drawn around the text.
  - `strokeWidth`: `Number` width of text stroke, in pixels.
  - `position`: [`<Placement>`](#placement) describing the position of the text within the layer.

#### Shape Layer

- `shape`: `Object` describing the properties of the shape:
  - `type`: `"ellipse"` | `"rectangle"` type of shape to draw. Defaults to `"ellipse"`.
  - `color`: `String` color to fill the shape with.
  - `stroke`: `String` color to use when drawing a stroke around the shape. If not provided, no stroke will be drawn.
  - `width`: `<Percent>` | `Number` width of shape. `<Percent>` is a string like `"45%"` representing the percentage of the canvas width. As a `Number`, width in pixels.
  - `height`: `<Percent>` | `Number` width of shape. `<Percent>` is a string like `"45%"` representing the percentage of the canvas height. As a `Number`, height in pixels.
  - `anchor`: [`<Placement>`](#placement) describing the anchor point of the image. defaults to "center".
  - `position`: [`<Placement>`](#placement) describing the position of the anchor point within the layer. defaults to "center".

#### Fill Layer

Fill the canvas with a color.

- `fill`: `String` | `<Gradient>` color to fill the canvas with.

#### Filter Layer

Filter layers apply a per-pixel transformation to the current canvas data.

- `filter`: `String` | `Function` filter to apply.
  - As a `String`, the name of a registered filter to apply. See [registerFilter](#registerfiltername-filterfunction) for details.
  - As a function, the filter function to apply. See [Filters](#filters) for details.
- `filterOptions`: `Object` arguments to pass to the filter.

### `<Gradient>`

Description of a gradient fill.

- `start`: [`<Placement>`](#placement) starting position of the gradient
- `end`: [`<Placement>`](#placement) ending position of the gradient
- `colors`: `Array` of color stops for the gradient. Each color stop can be either a `String` of a color or an `Array` of `[position, color]`:
  - `position`: `Number` from `0` to `1` indication the position along the gradient.
  - `color`: `String` of the color at that position.

If only strings are provided colors will be evenly spaced along the gradient. E.g. `colors: ["#fff", "red", "#000"]` is equivalent to:

```
colors: [
  [0, "#fff"],
  [.5, "red"],
  [1, "#000"]
]
```

### `<Placement>`

Description of a point on the canvas. Placements can be described absolutely, or using shorthand keywords:

- `{x, y}`
  - `Number` for the position in pixels
  - `String` for position in percentage of width/height of canvas e.g. `"40%"`
  - position keywords
	  - `left` | `center` | `right` for x position
	  - `top` | `center` | `bottom` for y position
  - if either `x` or `y` is not provided, defaults to `center`
- `center`, which is short for `{x: "center", y: "center"}`

Examples of valid placements:

```js
{
  position: "center",

  /* ... */

  position: {
    x: "top",
    y: "75%"
  },

  /* ... */

  position: {
    y: "bottom"
  },
}
```


### Stack

A helper class for managing [`<StackDescription>`](#stackdescription) objects over multiple renders.

#### constructor

- `new Stack(stack[, options])`

- `stack`: (required) [`<StackDescription>`](#stackdescription)
- `options`:
  - `canvas`: `HTMLCanvasElement` (browser) or `Canvas` (node). If provided, will automatically be passed to calls to `Stack.render()`.
  - `container`: `HTMLElement` or `String`. If provided, will automatically be passed to calls to `Stack.render()`.
- Returns: new `Stack` instance.

- `render([options])`

Calls top-level `render` using its `stack` property and any stored values for `canvas` or `container`.

- `options`: optionally override the `canvas` or `container` values used when calling top-level `render`.
- Returns: `<Promise>`, resolving to a canvas containing the rendered results of the stack.

- `layer(id)`

retrieves a specific layer from the stored `stack` by either index or `name`.

- `id`: `String` | `Number` name of layer or index in `stack.layers` array to return.

## Filters

### Built-in Filters

### `registerFilter(name, filterFunction)`

* `name`: (required) `String`, 
* `filterFunction`: (required) `Function` of the form `function (imageData, options)`:
	* `imageData`: [`ImageData`](https://developer.mozilla.org/en-US/docs/Web/API/ImageData) object containing the pixel data of the canvas representing the result of all the layers below the filter layer.
	* `options`: any options used to configure the filter. These are passed from the [Filter layer definition](#filter-layer) object via the `filterOptions` property.
	* `filterFunction` should return an `ImageData` object containing the new content of the canvas. This can be the same object passed in via the `imageData` parameter or a new `ImageData` object.

**Example:**

```js
import { registerFilter } from 'layers.js';

function myFilter(imageData, options) {
  /* ... */
}

registerFilter('myfilter', myFilter);
```

#### Why register a filter?

Filters can be selected in a [Filter layer](#filter-layer) by either providing a `Function` or a `String`. The string-based method is provided so `<StackDefinition>` objects can be serialized to JSON. All built-in filters are registered by default, and third-party filters can be imported and registered after the library is imported.

Referring to the above example using `myFilter`, the following layer definitions would have the same output:

```js
// string
{
  filter: "myfilter",
  filterOptions: {/*...*/}
}

// function, same effect
{
  filter: myFilter,
  filterOptions: {/*...*/}
}
```

## Runtime

### `useCanvasEngine(engine)`

Change the internal canvas engine used by the library. Useful when not running in the main thread of a browser. The default canvas engine is [`DOMCanvasEngine`](#domcanvasengine).

### `DOMCanvasEngine`

TK

## Misc

### utils

Utilities used internally by Layers.js and its filters that may be useful when authoring third-party filters or other interactions with the library.

#### `getPixel(imageData, x, y)`

Returns an Array of `[red, green, blue, alpha]` values for a given pixel of an ImageData object. Values are all of the form `0..255`, where 255 is fully opaque in the case of `alpha`. If the specified pixel is outside the bounds of `imageData`, returns `[0, 0, 0, 0`. Coordinates should be whole numbers. See [`samplePixel`](#samplepixelimagedata-x-y) to read color information "between" pixels.

* `imageData`, (required) `ImageData` object to pull pixel data from.
* `x`: (required) `Number`, x coordinate of pixel.
* `y`: (required) `Number`, y coordinate of pixel.

#### `setPixel(imageData, x, y, red, green, blue, alpha)`

Sets a specified pixel of an `ImageData` object to the provided color values.

* `imageData`, (required) `ImageData` object where the pixel will be set.
* `x`: (required) `Number`, x coordinate of pixel.
* `y`: (required) `Number`, y coordinate of pixel.
* `red`: (required) `Number`, red value of pixel to set, from `0..255`.
* `green`: (required) `Number`, green value of pixel to set, from `0..255`.
* `blue`: (required) `Number`, blue value of pixel to set, from `0..255`.
* `alpha`: `Number`, red value of pixel to set, from `0..255`. Defaults to `255`.

#### `samplePixel(imageData, x, y)`

Samples "between" pixels of an `ImageData` object, blending the surrounding pixels using bilinear interpolation. Returns an `Array` of `[red, green, blue, alpha]` values representing the samples color. Unlike `getPixel`, `x` and `y` values can be decimals.

* `imageData`, (required) `ImageData` object to pull pixel data from.
* `x`: (required) `Number`, x coordinate of pixel.
* `y`: (required) `Number`, y coordinate of pixel.
