import { render, useCanvasEngine } from "./index.js";
import nodeCanvas from "canvas";
import fs from "fs";

useCanvasEngine(nodeCanvas);

let avatar = {
  width: 400,
  height: 400,
  layers: [
    {
      name: "caption",
      text: {
        text: new Date().toLocaleDateString(),
        font: {
          family: "sans-serif",
          size: "40px",
          weight: 800,
        },
        position: { y: "90%" },
        color: "white",
        stroke: "black",
        strokeWidth: 8,
      },
    },
    {
      name: "mask",
      mode: "destination-in",
      shape: {
        type: "ellipse",
        color: "#000",
        width: "100%",
        height: "100%",
      },
    },
    {
      name: "shadows",
      mode: "screen",
      fill: "#004488",
    },
    {
      name: "highlights",
      mode: "multiply",
      fill: "#ffcc00",
    },
    {
      name: "curves",
      filter: "curves",
      filterOptions: {
        amount: 0.4,
      },
    },
    {
      filter: "grayscale",
    },
    {
      name: "image",
      image: {
        url: "site/cat.png",
        size: "cover",
      },
    },
    {
      fill: "#fff",
    },
  ],
};

async function go() {
  const canvas = await render(avatar);
  const out = fs.createWriteStream("./node-demo.png");
  const stream = canvas.createPNGStream();
  stream.pipe(out);
}

go().catch(e => console.error(e));
