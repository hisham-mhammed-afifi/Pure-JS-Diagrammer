# Pure JS Diagrammer

A small, dependency-free tool to draw **Flowcharts**, **Sequence Diagrams**, and **ERDs** from JSON.
Runs in the browser, renders to **SVG**, exports **SVG/PNG**, and supports **shareable URLs**.

## Features

- **Live preview** with JSON validation.
- **Samples**: Flowchart / Sequence / ERD.
- **Export**: SVG, PNG.
- **Share URL** via `location.hash` (up to \~16 KB).
- **Light/Dark theme** (saved in `localStorage`).
- **Resizable panes** (mouse + keyboard).

## Usage

1. Edit JSON in the left pane (auto-renders with debounce).
2. Use **Samples** to load examples.
3. **Format JSON** to pretty-print.
4. **Export SVG/PNG** from the right pane.
5. **Copy Share URL** to share the diagram state.
6. Toggle theme with **🌙/☀️**.

## Project Structure

```
index.html
styles.css
script.js
core/
  editor.js     # line numbers, prettyPrint, debounce, line/col
  validate.js   # JSON parse + shape validation
  compile.js    # JSON -> SVG
  url.js        # encode/decode share data
  export.js     # SVG/PNG export
samples/
  flowchart.json
  sequence.json
  erd.json
```

## Troubleshooting

- **Blank / no render**: check the error panel; ensure top-level `type` is one of `flowchart | sequence | erd`.
- **Samples don’t load**: serve the project from a local/static server (not `file://`).
- **Share URL too long**: reduce JSON size (limit \~16 KB).

## License

MIT
