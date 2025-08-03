// render/sequence.js
import {
  createSVGElement,
  createText,
  createPath,
  measureText,
  wrapText,
  createCommonDefs,
} from "./svg.js";

const PARTICIPANT_WIDTH = 120;
const PARTICIPANT_HEIGHT = 40;
const LIFELINE_Y_START = 80;
const MESSAGE_HEIGHT = 60; // Vertical space for each message
const HORIZONTAL_MARGIN = 50; // Margin from the edges of the SVG
const LIFELINE_OFFSET = 20; // How far the lifeline goes below the last message
const FONT_SIZE = 14;
const FONT_FAMILY = "sans-serif"; // Must match CSS

export function renderSequence(data, svgContainer) {
  if (!data.participants || !data.messages) {
    return {
      success: false,
      error: "Invalid sequence data: missing participants or messages",
    };
  }

  svgContainer.innerHTML = "";
  createCommonDefs(svgContainer);

  const participants = data.participants;
  const messages = data.messages;

  const numParticipants = participants.length;
  if (numParticipants === 0) {
    return { success: true, svgElement: svgContainer, viewBox: "0 0 100 100" };
  }

  // Calculate total width needed
  const participantSpacing = Math.max(
    PARTICIPANT_WIDTH + 80,
    (numParticipants > 1 ? 500 : 0) / (numParticipants - 1 || 1)
  );
  const totalContentWidth =
    numParticipants * PARTICIPANT_WIDTH +
    (numParticipants - 1) * participantSpacing;
  const svgWidth = totalContentWidth + HORIZONTAL_MARGIN * 2;

  // Calculate participant X positions
  const participantX = new Map();
  let currentX = HORIZONTAL_MARGIN + PARTICIPANT_WIDTH / 2; // Start from left margin
  for (let i = 0; i < numParticipants; i++) {
    participantX.set(participants[i], { __lifelineEl: null, x: currentX });
    currentX += PARTICIPANT_WIDTH + participantSpacing;
  }

  let currentY = LIFELINE_Y_START;
  let maxMessageY = LIFELINE_Y_START;

  // Draw participants and lifelines
  participants.forEach((p) => {
    const x = participantX.get(p).x;
    // Participant header (rounded rectangle)
    svgContainer.appendChild(
      createSVGElement("rect", {
        x: x - PARTICIPANT_WIDTH / 2,
        y: 10,
        width: PARTICIPANT_WIDTH,
        height: PARTICIPANT_HEIGHT,
        rx: 8,
        ry: 8,
        className: "participant-header",
      })
    );
    // Participant name text
    const wrappedLines = wrapText(
      p,
      PARTICIPANT_WIDTH - 20,
      FONT_SIZE,
      FONT_FAMILY
    );
    const textY =
      10 +
      PARTICIPANT_HEIGHT / 2 -
      ((wrappedLines.length - 1) * FONT_SIZE * 0.6) / 2;
    svgContainer.appendChild(
      createText(
        p,
        x,
        textY,
        {
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": FONT_SIZE,
          "font-family": FONT_FAMILY,
        },
        wrappedLines
      )
    );

    // Lifeline (will extend later based on messages)
    // Store lifeline element to extend its height later
    const lifeline = createSVGElement("line", {
      x1: x,
      y1: LIFELINE_Y_START,
      x2: x,
      y2: LIFELINE_Y_START, // Initial y2, will be updated
      className: "lifeline",
    });
    svgContainer.appendChild(lifeline);
    participantX.get(p).__lifelineEl = lifeline; // Store reference
  });

  // Draw messages
  messages.forEach((msg) => {
    const fromX = participantX.get(msg.from).x;
    const toX = participantX.get(msg.to).x;

    if (!fromX || !toX) {
      console.warn(
        `Participant not found for message: ${msg.from} -> ${msg.to}`
      );
      return;
    }

    currentY += MESSAGE_HEIGHT; // Increment Y for each new message

    const isReply = msg.text.match(/^\d{3}\s/); // Check if text starts with 3 digits and a space (e.g., "200 OK")
    const marker = isReply ? "url(#replyArrowhead)" : "url(#arrowhead)";
    const className = `message-line ${isReply ? "reply" : ""}`;

    const pathData = `M ${fromX},${currentY} L ${toX},${currentY}`;
    svgContainer.appendChild(
      createPath(pathData, {
        className: className,
        "marker-end": marker,
      })
    );

    // Message label
    const labelX = (fromX + toX) / 2;
    const labelY = currentY - 8; // Slightly above the arrow

    const textWidthEstimate = Math.abs(fromX - toX) - 20; // Max width for message text
    const wrappedLines = wrapText(
      msg.text,
      textWidthEstimate,
      FONT_SIZE * 0.85,
      FONT_FAMILY
    );
    svgContainer.appendChild(
      createText(
        msg.text,
        labelX,
        labelY,
        {
          className: "message-label",
          "text-anchor": "middle",
          "dominant-baseline": "auto", // Default baseline is fine for single line, tspan handles multiline
          "font-size": FONT_SIZE * 0.85,
          "font-family": FONT_FAMILY,
        },
        wrappedLines
      )
    );

    maxMessageY = Math.max(maxMessageY, currentY);
  });

  // Extend lifelines to the lowest message Y plus offset
  participants.forEach((p) => {
    const lifelineEl = participantX.get(p).__lifelineEl;
    if (lifelineEl) {
      lifelineEl.setAttribute("y2", maxMessageY + LIFELINE_OFFSET);
    }
  });

  const svgHeight = maxMessageY + LIFELINE_OFFSET + 30; // Additional padding at bottom

  const viewBox = `0 0 ${svgWidth} ${svgHeight}`;

  return { success: true, svgElement: svgContainer, viewBox };
}
