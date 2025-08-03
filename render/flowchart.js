// render/flowchart.js
import {
  createSVGElement,
  createText,
  createPath,
  measureText,
  wrapText,
  createCommonDefs,
} from "./svg.js";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const H_GAP = 80; // Horizontal gap between nodes in the same layer
const V_GAP = 100; // Vertical gap between layers
const TEXT_PADDING_X = 15;
const TEXT_PADDING_Y = 10;
const FONT_SIZE = 16;
const FONT_FAMILY = "sans-serif"; // Must match CSS

export function renderFlowchart(data, svgContainer) {
  if (!data.nodes || !data.edges) {
    return {
      success: false,
      error: "Invalid flowchart data: missing nodes or edges",
    };
  }

  svgContainer.innerHTML = ""; // Clear existing content
  createCommonDefs(svgContainer); // Add SVG markers

  const nodesMap = new Map(
    data.nodes.map((node) => [
      node.id,
      { ...node, x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT },
    ])
  );
  const graph = buildGraph(data.nodes, data.edges, nodesMap);
  const layers = assignLayers(graph, nodesMap);
  const positionedNodes = positionNodes(layers, nodesMap);

  let maxX = 0;
  let maxY = 0;

  const nodeElements = new Map();

  // Draw nodes
  positionedNodes.forEach((node) => {
    const x = node.x;
    const y = node.y;

    const rect = createSVGElement("rect", {
      x: x,
      y: y,
      width: node.width,
      height: node.height,
      rx: 5, // Rounded corners
      ry: 5,
      className: "node",
    });
    svgContainer.appendChild(rect);

    const wrappedLines = wrapText(
      node.label,
      NODE_WIDTH - TEXT_PADDING_X * 2,
      FONT_SIZE,
      FONT_FAMILY
    );
    const textY =
      y + node.height / 2 - ((wrappedLines.length - 1) * FONT_SIZE * 0.6) / 2; // Center text vertically
    const textEl = createText(
      node.label,
      x + node.width / 2,
      textY,
      {
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": FONT_SIZE,
        "font-family": FONT_FAMILY,
      },
      wrappedLines
    );
    svgContainer.appendChild(textEl);
    nodeElements.set(node.id, {
      rect,
      textEl,
      bbox: { x, y, width: node.width, height: node.height },
    });

    maxX = Math.max(maxX, x + node.width);
    maxY = Math.max(maxY, y + node.height);
  });

  // Draw edges
  data.edges.forEach((edge) => {
    const fromNode = positionedNodes.find((n) => n.id === edge.from);
    const toNode = positionedNodes.find((n) => n.id === edge.to);

    if (!fromNode || !toNode) {
      console.warn(`Missing node for edge: ${edge.from} -> ${edge.to}`);
      return;
    }

    // Simple straight line routing for now
    // Determine attachment points for cleaner lines (e.g., from bottom/top, or side/side)
    let x1 = fromNode.x + fromNode.width / 2;
    let y1 = fromNode.y + fromNode.height; // From bottom of source node

    let x2 = toNode.x + toNode.width / 2;
    let y2 = toNode.y; // To top of target node

    // Adjust for "LR" or "RL" direction if implemented, but TD/TB is common default
    // For now, assume vertical flow
    const pathData = `M ${x1},${y1} L ${x1},${y1 + V_GAP / 2} L ${x2},${
      y1 + V_GAP / 2
    } L ${x2},${y2}`;

    const edgePath = createPath(pathData, {
      className: "edge",
      "marker-end": "url(#arrowhead)",
    });
    svgContainer.appendChild(edgePath);

    if (edge.label) {
      const labelX = (x1 + x2) / 2;
      const labelY = y1 + V_GAP / 2 + 5; // Slightly below the horizontal segment of the edge
      const labelEl = createText(edge.label, labelX, labelY, {
        className: "edge-label",
        "font-size": FONT_SIZE * 0.8,
        "text-anchor": "middle",
        "dominant-baseline": "hanging",
      });
      svgContainer.appendChild(labelEl);
    }
  });

  // Add some padding to the overall SVG viewbox
  const padding = 50;
  const finalWidth = maxX + padding;
  const finalHeight = maxY + padding;
  const initialX = Math.min(...positionedNodes.map((n) => n.x)) - padding / 2;
  const initialY = Math.min(...positionedNodes.map((n) => n.y)) - padding / 2;
  const viewBox = `${initialX} ${initialY} ${
    finalWidth - initialX + padding / 2
  } ${finalHeight - initialY + padding / 2}`;

  return { success: true, svgElement: svgContainer, viewBox };
}

/**
 * Builds an adjacency list graph representation.
 * @param {Array} nodes
 * @param {Array} edges
 * @param {Map} nodesMap
 * @returns {object} { adj: Map, inDegree: Map }
 */
function buildGraph(nodes, edges, nodesMap) {
  const adj = new Map(nodes.map((node) => [node.id, []]));
  const inDegree = new Map(nodes.map((node) => [node.id, 0]));

  edges.forEach((edge) => {
    if (adj.has(edge.from) && adj.has(edge.to)) {
      adj.get(edge.from).push(edge.to);
      inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    }
  });
  return { adj, inDegree };
}

/**
 * Assigns layers to nodes using a topological sort-like approach (BFS from sources).
 * @param {object} graph
 * @param {Map} nodesMap
 * @returns {Map<number, Array>} Map where key is layer index, value is array of node IDs.
 */
function assignLayers(graph, nodesMap) {
  const { adj, inDegree } = graph;
  const q = [];
  const layers = new Map(); // layerIndex -> [nodeId1, nodeId2]
  const nodeLayers = new Map(); // nodeId -> layerIndex

  // Initialize queue with nodes having an in-degree of 0 (sources)
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      q.push(nodeId);
      nodeLayers.set(nodeId, 0);
      if (!layers.has(0)) layers.set(0, []);
      layers.get(0).push(nodeId);
    }
  }

  let head = 0;
  while (head < q.length) {
    const u = q[head++];
    const currentLayer = nodeLayers.get(u);

    for (const v of adj.get(u)) {
      inDegree.set(v, inDegree.get(v) - 1);
      if (inDegree.get(v) === 0) {
        q.push(v);
        const nextLayer = currentLayer + 1;
        nodeLayers.set(v, nextLayer);
        if (!layers.has(nextLayer)) layers.set(nextLayer, []);
        layers.get(nextLayer).push(v);
      }
    }
  }

  // Handle cycles or unconnected nodes (assign to highest existing layer + 1 or 0)
  // For simplicity, any node not yet assigned a layer by BFS is put into layer 0
  // A more robust algorithm would deal with cycles differently (e.g., breaking back-edges)
  // but for simple flowcharts, this is acceptable.
  nodesMap.forEach((node) => {
    if (!nodeLayers.has(node.id)) {
      // Find max layer or default to 0
      const maxExistingLayer =
        layers.size > 0 ? Math.max(...Array.from(layers.keys())) : -1;
      const targetLayer = maxExistingLayer + 1; // Put them in a new layer at the end
      nodeLayers.set(node.id, targetLayer);
      if (!layers.has(targetLayer)) layers.set(targetLayer, []);
      layers.get(targetLayer).push(node.id);
    }
  });

  return { layers, nodeLayers };
}

/**
 * Positions nodes based on their assigned layers.
 * @param {object} layersData - Result from assignLayers.
 * @param {Map} nodesMap
 * @returns {Array} Array of node objects with x, y coordinates.
 */
function positionNodes(layersData, nodesMap) {
  const { layers, nodeLayers } = layersData;
  const positionedNodes = [];

  const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);

  let currentY = 0;
  for (const layerIndex of sortedLayerKeys) {
    const nodeIdsInLayer = layers.get(layerIndex);
    const numNodes = nodeIdsInLayer.length;
    const totalWidth = numNodes * NODE_WIDTH + (numNodes - 1) * H_GAP;
    const startX = -totalWidth / 2 + NODE_WIDTH / 2; // Center layer horizontally

    nodeIdsInLayer.forEach((nodeId, i) => {
      const node = nodesMap.get(nodeId);
      node.x = startX + i * (NODE_WIDTH + H_GAP);
      node.y = currentY;
      positionedNodes.push(node);
    });
    currentY += NODE_HEIGHT + V_GAP;
  }
  return positionedNodes;
}
