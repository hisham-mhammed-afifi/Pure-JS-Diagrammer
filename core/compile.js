// core/compile.js
import { renderFlowchart } from "../render/flowchart.js";
import { renderSequence } from "../render/sequence.js";
import { renderERD } from "../render/erd.js";
import { createSVGElement } from "../render/svg.js";

/**
 * Dispatches the rendering to the appropriate diagram type renderer.
 * @param {object} jsonData - The validated JSON data.
 * @returns {object} An object containing success status, error message (if any),
 *                   and the generated SVG element and its viewBox.
 */
export function compileAndRender(jsonData) {
  const tempSvgContainer = createSVGElement("svg"); // Create a temporary SVG element

  let result;
  switch (jsonData.type) {
    case "flowchart":
      result = renderFlowchart(jsonData, tempSvgContainer);
      break;
    case "sequence":
      result = renderSequence(jsonData, tempSvgContainer);
      break;
    case "erd":
      result = renderERD(jsonData, tempSvgContainer);
      break;
    default:
      return {
        success: false,
        error: "Unknown diagram type: " + jsonData.type,
      };
  }

  // The individual renderers should return { success, error, svgElement, viewBox }
  // If successful, result.svgElement will be the tempSvgContainer with content.
  return result;
}
