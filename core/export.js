// core/export.js
/**
 * Exports the current SVG content as an SVG file.
 * @param {SVGElement} svgElement - The SVG element to export.
 */
export function exportSVG(svgElement) {
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);

  // Add XML declaration if not present
  if (!svgString.includes("<?xml")) {
    svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
  }

  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `diagram-${new Date().toISOString().slice(0, 10)}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports the current SVG content as a PNG file using a canvas.
 * @param {SVGElement} svgElement - The SVG element to export.
 * @param {HTMLCanvasElement} canvasElement - A canvas element to draw onto.
 */
export function exportPNG(svgElement, canvasElement) {
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);

  // Get the current viewBox values to set canvas dimensions correctly
  const viewBoxAttr = svgElement.getAttribute("viewBox");
  let width = 800; // Default width
  let height = 600; // Default height

  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/\s+|,/);
    if (parts.length === 4) {
      // Assume width/height are the 3rd and 4th values
      width = parseFloat(parts[2]);
      height = parseFloat(parts[3]);
    }
  }

  // Use a multiplier for higher resolution PNG
  const resolutionMultiplier = 2;
  canvasElement.width = width * resolutionMultiplier;
  canvasElement.height = height * resolutionMultiplier;

  const ctx = canvasElement.getContext("2d");
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear previous content

  const img = new Image();
  // It's crucial to correctly base64 encode SVG string for Image src
  // unescape(encodeURIComponent()) is used to handle UTF-8 characters properly
  img.src =
    "data:image/svg+xml;base64," +
    btoa(unescape(encodeURIComponent(svgString)));

  img.onload = () => {
    // Draw the image onto the canvas, scaling to fit the higher resolution
    ctx.drawImage(img, 0, 0, canvasElement.width, canvasElement.height);

    // Create a download link for the PNG
    const a = document.createElement("a");
    a.href = canvasElement.toDataURL("image/png");
    a.download = `diagram-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  img.onerror = (error) => {
    console.error("Error loading SVG for PNG export:", error);
    alert(
      "Could not export PNG. Make sure the diagram is valid and visible. (SVG to Canvas rendering issues might occur with complex/invalid SVGs)"
    );
  };
}
