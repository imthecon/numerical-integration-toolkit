import './style.css';
import p5 from "p5";
import { create, all, fix } from "mathjs";
import katex from "katex";
import renderMathInElement from "katex/contrib/auto-render";

const math = create(all);

// math.js function parser
function parseFunction(str) {
  return function (x) {
    try {
      return math.evaluate(str, { x: x });
    } catch (e) {
      return 0;
    }
  };
}

// HTML LaTeX auto-renderer
document.addEventListener("DOMContentLoaded", () => {
  renderMathInElement(document.body, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ]
  });
});

let p5Instance;

const functionMapper = (p) => {
  let canvas;
  
  const epsilon = 1e-12; // tolerance level for rounding sums
  let areaRoundTo = 2;
  let sumRoundTo = 6;
  const deltaXRoundTo = 3;

  const scaleOverflowLimit = 200; // currently unused
  const zoomFactor = 2; // since 25 * 2^n divides 1600 and 800 up to n = 5 (i.e., 5 zoom levels)
  const defaultScale = 50;

  let minInterval = -10000;
  let maxInterval = 10000;

  let scaling = defaultScale;

  let centerX, centerY;

  let container;
  let controls;
  let intervalControls;
  let fnControls;
  let nControls;
  let canvasBgControls;
  let methodControls;
  let areaControls;
  let sumControls;
  
  let methodSelect;
  let methodLabel;

  let nSlider;
  let nLabel;

  let aLabel;
  let aInput;
  let bLabel;
  let bInput;

  let fnLabel;
  let fnInput;
  let fnString = "sin(x)"; // default function string
  let f = x => Math.sin(x); // default function assignment
  let fParsed, f1, f2, f2String;

  let resetCanvasButton;

  let userInputLabel;

  let canvasBgColor;
  let mode = "Light"; // default canvas background color
  let canvasBgLabel;

  let areaRoundToSlider;
  let areaRoundToLabel;

  let sumRoundToSlider;
  let sumRoundToLabel;

  let cutTrailing = true;
  let cutTrailingCheckbox;
  let cutTrailingLabel;

  let hoverLabel;
  
  let isHoveringCanvas = false;
  let scrollDirection = '';

  let offsetX = 0;
  let offsetY = 0;

  let prevMouseX, prevMouseY;
  let dragging = false;

  let subdivisions = [];

  p.setup = () => {
    container = p.createDiv();
    container.id("container");
    container.parent("canvasContainer")
    
    controls = p.createDiv();
    controls.parent(container);

    canvas = p.createCanvas(1600, 800);
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    canvas.parent(container);
    canvas.elt.style.border = '1px dashed grey';

    centerX = p.width / 2;
    centerY = p.height / 2;

    methodControls = p.createDiv();
    methodControls.id("methodControls");
    methodControls.parent(controls);

    methodLabel = p.createDiv("");
    methodLabel.parent(methodControls)

    methodSelect = p.createSelect();
    methodSelect.option("Left Riemann");
    methodSelect.option("Right Riemann");
    methodSelect.option("Midpoint");
    methodSelect.option("Trapezoidal");
    methodSelect.parent(methodControls);

    nControls = p.createDiv();
    nControls.id("nControls");
    nControls.parent(controls);

    nLabel = p.createDiv("");
    nLabel.parent(nControls);

    nSlider = p.createSlider(1, 100, 20);
    nSlider.parent(nControls);

    intervalControls = p.createDiv();
    intervalControls.id("intervalControls");
    intervalControls.parent(controls);

    aLabel = p.createSpan("a:");
    aLabel.parent(intervalControls);

    aInput = p.createInput(0);
    aInput.parent(intervalControls);

    bLabel = p.createSpan("b:");
    bLabel.parent(intervalControls);

    bInput = p.createInput(6.28);
    bInput.parent(intervalControls);

    fnControls = p.createDiv();
    fnControls.id("fnControls");
    fnControls.parent(controls);

    fnLabel = p.createSpan("f(x) =");
    fnLabel.parent(fnControls);

    fnInput = p.createInput("sin(x)");
    fnInput.input(() => {
      fnString = fnInput.value();
      f = parseFunction(fnInput.value()); // detect when the user changes their function input
      computeSum(sumRoundTo);

      // for calculating error bounds
      updateSecondDerivative();
    });
    fnInput.parent(fnControls);

    // only zoom in/out when user hovers over canvas
    canvas.mouseOver(() => isHoveringCanvas = true);
    canvas.mouseOut(() => isHoveringCanvas = false);

    userInputLabel = p.createDiv(
      "<b>a</b> = the start of the interval<br>" +
      "<b>b</b> = the end of the interval<br>" +
      "<b>n</b> = the number of subdivisions (rectangles or trapezoids)<br>")
    userInputLabel.parent(controls);

    areaControls = p.createDiv();
    areaControls.id("areaControls");
    areaControls.parent(controls);

    areaRoundToLabel = p.createDiv("");
    areaRoundToLabel.parent(areaControls);

    areaRoundToSlider = p.createSlider(2, 6, 1);
    areaRoundToSlider.parent(areaControls);

    sumControls = p.createDiv();
    sumControls.id("sumControls");
    sumControls.parent(controls);

    sumRoundToLabel = p.createDiv("");
    sumRoundToLabel.parent(sumControls);

    sumRoundToSlider = p.createSlider(4, 8, 6);
    sumRoundToSlider.parent(sumControls);

    cutTrailingCheckbox = p.createCheckbox("Cut off trailing zeroes", true);
    cutTrailingCheckbox.parent(controls);

    canvasBgControls = p.createDiv();
    canvasBgControls.id("canvasBgControls");
    canvasBgControls.parent(controls);

    canvasBgLabel = p.createDiv("");
    canvasBgLabel.parent(methodControls)

    canvasBgColor = p.createRadio();
    canvasBgColor.option("Light");
    canvasBgColor.option("Dark");
    canvasBgColor.selected("Light"); // default value
    canvasBgColor.parent(canvasBgControls)

    canvasBgColor.changed(() => {
      mode = canvasBgColor.value();
    });

    resetCanvasButton = p.createButton("Reset Position");
    resetCanvasButton.parent(controls);
    resetCanvasButton.mousePressed(resetCanvasPos);

    // update important values when user changes any relevant input
    methodSelect.changed(updateAll);
    nSlider.input(updateAll);
    aInput.input(clampIntervalInputs); // includes updateAll
    bInput.input(clampIntervalInputs); // includes updateAll
    sumRoundToSlider.input(updateAll);
    cutTrailingCheckbox.input(() => {
      cutTrailing = cutTrailingCheckbox.checked();
      updateAll();
    });
    
    computeSum(sumRoundTo); // preload computed sums upon page loading
    returnValues(); // preload HTML values of relevant variables upon page loading
    updateSecondDerivative(); // preload second derivative upon page loading
  };

  p.draw = () => {
    if (mode == "Light") {
      p.background(255);
    } else {
      p.background(20, 20, 30);
    }

    let method = methodSelect.value();
    methodLabel.html("Method:");

    let n = nSlider.value();
    nLabel.html(`Number of subdivisions (<i>n</i>): <b><span class="firaCode">${n}</span></b>`);

    let a = parseFloat(aInput.value());
    let b = parseFloat(bInput.value());

    areaRoundTo = areaRoundToSlider.value();
    areaRoundToLabel.html(`Round area to <b>${areaRoundTo}</b> decimal points`);

    sumRoundTo = sumRoundToSlider.value();
    sumRoundToLabel.html(`Round sums to <b>${sumRoundTo}</b> decimal points`);

    drawAxes();

    drawGrid();

    drawLabels();

    switch (method) {
      case "Left Riemann":
        drawRiemannRectanglesLeft(a, b, n);
        break;

      case "Right Riemann":
        drawRiemannRectanglesRight(a, b, n);
        break;

      case "Midpoint":
        drawMidpoint(a, b, n);
        break;

      case "Trapezoidal":
        drawTrapezoids(a, b, n);
        break;
    }

    drawFunction();

    showSectionArea(areaRoundTo);

    drawOnCanvasLabels();
  };

  p.mouseWheel = (event) => {
    let worldX = (p.mouseX - centerX - offsetX) / scaling;
    let worldY = (centerY + offsetY - p.mouseY) / scaling;

    if (isHoveringCanvas) {
      event.preventDefault();
      
      if (event.delta > 0 && scaling > 25) {
        scaling /= zoomFactor;
      } else if (event.delta < 0 && scaling < 200) {
        scaling *= zoomFactor;
      }
    }

    offsetX = p.mouseX - centerX - worldX * scaling;
    offsetY = p.mouseY - centerY + worldY * scaling;
  };

  p.mousePressed = () => {
    dragging = true;
    prevMouseX = p.mouseX;
    prevMouseY = p.mouseY;
  };

  p.mouseDragged = () => {
    if (isHoveringCanvas) {
      if (dragging) {
        let dx = p.mouseX - prevMouseX;
        let dy = p.mouseY - prevMouseY;

        offsetX += dx;
        offsetY += dy;

        prevMouseX = p.mouseX;
        prevMouseY = p.mouseY;
      }
    }
  };

  p.mouseReleased = () => {
    dragging = false;
  };

  function resetCanvasPos() {
    scaling = defaultScale;
    offsetX = 0;
    offsetY = 0;
  };

  function calculateScaling() {
    const minDimensions = Math.min(window.innerWidth, window.innerHeight);
    scaling = Math.floor(minDimensions / 4)
  };

  function drawAxes() {
    p.strokeWeight(2)
    
    if (mode == "Light") {
      p.stroke(0);
    } else {
      p.stroke(150);
    }

    p.line(0, centerY + offsetY, p.width, centerY + offsetY);
    p.line(centerX + offsetX, 0, centerX + offsetX, p.height);
  };

  function drawFunction() {
    // !!! fix render errors for tan(x), log(x) and other asymptotic/divergent functions
    p.strokeWeight(2);
    p.noFill();

    if (mode == "Light") {
      p.stroke(0, 0, 255);
    } else {
      p.stroke(255);
    }

    let startX = (-centerX - offsetX) / scaling;
    let endX = (p.width - centerX - offsetX) / scaling;

    p.beginShape();

    for (let x = startX; x <= endX; x += 0.025) {
      let y = f(x);

      let px = centerX + offsetX + x * scaling;
      let py = centerY + offsetY - y * scaling;

      p.vertex(px, py);
    }

    p.endShape();
  };

  function drawGrid() {
    p.strokeWeight(0.5);

    if (mode == "Light") {
      p.stroke(220);
    } else {
      p.stroke(220, 220, 220, 100);
    }

    let startX = offsetX % scaling;
    let startY = offsetY % scaling;

    for (let x = startX; x < p.width; x += scaling) {
      p.line(x, 0, x, p.height);
    }

    for (let y = startY; y < p.height; y += scaling) {
      p.line(0, y, p.width, y);
    }
  };

  function drawLabels() {
    p.textFont("Helvetica");
    p.textSize(12);
    p.noStroke();

    if (mode == "Light") {
      p.fill(0, 75);
    } else {
      p.fill(255, 200);
    }

    let startX = (-centerX - offsetX) / scaling;
    let endX = (p.width - centerX - offsetX) / scaling;

    for (let x = Math.floor(startX); x < Math.ceil(endX); x++) {
      let px = centerX + offsetX + x * scaling;

      if (x == 0) {
        p.text(x, px + 5, centerY + offsetY + 14);
      } else {
        p.text(x, px - 4, centerY + offsetY + 14);
      }
    }

    let startY = (-centerY + offsetY) / scaling;
    let endY = (p.height - centerY + offsetY) / scaling;

    for (let y = Math.floor(startY); y < Math.ceil(endY); y++) {
      let py = centerY + offsetY - y * scaling;

      if (y !== 0) {
        p.text(y, centerX + offsetX + 5, py + 4);
      }
    }
  };

  function drawOnCanvasLabels() {
    p.textSize(16);
    p.textFont("monospace");
    p.noStroke();

    if (mode == "Light") {
      p.fill(0, 75);
    } else {
      p.fill(255, 200);
    }

    p.text("Hover over a subdivision to see its area.", 20, 30);
    p.text('Click "Reset Position" to reset the canvas to (0, 0).', 20, 50);
  }

  function clampIntervalInputs() {
    let a = Number(aInput.value());
    let b = Number(bInput.value());

    if (Number.isNaN(a) || (Number.isNaN(b))) return;

    a = Math.max(-10000, Math.min(a, 10000));
    b = Math.max(-10000, Math.min(b, 10000));

    aInput.value(a);
    bInput.value(b);

    updateAll();
  }

  function showSectionArea(roundTo) {
    for (let s of subdivisions) {
      if (p.mouseX >= s.x && p.mouseX <= s.x + s.w &&
          p.mouseY >= s.y && p.mouseY <= s.y + s.h) {
        
        p.textFont("monospace");
        p.textSize(16);
        p.fill(50)
        p.noStroke()

        if (mode == "Light") {
          p.fill(50)
        } else {
          p.fill(255)
        }
        
        let rounded;

        if (cutTrailing) {
          rounded = Number(s.area.toFixed(roundTo));
        } else {
          rounded = s.area.toFixed(roundTo);
        };

        p.text("Area: " + rounded, s.x + 4, s.y - 8);

        p.stroke(255, 255, 0);
        p.fill(255, 255, 0, 50)
        p.rect(s.x, s.y, s.w, s.h);
      }
    }
  };

  function updateAll() {
    computeSum(sumRoundToSlider.value());
    returnValues();
  }

  function computeSum(roundTo) {
    let a = parseFloat(aInput.value());
    let b = parseFloat(bInput.value());
    let n = nSlider.value();
    let dx = (b - a)/n;

    const methods = ["Left Riemann", "Right Riemann", "Midpoint", "Trapezoidal"];
    const outputContainers = document.querySelectorAll('.output');

    outputContainers.forEach((container, index) => {
      let method = methods[index];
      let sum = 0
      let sumFormula = ""
      let lowerSum = 0;
      let upperSum = n - 1;
      let x;
      let xSubI = `a + iΔx`;

      for (let i = 0; i < n; i++) {
        if (method == "Left Riemann") {
          x = a + i * dx;
          sum += f(x);
          sumFormula = "f(x_i)";
        } else if (method == "Right Riemann") {
          x = a + (i + 1) * dx;
          sum += f(x);
          sumFormula = "f(x_{i+1})";
        } else if (method == "Midpoint")  {
          x = a + (i + 0.5) * dx;
          sum += f(x);
          sumFormula = "f\\left(\\frac{x_i+x_{i+1}}{2}\\right)"
        } else if (method == "Trapezoidal") {
          let x1 = a + i * dx;
          let x2 = a + (i + 1) * dx;
          sum += (f(x1) + f(x2)) / 2;
          sumFormula = "\\frac{f(x_i) + f(x_{i+1})}{2}";
        }
      };
      
      let result = sum * dx;
      let rounded;
      if (cutTrailing) {
        rounded = Number(result.toFixed(roundTo));
      } else {
        rounded = result.toFixed(roundTo);
      };

      let isExact = Math.abs(result - rounded) < epsilon;

      let latexOutput = `\\sum_{i=${lowerSum}}^{${upperSum}} {${sumFormula}}\\,\\Delta x `;

      if (isExact) {
        latexOutput += `= ${rounded}`;
      } else {
        latexOutput += `\\approx ${rounded}`;
      };

      container.querySelector('.methodInfo').innerHTML = `
        <b>${method}:</b><br>
        x<sub>i</sub> = ${xSubI}<br>
        a = <span class="c">${Math.min(a, b)}</span><br>
        Δx = <span class="c">${+dx.toFixed(deltaXRoundTo)}</span><br>
      `;

      katex.render(latexOutput, container.querySelector('.expression'), {
        throwOnError: false,
        displayMode: true
      });
    });
  };

  function returnValues() {
    let a = parseFloat(aInput.value());
    let b = parseFloat(bInput.value());
    let n = nSlider.value();
    
    document.querySelectorAll(".aValue").forEach(el => {
      el.innerHTML = Math.min(a, b);
    });

    document.querySelectorAll(".bValue").forEach(el => {
      el.innerHTML = Math.max(a, b);
    });

    document.querySelectorAll(".nValue").forEach(el => {
      el.innerHTML = n;
    });
  };
  
  // math.js second derivative calculator (for error bound)
  function updateSecondDerivative() {
    fParsed = math.parse(fnInput.value());
    f1 = math.derivative(fParsed, "x");
    f2 = math.derivative(f1, "x");

    f2String = f2.toString();

    document.querySelectorAll(".secondDeriv").forEach(el => {
      let latexOutput = katex.renderToString(`${f2String}`, {
        throwOnError: false
      });

      el.innerHTML = `<span class="cSameFont">${latexOutput}</span>`;
    });
  };

  function drawRiemannRectanglesLeft(a, b, n) {
    p.strokeWeight(1);

    subdivisions = [];
    
    let dx = (b - a) / n;
    let c1, c2;

    for (let i = 0; i < n; i++) {
      let x = a + i * dx;
      
      let fx = f(x);
      let px = centerX + offsetX + x * scaling;
      let py = centerY + offsetY;

      let h = fx * scaling;

      if (fx < 0) {
        p.stroke(255, 0, 0)
        p.fill(255, 50, 80, 100);
      } else if (fx == 0) {
        p.stroke(0, 0, 0)
        p.fill(100, 100, 100, 100);
      } else {
        p.stroke(0, 200, 0)
        p.fill(0, 255, 0, 100);
      }

      p.rect(
        px,
        py,
        dx * scaling,
        -h
      );

      subdivisions.push({
        x: px,
        y: h > 0 ? py - h : py,
        w: dx * scaling,
        h: Math.abs(h),
        area: fx * dx,
      });
    }
  };

  function drawRiemannRectanglesRight(a, b, n) {
    p.stroke(0);
    p.strokeWeight(1);

    subdivisions = [];

    let dx = (b - a) / n;

    for (let i = 0; i < n; i++) {
      let x = a + (i + 1) * dx;

      let fx = f(x);

      let px = centerX + offsetX + (x - dx) * scaling;
      let py = centerY + offsetY;

      let h = fx * scaling;

      if (fx < 0) {
        p.stroke(200, 0, 0)
        p.fill(255, 50, 80, 100);
      } else if (fx == 0) {
        p.stroke(0, 0, 0)
        p.fill(100, 100, 100, 100);
      } else {
        p.stroke(0, 200, 0)
        p.fill(0, 255, 0, 100);
      }

      p.rect(
        px,
        py,
        dx * scaling,
        -h
      );

      subdivisions.push({
        x: px,
        y: h > 0 ? py - h : py,
        w: dx * scaling,
        h: Math.abs(h),
        area: fx * dx,
      });
    }
  };

  function drawMidpoint(a, b, n) {
    p.stroke(0);
    p.strokeWeight(1);

    subdivisions = [];

    let dx = (b - a) / n;

    for (let i = 0; i < n; i++) {
      let x1 = a + i * dx;
      let x2 = x1 + dx;

      let mid = (x1 + x2) / 2;
      let fx = f(mid);

      let px = centerX + offsetX + x1 * scaling;
      let py = centerY + offsetY;

      if (fx < 0) {
        p.stroke(200, 0, 0)
        p.fill(255, 50, 80, 100);
      } else if (fx == 0) {
        p.stroke(0, 0, 0)
        p.fill(100, 100, 100, 100);
      } else {
        p.stroke(0, 200, 0)
        p.fill(0, 255, 0, 100);
      }

      if (fx != 0) {
        p.rect(
          px,
          py - fx * scaling,
          dx * scaling,
          fx * scaling
        );
      }

      let h = fx * scaling;

      subdivisions.push({
        x: px,
        y: fx > 0 ? py - h : py,
        w: dx * scaling,
        h: Math.abs(h),
        area: fx * dx,
      });
    }
  };

  function drawTrapezoids(a, b, n) {
    p.stroke(0);
    p.strokeWeight(1);

    subdivisions = [];

    let dx = (b - a) / n;
    let baseY = centerY + offsetY;

    for (let i = 0; i < n; i++) {
      let x1 = a + i * dx;
      let x2 = x1 + dx;

      let y1 = f(x1);
      let y2 = f(x2);

      let px1 = centerX + offsetX + x1 * scaling;
      let px2 = centerX + offsetX + x2 * scaling;

      let py1 = baseY - y1 * scaling;
      let py2 = baseY - y2 * scaling;

      if ((y1 + y2) / 2 < 0) {
        p.stroke(200, 0, 0)
        p.fill(255, 50, 80, 100);
      } else if ((y1 + y2) / 2 == 0) {
        p.stroke(0, 0, 0)
        p.fill(100, 100, 100, 100);
      } else {
        p.stroke(0, 200, 0)
        p.fill(0, 255, 0, 100);
      }

      p.quad(
        px1, baseY,
        px2, baseY,
        px2, py2,
        px1, py1
      );
    }
  }

  function updateCanvasSize() {
    let w, h;

    if (window.innerWidth > 2000) {
      w = 1600;
      h = 800;
    } else {
      w = 1200;
      h = 800;
    }

    p.resizeCanvas(w, h);
  };
};

window.onload = () => {
  p5Instance = new p5(functionMapper);
};