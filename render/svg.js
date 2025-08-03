// render/svg.js
const SVG_NS = "http://www.w3.org/2000/svg";

export function createSVGElement(tag, attributes = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attributes) {
    // Handle xlink:href specifically for older SVG versions/browsers
    if (key === "xlinkHref") {
      el.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "xlink:href",
        attributes[key]
      );
    } else if (key === "className") {
      // className is for HTML elements, use class for SVG
      el.setAttribute("class", attributes[key]);
    } else {
      el.setAttribute(key, attributes[key]);
    }
  }
  return el;
}

/**
 * Creates an SVG path element.
 * @param {string} d - The path data string.
 * @param {object} attributes - Additional attributes for the path.
 * @returns {SVGPathElement}
 */
export function createPath(d, attributes = {}) {
  return createSVGElement("path", { d, ...attributes });
}

/**
 * Creates an SVG text element with optional tspans for multiline.
 * @param {string} textContent - The text to display.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate (baseline for first line).
 * @param {object} attributes - Attributes for the text element.
 * @param {string[]} [lines] - Optional array of lines if text is pre-wrapped.
 * @returns {SVGTextElement}
 */
export function createText(textContent, x, y, attributes = {}, lines = null) {
  const textEl = createSVGElement("text", { x, y, ...attributes });

  if (lines && lines.length > 1) {
    // For multiline text, use tspan elements
    lines.forEach((line, i) => {
      const tspan = createSVGElement("tspan", {
        x,
        dy: i === 0 ? 0 : 1.2 + "em",
      }); // Line height of 1.2em
      tspan.textContent = line;
      textEl.appendChild(tspan);
    });
  } else {
    textEl.textContent = textContent;
  }
  return textEl;
}

/**
 * Measures the approximate width of text using a temporary SVG element.
 * This is more accurate than simple character counts.
 * @param {string} text - The text to measure.
 * @param {number} fontSize - Font size in pixels.
 * @param {string} fontFamily - Font family string.
 * @returns {number} The approximate text width.
 */
export function measureText(text, fontSize, fontFamily) {
  if (!text) return 0;
  const svg = createSVGElement("svg");
  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  svg.style.height = "0";
  svg.style.width = "0"; // Make it very small/hidden

  const textEl = createSVGElement("text", {
    x: 0,
    y: 0,
    style: `font-size: ${fontSize}px; font-family: ${fontFamily};`,
  });
  textEl.textContent = text;
  svg.appendChild(textEl);
  document.body.appendChild(svg); // Temporarily add to DOM to measure

  let width = 0;
  try {
    // getComputedTextLength() is more reliable than getBBox() for just width
    width = textEl.getComputedTextLength();
  } catch (e) {
    console.warn(
      "Could not use getComputedTextLength, falling back to approximation."
    );
    // Fallback if getComputedTextLength fails (e.g., in some environments or for complex fonts)
    width = text.length * (fontSize * 0.6); // Rough estimate
  } finally {
    document.body.removeChild(svg); // Always remove
  }
  return width;
}

/**
 * Wraps text into multiple lines based on a maximum width.
 * @param {string} text - The input text.
 * @param {number} maxWidth - The maximum allowed width for a line.
 * @param {number} fontSize - The font size.
 * @param {string} fontFamily - The font family.
 * @returns {string[]} An array of strings, each representing a line.
 */
export function wrapText(text, maxWidth, fontSize, fontFamily) {
  if (measureText(text, fontSize, fontFamily) <= maxWidth) {
    return [text];
  }

  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + " " + word;
    if (measureText(testLine, fontSize, fontFamily) <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Creates an SVG <defs> element and appends common arrow markers to it.
 * @param {SVGElement} svgRoot - The root SVG element to append defs to.
 */
export function createCommonDefs(svgRoot) {
  const defs = createSVGElement("defs");

  // Standard arrow marker for edges
  const arrowMarker = createSVGElement("marker", {
    id: "arrowhead",
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerUnits: "strokeWidth",
    markerWidth: "8",
    markerHeight: "6",
    orient: "auto",
  });
  arrowMarker.appendChild(
    createSVGElement("path", { d: "M 0 0 L 10 5 L 0 10 z" })
  );
  defs.appendChild(arrowMarker);

  // Reply message arrow marker (smaller, perhaps slightly different)
  const replyArrowMarker = createSVGElement("marker", {
    id: "replyArrowhead",
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerUnits: "strokeWidth",
    markerWidth: "6",
    markerHeight: "4",
    orient: "auto",
  });
  replyArrowMarker.appendChild(
    createSVGElement("path", { d: "M 0 0 L 10 5 L 0 10 z" })
  );
  defs.appendChild(replyArrowMarker);

  // Crow's foot markers for ERD
  // One to many (fork)
  const oneToMany = createSVGElement("marker", {
    id: "oneToMany",
    viewBox: "0 0 10 10",
    refX: "1",
    refY: "5",
    markerWidth: "10",
    markerHeight: "10",
    orient: "auto",
  });
  oneToMany.appendChild(
    createSVGElement("path", {
      d: "M0,1 L10,5 L0,9",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
    })
  );
  defs.appendChild(oneToMany);

  // One (single line)
  const one = createSVGElement("marker", {
    id: "one",
    viewBox: "0 0 10 10",
    refX: "0",
    refY: "5",
    markerWidth: "2",
    markerHeight: "10",
    orient: "auto",
  });
  one.appendChild(
    createSVGElement("line", {
      x1: "1",
      y1: "0",
      x2: "1",
      y2: "10",
      stroke: "currentColor",
      "stroke-width": "1.5",
    })
  );
  defs.appendChild(one);

  // Zero or one (circle + line)
  const zeroOrOne = createSVGElement("marker", {
    id: "zeroOrOne",
    viewBox: "0 0 10 10",
    refX: "0",
    refY: "5",
    markerWidth: "10",
    markerHeight: "10",
    orient: "auto",
  });
  zeroOrOne.appendChild(
    createSVGElement("circle", {
      cx: "3",
      cy: "5",
      r: "3",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
    })
  );
  zeroOrOne.appendChild(
    createSVGElement("line", {
      x1: "6",
      y1: "0",
      x2: "6",
      y2: "10",
      stroke: "currentColor",
      "stroke-width": "1.5",
    })
  );
  defs.appendChild(zeroOrOne);

  // Zero or many (circle + crow's foot)
  const zeroOrMany = createSVGElement("marker", {
    id: "zeroOrMany",
    viewBox: "0 0 10 10",
    refX: "0",
    refY: "5",
    markerWidth: "10",
    markerHeight: "10",
    orient: "auto",
  });
  zeroOrMany.appendChild(
    createSVGElement("circle", {
      cx: "3",
      cy: "5",
      r: "3",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
    })
  );
  zeroOrMany.appendChild(
    createSVGElement("path", {
      d: "M6,1 L10,5 L6,9",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
    })
  );
  defs.appendChild(zeroOrMany);

  svgRoot.appendChild(defs);
}
