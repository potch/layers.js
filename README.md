# Layers.js

Layers.js is a canvas library built around the idea of "layers" as used in image editors. Control the content of a canvas programmatcally using metaphors familiar to users of popular image editing tools:

```js
const canvas = render({
  width: 200,
  height: 200,
  layers: [
    {
      text: "Hello, World!",
      position: { y: "90%" },
      color: "white",
      stroke: "black",
    },
    {
      name: "image",
      image: {
        url: "site/cat.png",
        size: "cover",
      },
    },
  ],
});
```

Layers are drawn from the bottom up, over top of each other using effects like opacity, masks, and filters.

## Installation

TK

## Documentation

See [API.md](API Documentation)
