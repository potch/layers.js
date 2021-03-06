import { render, Stack } from "../index.js";
import * as Layers from "../index.js";

window.Layers = Layers;

const $ = selector => document.querySelector(selector);

let avatar = {
  width: 400,
  height: 400,
  layers: [
    {
      name: "caption",
      text: {
        text: "Hello, World!",
        font: {
          family: "sans-serif",
          size: "40px",
          weight: 800,
        },
        position: { y: "90%" },
        fill: "white",
        stroke: "black",
        strokeWidth: 8,
      },
    },
    {
      name: "mask",
      mode: "destination-in",
      shape: {
        type: "ellipse",
        fill: "#000",
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
      fill: "#000",
    },
  ],
};

let demo = new Stack(avatar, {
  canvas: document.createElement("canvas"),
  container: "#output",
});

function update() {
  document.querySelector("pre").innerText = JSON.stringify(demo.stack, null, 2);
  demo.render().then(updateSave);
}

window.onload = () => {
  demo.layer("caption").text.text = $("#caption").value;
  demo.layer("highlights").fill = $("#highlights").value;
  demo.layer("shadows").fill = $("#shadows").value;
  demo.layer("curves").filterOptions.amount = parseFloat($("#curves").value);
  update();
};

$("#curves").addEventListener("input", e => {
  demo.layer("curves").filterOptions.amount = parseFloat(e.target.value);
  update();
});

$("#upload").addEventListener("click", e => {
  $("#image").click();
});

$("#highlights").addEventListener("change", e => {
  demo.layer("highlights").fill = e.target.value;
  update();
});

$("#shadows").addEventListener("change", e => {
  demo.layer("shadows").fill = e.target.value;
  update();
});

$("#mask").addEventListener("change", e => {
  demo.layer("mask").disabled = !e.target.checked;
  update();
});

$("#image").addEventListener("change", e => {
  demo.layer("image").image.url = URL.createObjectURL(e.target.files[0]);
  update();
});

$("#caption").addEventListener("change", e => {
  demo.layer("caption").text.text = e.target.value;
  update();
});

$("#caption").addEventListener("input", e => {
  demo.layer("caption").text.text = e.target.value;
  update();
});

function updateSave(image) {
  image.toBlob(blob => {
    $("#download").href = URL.createObjectURL(blob);
  });
}

window.demo = demo;
