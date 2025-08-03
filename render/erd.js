// render/erd.js
import {
  createSVGElement,
  createText,
  createPath,
  measureText,
  wrapText,
  createCommonDefs,
} from "./svg.js";

const ENTITY_HEADER_HEIGHT = 30;
const ATTRIBUTE_HEIGHT = 20;
const ENTITY_PADDING_X = 15;
const ENTITY_PADDING_Y = 10;
const ENTITY_MIN_WIDTH = 150;
const ENTITY_MAX_WIDTH = 300; // Cap width for very long names
const ENTITY_H_GAP = 80;
const ENTITY_V_GAP = 80;
const FONT_SIZE_ENTITY = 16;
const FONT_SIZE_ATTRIBUTE = 14;
const FONT_FAMILY = "sans-serif"; // Must match CSS

export function renderERD(data, svgContainer) {
  if (!data.entities || !data.relationships) {
    return {
      success: false,
      error: "Invalid ERD data: missing entities or relationships",
    };
  }

  svgContainer.innerHTML = "";
  createCommonDefs(svgContainer);

  const entitiesMap = new Map();
  let maxContentWidth = ENTITY_MIN_WIDTH - ENTITY_PADDING_X * 2; // For calculating min entity width based on content

  // Pre-calculate attribute heights and max widths for entities
  data.entities.forEach((entity) => {
    let currentEntityMaxTextWidth = measureText(
      entity.name,
      FONT_SIZE_ENTITY,
      FONT_FAMILY
    );
    entity.attributes.forEach((attr) => {
      const attrText = `${attr.name}: ${attr.type}`;
      currentEntityMaxTextWidth = Math.max(
        currentEntityMaxTextWidth,
        measureText(attrText, FONT_SIZE_ATTRIBUTE, FONT_FAMILY)
      );
    });
    entity.calculatedWidth = Math.min(
      ENTITY_MAX_WIDTH,
      Math.max(
        ENTITY_MIN_WIDTH,
        currentEntityMaxTextWidth + ENTITY_PADDING_X * 2
      )
    );
    entity.calculatedHeight =
      ENTITY_HEADER_HEIGHT +
      entity.attributes.length * ATTRIBUTE_HEIGHT +
      ENTITY_PADDING_Y * 2;
    entitiesMap.set(entity.name, { ...entity, x: 0, y: 0 }); // Initialize positions
    maxContentWidth = Math.max(maxContentWidth, currentEntityMaxTextWidth);
  });

  // Simple grid layout to place entities
  // This is a basic packing algorithm, not an optimized graph layout
  const positionedEntities = layoutEntitiesGrid(
    Array.from(entitiesMap.values())
  );

  let maxX = 0;
  let maxY = 0;
  const entityRects = new Map(); // Store rect elements for relationship drawing

  // Draw entities
  positionedEntities.forEach((entity) => {
    const x = entity.x;
    const y = entity.y;
    const width = entity.calculatedWidth;
    const height = entity.calculatedHeight;

    const rect = createSVGElement("rect", {
      x: x,
      y: y,
      width: width,
      height: height,
      rx: 5,
      ry: 5,
      className: "entity-box",
    });
    svgContainer.appendChild(rect);
    entityRects.set(entity.name, { x, y, width, height });

    // Entity name
    const wrappedEntityName = wrapText(
      entity.name,
      width - ENTITY_PADDING_X * 2,
      FONT_SIZE_ENTITY,
      FONT_FAMILY
    );
    const entityNameTextY =
      y +
      ENTITY_HEADER_HEIGHT / 2 -
      ((wrappedEntityName.length - 1) * FONT_SIZE_ENTITY * 0.6) / 2;
    svgContainer.appendChild(
      createText(
        entity.name,
        x + width / 2,
        entityNameTextY,
        {
          className: "entity-title",
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": FONT_SIZE_ENTITY,
          "font-family": FONT_FAMILY,
        },
        wrappedEntityName
      )
    );

    // Attributes
    let currentAttrY = y + ENTITY_HEADER_HEIGHT + ATTRIBUTE_HEIGHT / 2;
    entity.attributes.forEach((attr) => {
      let attrClass = "attribute";
      if (attr.pk) attrClass += " pk";
      if (attr.fk) attrClass += " fk";
      if (attr.unique) attrClass += " unique";

      const attrText = `${attr.name}: ${attr.type}`;
      const wrappedAttrText = wrapText(
        attrText,
        width - ENTITY_PADDING_X * 2,
        FONT_SIZE_ATTRIBUTE,
        FONT_FAMILY
      );

      svgContainer.appendChild(
        createText(
          attrText,
          x + ENTITY_PADDING_X,
          currentAttrY,
          {
            className: attrClass,
            "dominant-baseline": "middle",
            "font-size": FONT_SIZE_ATTRIBUTE,
            "font-family": FONT_FAMILY,
          },
          wrappedAttrText
        )
      );
      currentAttrY += ATTRIBUTE_HEIGHT;
    });

    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  // Draw relationships
  data.relationships.forEach((rel) => {
    const fromEntityRect = entityRects.get(rel.from);
    const toEntityRect = entityRects.get(rel.to);

    if (!fromEntityRect || !toEntityRect) {
      console.warn(`Missing entity for relationship: ${rel.from} - ${rel.to}`);
      return;
    }

    // Determine connection points on the rectangles
    const { start, end } = getClosestConnectionPoints(
      fromEntityRect,
      toEntityRect
    );

    const path = createPath(`M ${start.x},${start.y} L ${end.x},${end.y}`, {
      className: "relationship-line",
      "marker-start": getCardinalityMarker(rel.cardinality, "start"),
      "marker-end": getCardinalityMarker(rel.cardinality, "end"),
    });
    svgContainer.appendChild(path);
  });

  // Calculate final viewBox with padding
  const padding = 50;
  const minX = Math.min(...positionedEntities.map((e) => e.x)) - padding / 2;
  const minY = Math.min(...positionedEntities.map((e) => e.y)) - padding / 2;
  const finalWidth = maxX - minX + padding;
  const finalHeight = maxY - minY + padding;
  const viewBox = `${minX} ${minY} ${finalWidth} ${finalHeight}`;

  return { success: true, svgElement: svgContainer, viewBox };
}

/**
 * Basic grid layout for entities. Iterates and places entities row by row.
 * Does not optimize for edge crossings.
 * @param {Array} entities
 * @returns {Array} Entities with assigned x, y coordinates.
 */
function layoutEntitiesGrid(entities) {
  if (entities.length === 0) return [];

  let currentX = 0;
  let currentY = 0;
  let rowMaxHeight = 0;
  const placedEntities = [];

  // Sort entities to give a consistent layout
  entities.sort((a, b) => a.name.localeCompare(b.name));

  entities.forEach((entity) => {
    // If entity exceeds typical screen width, start new row (rough estimate for typical screens)
    // Or if it simply doesn't fit in the current "virtual" row
    if (
      placedEntities.length > 0 &&
      currentX + entity.calculatedWidth + ENTITY_H_GAP > 800 + ENTITY_H_GAP
    ) {
      // 800 is arbitrary width for a row
      currentX = 0;
      currentY += rowMaxHeight + ENTITY_V_GAP;
      rowMaxHeight = 0;
    }

    entity.x = currentX;
    entity.y = currentY;
    placedEntities.push(entity);

    currentX += entity.calculatedWidth + ENTITY_H_GAP;
    rowMaxHeight = Math.max(rowMaxHeight, entity.calculatedHeight);
  });

  return placedEntities;
}

/**
 * Determines the closest points on the borders of two rectangles for a connecting line.
 * @param {object} rect1 - {x, y, width, height}
 * @param {object} rect2 - {x, y, width, height}
 * @returns {object} {start: {x,y}, end: {x,y}}
 */
function getClosestConnectionPoints(rect1, rect2) {
  // Calculate centers
  const c1x = rect1.x + rect1.width / 2;
  const c1y = rect1.y + rect1.height / 2;
  const c2x = rect2.x + rect2.width / 2;
  const c2y = rect2.y + rect2.height / 2;

  // Determine the general direction (horizontal or vertical)
  const dx = c2x - c1x;
  const dy = c2y - c1y;

  let p1 = {};
  let p2 = {};

  // Simple strategy: connect center to center, then find intersection with rectangle bounds
  // This is a simplified version and doesn't always guarantee shortest path,
  // but ensures line starts/ends on the box.

  // For ERD, lines often go from center of one side to center of another side.
  // If rect1 is to the left of rect2
  if (c1x < c2x - rect2.width / 2) {
    // rect1 is clearly left of rect2
    p1.x = rect1.x + rect1.width; // Right side of rect1
    p2.x = rect2.x; // Left side of rect2
  } else if (c1x > c2x + rect2.width / 2) {
    // rect1 is clearly right of rect2
    p1.x = rect1.x; // Left side of rect1
    p2.x = rect2.x + rect2.width; // Right side of rect2
  } else {
    // X-overlap, use top/bottom
    p1.x = c1x;
    p2.x = c2x;
  }

  // If rect1 is above rect2
  if (c1y < c2y - rect2.height / 2) {
    // rect1 is clearly above rect2
    p1.y = rect1.y + rect1.height; // Bottom side of rect1
    p2.y = rect2.y; // Top side of rect2
  } else if (c1y > c2y + rect2.height / 2) {
    // rect1 is clearly below rect2
    p1.y = rect1.y; // Top side of rect1
    p2.y = rect2.y + rect2.height; // Bottom side of rect2
  } else {
    // Y-overlap, use left/right
    p1.y = c1y;
    p2.y = c2y;
  }

  // A more robust method would involve finding the intersection of the line (c1,c2) with rect1 and rect2.
  // For simplicity, let's use a straight line between the closest corners, or centers of sides.
  // This simplified version connects the centers of the most "face-to-face" sides.
  // A better heuristic: if horizontal distance is greater, connect horizontal sides, else vertical.
  if (Math.abs(dx) > Math.abs(dy)) {
    // More horizontal than vertical
    p1 = { x: dx > 0 ? rect1.x + rect1.width : rect1.x, y: c1y };
    p2 = { x: dx > 0 ? rect2.x : rect2.x + rect2.width, y: c2y };
  } else {
    // More vertical than horizontal, or roughly equal
    p1 = { x: c1x, y: dy > 0 ? rect1.y + rect1.height : rect1.y };
    p2 = { x: c2x, y: dy > 0 ? rect2.y : rect2.y + rect2.height };
  }

  return { start: p1, end: p2 };
}

/**
 * Returns the correct SVG marker URL based on cardinality and position.
 * @param {string} cardinality - e.g., "1..*", "0..1"
 * @param {'start'|'end'} position - Whether it's the start or end of the line.
 * @returns {string} Marker URL or empty string.
 */
function getCardinalityMarker(cardinality, position) {
  let markerId = "";
  const parts = cardinality.split("..");
  const firstChar = parts[0];
  const secondChar = parts[1];

  // For relationships, the marker applies to the "many" side, or "one" side.
  // If it's a "1..*" relationship, the "*" part is on the `to` side (end marker if from->to).
  // The "1" part is on the `from` side (start marker).
  // The `position` parameter here refers to the line segment start/end.
  // For example, if rel.cardinality is "1..*", and this function is called for the 'end' position,
  // it implies the 'to' entity, which should show the '*' marker.

  // ERD cardinality notation usually refers to (min..max) on the *far* side of the relationship.
  // So for "A (1) --- (0..*) B", the "1" applies to A's relationship to B, and "0..*" applies to B's relationship to A.
  // In our JSON, `cardinality` is for the `to` entity.
  // So 'start' marker is for the `from` entity's side, and 'end' marker for the `to` entity's side.

  // Let's assume cardinality means "From [this] To [cardinality]"
  // E.g., User (1) to Order (*). So from User to Order has a 'many' on the Order side.
  // The spec uses `cardinality` for the `to` side. The `from` side is assumed '1'.

  // Given `cardinality`: "from" side will be 'one' (single line) unless "from" is '0' or 'many'.
  // The prompt says: "relationships: ... cardinality: "1..*""
  // This implies `cardinality` is for `to`. So `from` side is single line by default.
  // However, the rule "cardinality": "1..*" means `from` has 1, `to` has *.
  // But then "*..*" means crow's foot both sides. This indicates `cardinality` implies both ends.

  // Re-interpreting: `cardinality` describes the relationship type, and both ends get a marker.
  // Let's assume the string format "X..Y" means 'X' is the marker for the `from` side, and 'Y' is for the `to` side.
  // The prompt's example `"cardinality": "1..*"` for `relationships` implies it's a single value for the relationship.
  // This is ambiguous. Most ERD tools specify cardinality for *each* end of the relationship.
  // Given the simplicity requirement, I'll interpret `cardinality` as the *type* of relationship, and map that to specific end markers.

  // Re-interpreting based on the rules:
  // "0..1" = small circle + single line (on *one* end, which one?)
  // "1..1" = single line (on *one* end)
  // "1..*" = crow’s foot (on *one* end)
  // "0..*" = small circle + crow’s foot (on *one* end)
  // "*..*" = crow’s foot both sides.

  // This strongly suggests `cardinality` is about the *target* (to) entity's relationship,
  // and the `from` entity implicitly has '1' unless it's "*..*".

  // Let's map `cardinality` to the marker on the `end` (to) side, and default 'one' for `start` (from) side.
  // The only exception is "*..*", where both sides are crow's foot.

  if (position === "start") {
    // Marker for the 'from' entity side
    if (cardinality === "*..*") {
      markerId = "url(#oneToMany)"; // Assumed crow's foot
    } else {
      markerId = "url(#one)"; // Default 1
    }
  } else {
    // Marker for the 'end' (to) entity side
    switch (cardinality) {
      case "0..1":
        markerId = "url(#zeroOrOne)";
        break;
      case "1..1":
        markerId = "url(#one)";
        break;
      case "1..*":
        markerId = "url(#oneToMany)"; // For *
        break;
      case "0..*":
        markerId = "url(#zeroOrMany)";
        break;
      case "*..*":
        markerId = "url(#oneToMany)"; // For *
        break;
      default:
        markerId = "url(#one)"; // Fallback
    }
  }
  return markerId;
}
