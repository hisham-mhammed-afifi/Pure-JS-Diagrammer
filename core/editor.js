// core/editor.js
/**
 * Updates line numbers next to a textarea.
 * @param {HTMLTextAreaElement} textarea - The textarea element.
 * @param {HTMLElement} lineNumbersDiv - The div to display line numbers.
 */
export function updateLineNumbers(textarea, lineNumbersDiv) {
  const lines = textarea.value.split("\n");
  const numLines = lines.length;
  let lineNumbersHtml = "";
  for (let i = 1; i <= numLines; i++) {
    lineNumbersHtml += `${i}\n`;
  }
  lineNumbersDiv.textContent = lineNumbersHtml;
}

/**
 * Pretty prints a JSON string.
 * @param {string} jsonString - The JSON string to format.
 * @returns {string} The formatted JSON string.
 */
export function prettyPrint(jsonString) {
  return JSON.stringify(JSON.parse(jsonString), null, 2);
}

/**
 * Debounces a function call.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {Function} A debounced version of the function.
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(context, args), delay);
  };
}

/**
 * Calculates line and column from a character index in a string.
 * @param {string} text - The full text content.
 * @param {number} index - The character index.
 * @returns {{line: number, column: number}} Line and column (0-indexed).
 */
export function getLineColFromCharIndex(text, index) {
  const lines = text.substring(0, index).split("\n");
  const line = lines.length - 1;
  const column = lines[lines.length - 1].length;
  return { line, column };
}
