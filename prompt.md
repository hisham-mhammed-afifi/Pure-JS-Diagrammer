You are a senior front-end engineer. Build a **pure HTML/CSS/JS** single-file (and small module files) **web app** that accepts **JSON** and **renders a diagram** with **no external libraries or dependencies** (no CDN, no frameworks, no build tools). Provide complete, runnable code that works by opening `index.html` in a modern browser.

## Goals

- Two-pane layout: **left** JSON editor (textarea with line numbers), **right** live diagram preview (inline **SVG** you generate via JavaScript).
- **Validate** JSON against a small built-in spec (handwritten validation functions). Show clear, actionable errors.
- **Compile JSON → SVG** for three diagram types: **flowchart**, **sequence**, **ERD**.
- **Export** diagram as **SVG** and **PNG** (use `<canvas>` to rasterize).
- **Shareable URL**: encode JSON into `location.hash` using `encodeURIComponent` (no compression libs). On load, hydrate from hash.
- **No external libs**: everything must be vanilla JS/DOM/SVG. No Mermaid, no AJV, no LZ-String, no CSS frameworks.

## Supported JSON Spec (exact)

Top-level:

```json
{ "type": "<flowchart|sequence|erd>", ... }
```

1. **Flowchart**

```json
{
  "type": "flowchart",
  "direction": "TD",
  "nodes": [
    { "id": "A", "label": "Start" },
    { "id": "B", "label": "Process" },
    { "id": "C", "label": "End" }
  ],
  "edges": [
    { "from": "A", "to": "B", "label": "go" },
    { "from": "B", "to": "C" }
  ]
}
```

Rules:

- `direction` ∈ {"TD","TB","LR","RL"} (treat TD=TB).
- Auto-layout with simple layered/force-like placement:

  - Place nodes in rows/columns based on a BFS from sources; spacing constants (e.g., 220×140).
  - Route edges as straight lines with arrow markers; add edge labels centered.

2. **Sequence**

```json
{
  "type": "sequence",
  "participants": ["User", "API", "DB"],
  "messages": [
    { "from": "User", "to": "API", "text": "GET /items" },
    { "from": "API", "to": "DB", "text": "SELECT *" },
    { "from": "DB", "to": "API", "text": "Rows" },
    { "from": "API", "to": "User", "text": "200 OK" }
  ]
}
```

Rules:

- Draw lifelines vertically, evenly spaced; headers as rounded rectangles.
- Messages as horizontal arrows between lifelines at incrementing y positions; dashed for replies if `text` starts with a number status (e.g., `200`).

3. **ERD**

```json
{
  "type": "erd",
  "entities": [
    {
      "name": "User",
      "attributes": [
        { "name": "id", "type": "int", "pk": true },
        { "name": "email", "type": "varchar", "unique": true },
        { "name": "created_at", "type": "timestamp" }
      ]
    },
    {
      "name": "Order",
      "attributes": [
        { "name": "id", "type": "int", "pk": true },
        { "name": "user_id", "type": "int", "fk": "User.id" },
        { "name": "total", "type": "decimal" }
      ]
    }
  ],
  "relationships": [{ "from": "User", "to": "Order", "cardinality": "1..*" }]
}
```

Rules:

- Render entities as tables (title + rows). Style PK (underline), FK (italic), UNIQUE (★).
- Auto-place with simple grid packing to minimize edge crossings.
- Relationship connectors with crow’s foot markers:

  - Map `"0..1"` = small circle + single line,
  - `"1..1"` = single line,
  - `"1..*"` = crow’s foot,
  - `"0..*"` = small circle + crow’s foot,
  - `"*..*"` = crow’s foot both sides.

## Validation (handwritten)

- Top-level: must be object with `"type"` ∈ {flowchart, sequence, erd}.
- Flowchart:

  - `nodes`: array of unique `id` strings; each has non-empty `label`.
  - `edges`: `from`/`to` must reference existing node ids; no self-loops unless explicitly allowed.

- Sequence:

  - `participants`: unique, non-empty strings.
  - `messages`: `from` and `to` exist in `participants`; `text` non-empty.

- ERD:

  - `entities`: unique `name`; attributes unique per entity.
  - PK constraints: at least one `pk` per entity.
  - FK format `X.Y` must reference an existing entity/attribute.
  - `relationships`: `from`/`to` reference entities; `cardinality` in the set above.

Error UI:

- Show first error prominently and a collapsible list of all errors.
- If possible, show the character index/line via simple line/column computation after `JSON.parse`.

## Features

- **Editor**: textarea with CSS line numbers (using counters). Buttons:

  - Format JSON (pretty print)
  - Sample (Flowchart/Sequence/ERD)
  - Render (also auto-render with 300ms debounce on valid input)
  - Export SVG
  - Export PNG
  - Copy Share URL
  - Theme: Light/Dark (persist in `localStorage`)

- **Resizable split**: vertical drag handle; store last width in `localStorage`.
- **Performance**: create/reuse a single `<svg>`; clear and redraw layers.
- **Accessibility**: keyboard navigation, ARIA labels, focus styles, prefers-color-scheme support.
- **Security**: never use `innerHTML` with user input; only set `textContent` and SVG attributes.

## Architecture (files)

```
index.html
styles.css
script.js                  // UI wiring, state, events
render/svg.js           // helpers to create SVG elements, markers, text wrapping
render/flowchart.js     // layout & draw flowchart
render/sequence.js      // layout & draw sequence diagram
render/erd.js           // layout & draw ERD with crow’s foot
core/validate.js        // handwritten validators per type
core/compile.js         // dispatch: JSON -> internal model -> draw via renderers
core/url.js             // encode/decode JSON in URL hash (encodeURIComponent/atob-btoa safe handling)
core/export.js          // toSVG(), toPNG() via canvas
core/editor.js          // debounce, pretty print, line/col mapping
samples/flowchart.json
samples/sequence.json
samples/erd.json
```

## Implementation Notes

- **Auto-layout basics**:

  - Flowchart: BFS layers by in-degree (Kahn’s algorithm) to assign rows; within row, order by original index; place with fixed spacing; arrows with `<marker>` arrowheads.
  - Sequence: x = i \* X_GAP; y = HEADER_H + i_msg \* MSG_GAP; center text on arrows.
  - ERD: pack entities into columns based on relationship degree; simple collision resolver that shifts by grid steps.

- **Text wrapping**: implement a small function measuring approximate character width and inserting line breaks at word boundaries; use `<tspan>` for SVG multiline.
- **PNG export**: serialize current SVG via `XMLSerializer`, draw to `<canvas>` with an `<img>`; handle foreignObject absence (stick to pure SVG primitives).
- **Share URL**: `location.hash = encodeURIComponent(JSON.stringify(obj))`; on load, if hash present, parse; guard with try/catch and size cap (e.g., 16KB).
- **Theme**: toggle `data-theme="dark"` on `<html>`; define CSS vars (colors, borders) for both themes.

## Output Requirements (strict)

1. Start with a **brief overview** (≤6 lines).
2. Provide the **file tree** as above.
3. Provide **all files in full**, each in a fenced code block with the correct filename label, e.g.:

   ```html
   <!-- index.html -->
   ...full content...
   ```

   ```css
   /* styles.css */
   ...full content...;
   ```

   ```js
   // script.js
   ...full content...
   ```

   …and so on for every listed file (no omissions, no placeholders).

4. Include **three sample JSON files** (as listed) and **two invalid edge-case examples per type** (inline in the answer) demonstrating validation errors.
5. End with a **Manual Validation Checklist**: load app, paste samples, see diagrams, try invalid JSON, resize panes, toggle theme, export SVG/PNG, copy URL and reload to reconstruct.

## Acceptance Criteria

- Opening `index.html` shows the app; pasting each sample renders correct SVG diagrams.
- Invalid inputs show clear errors without breaking the UI.
- Exports download correctly named files with timestamps.
- Share URL round-trips the exact diagram.
- No external network requests; no console errors.

Produce the full solution now.
