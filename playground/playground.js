const $ = selector => document.querySelector(selector);

const defaultCode = `{
  "width": 400,
  "height": 400,
  "layers": [
    {
      text: {
      	text: "HELLO!",
        fill: "#000",
        stroke: "#fff",
        strokeWidth: 8,
        position: {
          y: "15%"
        },
        font: {
          size: "50px",
          weight: "bold"
        }
      }
    },
    {
      mode: "destination-in",
      shape: {
        type: "ellipse",
        width: "100%"
      }
    },
    {
      group: [
        {
          mode: "destination-out",
          shape: {
            type: "ellipse",
            width: "90%"
          }
        },
        {
          fill: {
            gradient: {
              colors: [
                "red",
                "orange",
                "yellow",
                "green",
                "blue",
                "indigo",
                "purple",
              ]
            }
          }
        }
      ]   
    },
    {
      "name": "image",
      "image": {
        "url": "https://potch.github.io/layers.js/site/cat.png",
        "size": "90%"
      }
    }
  ]
}`;

const currentPathname = window.location.pathname
  .split("/")
  .slice(0, -2)
  .join("/");
const previewScript = `
    import { render } from "${window.location.origin}${currentPathname}/index.js";
    console.log(window.stack);
    if ("stack" in window) {
      render(stack, { canvas: document.querySelector("#output") })
      .catch(error => {
        window.top.postMessage({
          type: 'error',
          msg: msg,
          line: line,
          col: col,
          stack: error.stack.split('\\n')
        }, '*');
      });
    }
  `;
const scriptURL = URL.createObjectURL(
  new Blob([previewScript], { type: "text/javascript" })
);
const previewDoc = stack => `
  <html>
    <head>
      <meta charset=utf8>
      <style>
        html, body {
          height: 100%;
        }
        body {
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      </style>
    </head>
    <body>
      <canvas id="output"></canvas>
      <script>
        window.onerror = function (msg, file, line, col, error) {
          window.top.postMessage({
            type: 'error',
            msg: msg,
            line: line,
            col: col,
            stack: error.stack.split('\\n')
          }, '*');
        };
      </script>
      <script src="${URL.createObjectURL(
        new Blob([`window.stack = ${stack};`], { type: "text/javascript" })
      )}"></script>
      <script defer type="module" src="${scriptURL}"></script>
    </body>
  </html>
`;

window.onload = () => {
  const editor = $("#code");
  const canvas = $("#canvas");
  const widgets = [];

  let codeDebounce;

  let initCode = localStorage.getItem("lastCode");
  if (!initCode) {
    initCode = defaultCode;
  }

  editor.value = initCode;

  const cm = CodeMirror.fromTextArea(editor, {
    lineNumbers: true,
    theme: "monokai",
    mode: { name: "javascript", json: true },
  });

  function editorChanged() {
    clearTimeout(codeDebounce);
    codeDebounce = setTimeout(update, 1000);
  }

  function update() {
    let code = cm.getValue();
    localStorage.setItem("lastCode", code);

    console.log("rendering...");

    while (widgets.length) {
      widgets.pop().clear();
    }
    const doc = previewDoc(code);
    const file = new Blob([doc], { type: "text/html" });
    const htmlUrl = URL.createObjectURL(file);
    $("#runner").src = htmlUrl;
  }

  cm.on("change", editorChanged);

  window.addEventListener("message", function (e) {
    var data = e.data;
    if (data.type === "error") {
      console.error("error from preview", data);
      widgets.push(cm.addLineWidget(data.line - 1, errorWidget(data)));
    }
  });

  $(".reset").addEventListener("click", e => {
    cm.setValue(defaultCode);
    update();
  });

  update();
};

function errorWidget(err) {
  const widget = document.createElement("pre");
  widget.className = "error widget";
  widget.innerHTML = err.msg;
  widget.innerHTML += "\n" + err.stack.join("\n");
  return widget;
}
