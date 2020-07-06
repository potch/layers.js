import { Stack, filters } from "/layers.js";

const $ = selector => document.querySelector(selector);

function spherize(cx, cy, radius, amount) {
  return function (x, y) {
    let a = Math.atan2(y - cy, x - cx);
    let d = Math.hypot(x - cx, y - cy);
    if (d < radius) {   
      let s = Math.pow(d / radius, amount) * radius;
      return [
        cx + s * Math.cos(a),
        cy + s * Math.sin(a)
      ]
    }
    return [x, y];
  }
}

function composeProjections(...fns) {
  return function (x, y) {
    return fns.reduce((out, fn) => {
      return fn(...out);
    }, [x, y])
  }
}

let avatar = new Stack({
  container: '#output',
  width: 400,
  height: 400,
  layers: [
    // {
    //   group: [
    //     {
    //       name: "displacetext",
    //       filter: filters.DisplacementFilter,
    //       filterOptions: {
    //         displace: (x, y) => [
    //           -(x - 200) / (10 - y / 30),
    //           250 - Math.sqrt(100000 - Math.pow(x - 200, 2))
    //         ]
    //       }
    //     },
    //     {
    //       name: 'text',
    //       text: 'CHAMPION',
    //       font: {
    //         size: '64px',
    //         weight: 'bold'
    //       },
    //       color: 'deeppink',
    //       stroke: '#fff',
    //       strokeWidth: 5
    //     },
    //   ]
    // },
    {
      name: 'mask',
      mode: 'destination-in',
      shape: {
        type: 'ellipse',
        color: '#000',
        width: '100%',
        height: '100%'
      }
    },
    // {
    //   name: "displace",
    //   filter: filters.ProjectionFilter,
    //   filterOptions: {
    //     project: composeProjections(
    //       spherize(255, 205, 50, 1.4),
    //       spherize(140, 205, 50, 1.4),
    //       spherize(202, 320, 80, .9)
    //     )
    //   }
    // },
    {
      name: "shadows",
      mode: "screen",
      fill: "#004488"
    },
    {
      name: "highlights",
      mode: "multiply",
      fill: "#ffcc00"
    },
    {
      name: "curves",
      filter: filters.CurvesFilter,
      filterOptions: {
        amount: .4
      }
    },
    {
      filter: filters.GrayscaleFilter
    },
    {
      name: "image",
      image: {
        url: 'https://cdn.glitch.com/6900a762-c023-49fd-87e9-ccc49e202c94%2Ftopolino-face.png?v=1574397304288',
        size: "cover"
      }
    },
    {
      fill: "#fff"
    }
  ]
});

function update() {
  avatar.draw().then(updateSave);
}

update();

$("#curves").addEventListener("input", e => {
  avatar.layer("curves").filterOptions.amount = parseFloat(e.target.value);
  update();
});

$('#upload').addEventListener('click', e => {
  $('#image').click();
});

$('#highlights').addEventListener('change', e => {
  avatar.layer('highlights').fill = e.target.value;
  update();
});

$('#shadows').addEventListener('change', e => {
  avatar.layer('shadows').fill = e.target.value;
  update();
});

$('#displace').addEventListener('change', e => {
  avatar.layer('displace').disabled = !e.target.checked;
  update();
});

$('#mask').addEventListener('change', e => {
  avatar.layer('mask').disabled = !e.target.checked;
  update();
});

$('#image').addEventListener('change', e => {
  avatar.layer('image').image.url = URL.createObjectURL(e.target.files[0]);
  update();
});

function updateSave(image) {
  image.toBlob(blob => {
    $('#download').href = URL.createObjectURL(blob);    
  });
}

window.avatar = avatar;