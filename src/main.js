import './style.css';
import p5 from "p5";
import { create, all, fix } from "mathjs";

const math = create(all);

function parseFunction(str) {
  return function (x) {
    try {
      return math.evaluate(str, { x: x });
    } catch (e) {
      return 0;
    }
  };
}

const visual = (p) => {
  const scaleOverflowLimit = 200;
  const zoomFactor = 2;
  const defaultScale = 25;
  let scale = defaultScale;

  let centerX, centerY;

  let container;
  let controls;
  let intervalControls;
  
  let methodSelect;
  let nSlider;
  let nLabel;
  let aInput;
  let bInput;
  let fnInput;
  let f = x => Math.sin(x); // default function assignment

  let resetCanvasButton;

  let isHoveringCanvas = false;
  let scrollDirection = '';

  let offsetX = 0;
  let offsetY = 0;

  let prevMouseX, prevMouseY;
  let dragging = false;

  let sections = [];
  let areaRoundTo = 2;

  p.setup = () => {
    container = p.createDiv();
    container.id("container");
    
    controls = p.createDiv();
    controls.parent(container);
    
    let canvas = p.createCanvas(1600, 800);
    canvas.parent(container);
    canvas.elt.style.border = '1px dashed grey';

    centerX = p.width / 2;
    centerY = p.height / 2;

    methodSelect = p.createSelect();
    methodSelect.option("Left Riemann");
    methodSelect.option("Right Riemann");
    methodSelect.option("Midpoint");
    methodSelect.option("Trapezoid");
    methodSelect.parent(controls);

    nLabel = p.createDiv("");
    nSlider = p.createSlider(1, 20, 0);
    nLabel.parent(controls);
    nSlider.parent(controls);

    aInput = p.createInput(0);
    aInput.parent(controls);

    bInput = p.createInput(1);
    bInput.parent(controls);

    fnInput = p.createInput("sin(x)");
    fnInput.input(() => {
      f = parseFunction(fnInput.value()); // detect when the user changes their function input
    });
    fnInput.parent(controls);

    // only zoom in/out when user hovers over canvas
    canvas.mouseOver(() => isHoveringCanvas = true);
    canvas.mouseOut(() => isHoveringCanvas = false);

    resetCanvasButton = p.createButton("Reset Position");
    resetCanvasButton.parent(controls);
    resetCanvasButton.mousePressed(resetCanvasPos);
  };

  p.draw = () => {
    p.background(255);

    let method = methodSelect.value();

    let n = nSlider.value();
    nLabel.html(`Number of subdivisions: ${n}`);

    let a = parseFloat(aInput.value());
    let b = parseFloat(bInput.value());

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

      case "Trapezoid":
        drawTrapezoids(a, b, n);
        break;
    }

    drawFunction();

    showSectionArea();
  };

  p.mouseWheel = (event) => {
    let worldX = (p.mouseX - centerX - offsetX) / scale;
    let worldY = (centerY + offsetY - p.mouseY) / scale;

    if (isHoveringCanvas) {
      if (event.delta > 0 && scale > 25) {
        scale /= zoomFactor;
      } else if (event.delta < 0 && scale < 400) {
        scale *= zoomFactor;
      }
    }

    offsetX = p.mouseX - centerX - worldX * scale;
    offsetY = p.mouseY - centerY + worldY * scale;
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
    scale = defaultScale;
    offsetX = 0;
    offsetY = 0;
  };

  function drawAxes() {
    p.stroke(0);
    p.strokeWeight(2)

    p.line(0, centerY + offsetY, p.width, centerY + offsetY);
    p.line(centerX + offsetX, 0, centerX + offsetX, p.height);
  };

  function drawFunction() {
    // !!! fix render errors for tan(x), log(x) and other asymptotic/divergent functions
    p.stroke(255, 0, 0);
    p.strokeWeight(2);
    p.noFill();

    let startX = (-centerX - offsetX) / scale;
    let endX = (p.width - centerX - offsetX) / scale;

    p.beginShape();

    for (let x = startX; x <= endX; x += 0.05) {
      let y = f(x);

      let px = centerX + offsetX + x * scale;
      let py = centerY + offsetY - y * scale;

      p.vertex(px, py);
    }

    p.endShape();
  };

  function drawGrid() {
    p.stroke(220);
    p.strokeWeight(0.5);

    let startX = offsetX % scale;
    let startY = offsetY % scale;

    for (let x = startX; x < p.width; x += scale) {
      p.line(x, 0, x, p.height);
    }

    for (let y = startY; y < p.height; y += scale) {
      p.line(0, y, p.width, y);
    }
  };

  function drawLabels() {
    p.fill(0, 75);
    p.textSize(12);
    p.noStroke();

    let startX = (-centerX - offsetX) / scale;
    let endX = (p.width - centerX - offsetX) / scale;

    for (let x = Math.floor(startX); x < Math.ceil(endX); x++) {
      let px = centerX + offsetX + x * scale;

      if (x == 0) {
        p.text(x, px + 5, centerY + offsetY + 12);
      } else {
        p.text(x, px - 4, centerY + offsetY + 12);
      }
    }

    let startY = (-centerY + offsetY) / scale;
    let endY = (p.height - centerY + offsetY) / scale;

    for (let y = Math.floor(startY); y < Math.ceil(endY); y++) {
      let py = centerY + offsetY - y * scale;

      if (y !== 0) {
        p.text(y, centerX + offsetX + 5, py + 4);
      }
    }
  };

  function gradientRect(x, y, w, h, c1, c2) {
    let from = p.color(c1);
    let to = p.color(c2);

    let interA = p.lerpColor(from, to, 0.33);
    let interB = p.lerpColor(from, to, 0.66);

    let startX = w < 0 ? x + w : x;
    let startY = h < 0 ? y + h : y;

    let width = Math.abs(w);
    let height = Math.abs(h);
    let sectionWidth = width / 4;

    p.noStroke();

    p.fill(from);
    p.rect(startX, startY, sectionWidth, height);

    p.fill(interA);
    p.rect(startX + sectionWidth, startY, sectionWidth, height);

    p.fill(interB);
    p.rect(startX + 2 * sectionWidth, startY, sectionWidth, height);

    p.fill(to);
    p.rect(startX + 3 * sectionWidth, startY, sectionWidth, height);
  }

  function showSectionArea() {
    for (let s of sections) {
      if (p.mouseX >= s.x && p.mouseX <= s.x + s.w &&
          p.mouseY >= s.y && p.mouseY <= s.y + s.h) {
        
        // show area
        p.stroke(1)
        p.textSize(20);
        p.text("Area: " + s.area.toFixed(areaRoundTo), s.x + 5, s.y + 20);

        p.stroke(255, 255, 0);
        p.strokeWeight(2);
        p.noFill();
        p.rect(s.x, s.y, s.w, s.h);
      }
    }
  }

  function drawRiemannRectanglesLeft(a, b, n) {
    p.stroke(0);
    p.strokeWeight(1);

    sections = [];
    
    let dx = (b - a) / n;
    let c1, c2;

    for (let i = 0; i < n; i++) {
      let x = a + i * dx;
      
      let fx = f(x);
      let px = centerX + offsetX + x * scale;
      let py = centerY + offsetY;

      let h = fx * scale;

      if (fx < 0) {
        p.fill(255, 0, 0, 100);
      } else {
        p.fill(0, 255, 0, 100);
      }

      p.rect(
        px,
        py,
        dx * scale,
        -h
      );

      sections.push({
        x: px,
        y: h > 0 ? py - h : py,
        w: dx * scale,
        h: Math.abs(h),
        area: fx * dx,
      });
    }
  };

  function drawRiemannRectanglesRight(a, b, n) {
    p.stroke(0);
    p.strokeWeight(1);

    sections = [];

    let dx = (b - a) / n;

    for (let i = 0; i < n; i++) {
      let x = a + (i + 1) * dx;

      let fx = f(x);

      let px = centerX + offsetX + (x - dx) * scale;
      let py = centerY + offsetY;

      let h = fx * scale;

      if (fx < 0) {
        p.fill(255, 0, 0, 100);
      } else {
        p.fill(0, 255, 0, 100);
      }

      p.rect(
        px,
        py,
        dx * scale,
        -h
      );

      sections.push({
        x: px,
        y: h > 0 ? py - h : py,
        w: dx * scale,
        h: Math.abs(h),
        area: fx * dx,
      });
    }
  };

  function drawMidpoint(a, b, n) {
    p.stroke(0);
    p.strokeWeight(1);

    sections = [];

    let dx = (b - a) / n;

    for (let i = 0; i < n; i++) {
      let x1 = a + i * dx;
      let x2 = x1 + dx;

      let mid = (x1 + x2) / 2;
      let fx = f(mid);

      let px = centerX + offsetX + x1 * scale;
      let py = centerY + offsetY;

      if (fx < 0) {
        p.fill(255, 0, 0, 100);
      } else {
        p.fill(0, 255, 0, 100);
      }

      if (fx != 0) {
        p.rect(
          px,
          py - fx * scale,
          dx * scale,
          fx * scale
        );
      }

      let h = fx * scale;

      sections.push({
        x: px,
        y: fx > 0 ? py - h : py,
        w: dx * scale,
        h: Math.abs(h),
        area: fx * dx,
      });
    }
  };

  function drawTrapezoids(a, b, n) {
    p.stroke(0);
    p.strokeWeight(1);

    sections = [];

    let dx = (b - a) / n;
    let baseY = centerY + offsetY;

    for (let i = 0; i < n; i++) {
      let x1 = a + i * dx;
      let x2 = x1 + dx;

      let y1 = f(x1);
      let y2 = f(x2);

      let px1 = centerX + offsetX + x1 * scale;
      let px2 = centerX + offsetX + x2 * scale;

      let py1 = baseY - y1 * scale;
      let py2 = baseY - y2 * scale;

      if ((y1 + y2) / 2 < 0) {
        p.fill(255, 0, 0, 100);
      } else {
        p.fill(0, 255, 0, 100);
      }

      p.quad(
        px1, baseY,
        px2, baseY,
        px2, py2,
        px1, py1
      );

      let top = Math.min(py1, py2);
      let height = Math.abs(py2 - py1);
    }
  }
};

new p5(visual);