// core/url.js
/**
 * Encodes an object into a URL-safe string.
 * Uses JSON.stringify -> encodeURIComponent -> btoa for robustness with unicode.
 * @param {any} data - The data to encode.
 * @returns {string} The encoded string.
 */
export function encodeData(data) {
  // encodeURIComponent handles most characters, but btoa only works on Latin-1.
  // unescape(encodeURIComponent()) is a common trick to get UTF-8 into Latin-1 range for btoa.
  // JSON.stringify handles the object to string conversion.
  const jsonString = JSON.stringify(data);
  const encoded = btoa(unescape(encodeURIComponent(jsonString)));
  return encoded;
}

/**
 * Decodes a URL-safe string back into an object.
 * Uses atob -> decodeURIComponent -> JSON.parse.
 * @param {string} encodedString - The encoded string from the URL hash.
 * @returns {any} The decoded object.
 * @throws {Error} If decoding or parsing fails.
 */
export function decodeData(encodedString) {
  const decoded = decodeURIComponent(escape(atob(encodedString)));
  const data = JSON.parse(decoded);
  return data;
}
