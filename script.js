// script.js
import {
  updateLineNumbers,
  prettyPrint,
  debounce,
  getLineColFromCharIndex,
} from "./core/editor.js";
import { validate } from "./core/validate.js";
import { compileAndRender } from "./core/compile.js";
import { encodeData, decodeData } from "./core/url.js";
import { exportSVG, exportPNG } from "./core/export.js";

// DOM Elements
const jsonEditor = document.getElementById("jsonEditor");
const lineNumbersDiv = document.querySelector(".line-numbers");
const diagramSvg = document.getElementById("diagramSvg");
const diagramCanvas = document.getElementById("diagramCanvas");
const errorDisplay = document.getElementById("errorDisplay");
const errorSummary = document.querySelector(".error-summary");
const errorDetailsList = document.querySelector(".error-details");

const formatJsonBtn = document.getElementById("formatJsonBtn");
const sampleFlowchartBtn = document.getElementById("sampleFlowchartBtn");
const sampleSequenceBtn = document.getElementById("sampleSequenceBtn");
const sampleErdBtn = document.getElementById("sampleErdBtn");
const renderBtn = document.getElementById("renderBtn");
const exportSvgBtn = document.getElementById("exportSvgBtn");
const exportPngBtn = document.getElementById("exportPngBtn");
const copyShareUrlBtn = document.getElementById("copyShareUrlBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const splitter = document.querySelector(".splitter");
const leftPane = document.querySelector(".left-pane");

// Constants
const LOCAL_STORAGE_THEME_KEY = "diagrammerTheme";
const LOCAL_STORAGE_SPLITTER_KEY = "diagrammerSplitterPos";
const SHARE_URL_MAX_LENGTH = 16 * 1024; // 16KB max hash length

// State
let currentTheme = "light";
let jsonInputTimeout;
const RENDER_DEBOUNCE_TIME = 500;

// --- Helper Functions ---

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  currentTheme = theme;
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
}

function loadTheme() {
  const savedTheme = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme(prefersDark ? "dark" : "light");
  }
}

function toggleErrorDisplay(expand) {
  if (expand) {
    errorSummary.classList.add("expanded");
    errorDetailsList.classList.remove("collapsed");
  } else {
    errorSummary.classList.remove("expanded");
    errorDetailsList.classList.add("collapsed");
  }
}

function displayErrors(errors, jsonString) {
  errorDisplay.style.display = "block";
  errorDetailsList.innerHTML = ""; // Clear previous errors

  if (errors.length === 0) {
    errorDisplay.style.display = "none";
    return;
  }

  // Always show the first error in summary
  const firstError = errors[0];
  const firstErrorDetails = getLineColFromCharIndex(
    jsonString,
    firstError.index
  );
  errorSummary.textContent = `${firstError.message} (Line: ${
    firstErrorDetails.line + 1
  }, Col: ${firstErrorDetails.column + 1})`;
  errorSummary.onclick = () =>
    toggleErrorDisplay(errorDetailsList.classList.contains("collapsed"));
  toggleErrorDisplay(false); // Start collapsed

  const ul = document.createElement("ul");
  errors.forEach((err) => {
    const li = document.createElement("li");
    const errDetails = getLineColFromCharIndex(jsonString, err.index);
    li.textContent = `• ${err.message} (Line: ${errDetails.line + 1}, Col: ${
      errDetails.column + 1
    })`;
    ul.appendChild(li);
  });
  errorDetailsList.appendChild(ul);
}

// --- Main Render Logic ---

async function renderDiagram() {
  clearTimeout(jsonInputTimeout);
  const jsonString = jsonEditor.value;
  diagramSvg.innerHTML = ""; // Clear SVG
  diagramSvg.removeAttribute("viewBox"); // Reset viewBox

  if (!jsonString.trim()) {
    displayErrors([], jsonString); // Clear errors
    return;
  }

  try {
    const parseErrors = validate.getParseErrors(jsonString);
    if (parseErrors.length > 0) {
      displayErrors(parseErrors, jsonString);
      return;
    }

    const jsonData = JSON.parse(jsonString);
    const validationErrors = validate.validate(jsonData, jsonString);

    if (validationErrors.length > 0) {
      displayErrors(validationErrors, jsonString);
      return;
    }

    // If no errors, clear error display
    displayErrors([], jsonString);

    // Compile and render the diagram
    const { success, error, svgElement, viewBox } = compileAndRender(jsonData);

    if (success) {
      diagramSvg.innerHTML = ""; // Ensure fresh render
      if (svgElement) {
        // Transfer children and attributes to the main SVG element
        Array.from(svgElement.children).forEach((child) =>
          diagramSvg.appendChild(child)
        );
        Array.from(svgElement.attributes).forEach((attr) => {
          if (attr.name !== "width" && attr.name !== "height") {
            // width/height are set by CSS
            diagramSvg.setAttribute(attr.name, attr.value);
          }
        });
        if (viewBox) {
          diagramSvg.setAttribute("viewBox", viewBox);
        } else {
          // Fallback: If no specific viewBox from renderer, calculate from elements
          const bbox = diagramSvg.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            diagramSvg.setAttribute(
              "viewBox",
              `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`
            );
          }
        }
      }
    } else {
      // Render error if compilation failed after validation passed
      displayErrors(
        [{ message: `Diagram rendering failed: ${error}`, index: 0 }],
        jsonString
      );
    }
  } catch (e) {
    // Catch any unexpected runtime errors
    displayErrors(
      [{ message: `An unexpected error occurred: ${e.message}`, index: 0 }],
      jsonString
    );
    console.error("Unexpected error during diagram rendering:", e);
  }
}

const debouncedRenderDiagram = debounce(renderDiagram, RENDER_DEBOUNCE_TIME);

// --- Event Handlers ---

jsonEditor.addEventListener("input", () => {
  updateLineNumbers(jsonEditor, lineNumbersDiv);
  // Auto-render on valid input after debounce
  debouncedRenderDiagram();
});

jsonEditor.addEventListener("scroll", () => {
  lineNumbersDiv.scrollTop = jsonEditor.scrollTop;
});

formatJsonBtn.addEventListener("click", () => {
  try {
    jsonEditor.value = prettyPrint(jsonEditor.value);
    updateLineNumbers(jsonEditor, lineNumbersDiv);
    renderDiagram(); // Re-render after formatting
  } catch (e) {
    // Validation will catch invalid JSON, but we can give immediate feedback for formatting
    displayErrors(
      [{ message: `Invalid JSON for formatting: ${e.message}`, index: 0 }],
      jsonEditor.value
    );
  }
});

sampleFlowchartBtn.addEventListener("click", async () => {
  const response = await fetch("./samples/flowchart.json");
  jsonEditor.value = await response.text();
  updateLineNumbers(jsonEditor, lineNumbersDiv);
  renderDiagram();
});

sampleSequenceBtn.addEventListener("click", async () => {
  const response = await fetch("./samples/sequence.json");
  jsonEditor.value = await response.text();
  updateLineNumbers(jsonEditor, lineNumbersDiv);
  renderDiagram();
});

sampleErdBtn.addEventListener("click", async () => {
  const response = await fetch("./samples/erd.json");
  jsonEditor.value = await response.text();
  updateLineNumbers(jsonEditor, lineNumbersDiv);
  renderDiagram();
});

renderBtn.addEventListener("click", renderDiagram);

exportSvgBtn.addEventListener("click", () => {
  exportSVG(diagramSvg);
});

exportPngBtn.addEventListener("click", () => {
  exportPNG(diagramSvg, diagramCanvas);
});

copyShareUrlBtn.addEventListener("click", () => {
  try {
    const jsonString = jsonEditor.value;
    const encoded = encodeData(jsonString);
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;

    if (url.length > SHARE_URL_MAX_LENGTH) {
      alert(
        `Share URL is too long (${url.length} chars). Max allowed: ${SHARE_URL_MAX_LENGTH} chars. Please reduce JSON size.`
      );
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => alert("Share URL copied to clipboard!"))
      .catch((err) => console.error("Failed to copy URL:", err));
  } catch (e) {
    alert("Could not generate share URL. Is JSON valid? " + e.message);
  }
});

themeToggleBtn.addEventListener("click", () => {
  applyTheme(currentTheme === "light" ? "dark" : "light");
});

// --- Splitter Logic ---

// Make sure splitter is focusable for keyboard resizing
// <div id="splitter" role="separator" aria-orientation="vertical" tabindex="0"></div>

const container = document.querySelector(".container");

function cssSizeToPx(el, value, referencePx) {
  if (!value || value === "auto" || value === "none") return null;
  value = value.trim();
  if (value.endsWith("px")) return parseFloat(value);
  if (value.endsWith("%")) return (parseFloat(value) / 100) * referencePx;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null; // fallback
}

let isDragging = false;

splitter.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  isDragging = true;
  splitter.setPointerCapture(e.pointerId); // ensure we keep receiving events
  leftPane.style.userSelect = "none";
  leftPane.style.pointerEvents = "none";
  document.body.style.cursor = "ew-resize";
});

function resizeAt(clientX) {
  const containerRect = container.getBoundingClientRect();
  let newWidth = clientX - containerRect.left;

  const cs = getComputedStyle(leftPane);
  const minW = cssSizeToPx(leftPane, cs.minWidth, containerRect.width) ?? 0;
  const maxW =
    cssSizeToPx(leftPane, cs.maxWidth, containerRect.width) ??
    containerRect.width;

  if (newWidth < minW) newWidth = minW;
  if (newWidth > maxW) newWidth = maxW;

  leftPane.style.flexBasis = `${newWidth}px`;
  localStorage.setItem(LOCAL_STORAGE_SPLITTER_KEY, String(newWidth));
}

splitter.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  resizeAt(e.clientX);
});

splitter.addEventListener("pointerup", (e) => {
  if (!isDragging) return;
  isDragging = false;
  leftPane.style.userSelect = "";
  leftPane.style.pointerEvents = "";
  document.body.style.cursor = "";
  renderDiagram();
});

// Keyboard support
splitter.addEventListener("keydown", (e) => {
  const step = 20;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

  e.preventDefault();
  const containerRect = container.getBoundingClientRect();
  const currentWidth = leftPane.getBoundingClientRect().width;

  const cs = getComputedStyle(leftPane);
  const minW = cssSizeToPx(leftPane, cs.minWidth, containerRect.width) ?? 0;
  const maxW =
    cssSizeToPx(leftPane, cs.maxWidth, containerRect.width) ??
    containerRect.width;

  let newWidth = currentWidth + (e.key === "ArrowLeft" ? -step : step);
  if (newWidth < minW) newWidth = minW;
  if (newWidth > maxW) newWidth = maxW;

  leftPane.style.flexBasis = `${newWidth}px`;
  localStorage.setItem(LOCAL_STORAGE_SPLITTER_KEY, String(newWidth));
  renderDiagram();
});

// --- Initialization ---

async function init() {
  loadTheme();

  // Load splitter position from localStorage
  const savedSplitterPos = localStorage.getItem(LOCAL_STORAGE_SPLITTER_KEY);
  if (savedSplitterPos) {
    leftPane.style.flexBasis = `${savedSplitterPos}px`;
  }

  // Try to load JSON from URL hash
  let initialJson = "";
  if (window.location.hash) {
    try {
      const hashData = window.location.hash.substring(1); // Remove '#'
      if (hashData.length > SHARE_URL_MAX_LENGTH) {
        throw new Error("Share URL data too large.");
      }
      initialJson = decodeData(hashData);
      console.log("Loaded JSON from URL hash.");
    } catch (e) {
      console.error("Failed to decode JSON from URL hash:", e);
      alert(
        "Failed to load diagram from URL. The data might be corrupted or too large. Loading sample flowchart."
      );
      // Fallback to sample flowchart
      const response = await fetch("./samples/flowchart.json");
      initialJson = await response.text();
      window.location.hash = ""; // Clear invalid hash
    }
  } else {
    // If no hash, load default sample flowchart
    const response = await fetch("./samples/flowchart.json");
    initialJson = await response.text();
  }

  jsonEditor.value = initialJson;
  updateLineNumbers(jsonEditor, lineNumbersDiv);
  renderDiagram(); // Initial render
}

document.addEventListener("DOMContentLoaded", init);
