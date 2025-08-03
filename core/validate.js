// core/validate.js
export const validate = {
  /**
   * Checks for basic JSON parsing errors.
   * @param {string} jsonString
   * @returns {Array<object>} List of error objects if parsing fails.
   */
  getParseErrors(jsonString) {
    try {
      JSON.parse(jsonString);
      return [];
    } catch (e) {
      // Attempt to extract position for better error reporting
      const msg = e.message;
      const match = msg.match(/at position (\d+)/);
      let index = 0;
      if (match && match[1]) {
        index = parseInt(match[1], 10);
      }
      return [{ message: `JSON Parse Error: ${msg}`, index: index }];
    }
  },

  /**
   * Validates the structure and content of the diagram JSON.
   * @param {object} data - The parsed JSON object.
   * @param {string} jsonString - The original JSON string for error indexing.
   * @returns {Array<object>} List of error objects.
   */
  validate(data, jsonString) {
    const errors = [];
    const getIndex = (path) => {
      // Basic approximation: find path in string. Not robust for complex paths or duplicates.
      try {
        // For simplicity, we just find the first occurrence of the path key
        // A full JSON pointer to char index would be very complex.
        // For now, we'll return 0 or a very rough estimate.
        const pathStr = JSON.stringify(path.slice(0, 1)); // Just use first segment for basic indexing
        return jsonString.indexOf(pathStr) !== -1
          ? jsonString.indexOf(pathStr)
          : 0;
      } catch (e) {
        return 0;
      }
    };

    if (typeof data !== "object" || data === null) {
      errors.push({ message: "Root must be an object.", index: getIndex([]) });
      return errors;
    }

    if (!data.type) {
      errors.push({
        message: 'Missing "type" property.',
        index: getIndex(["type"]),
      });
      return errors;
    }

    const validTypes = ["flowchart", "sequence", "erd"];
    if (!validTypes.includes(data.type)) {
      errors.push({
        message: `Invalid diagram type: "${
          data.type
        }". Must be one of: ${validTypes.join(", ")}.`,
        index: getIndex(["type"]),
      });
      return errors;
    }

    switch (data.type) {
      case "flowchart":
        this._validateFlowchart(data, errors, getIndex);
        break;
      case "sequence":
        this._validateSequence(data, errors, getIndex);
        break;
      case "erd":
        this._validateERD(data, errors, getIndex);
        break;
    }

    return errors;
  },

  // --- Internal Validation Functions ---

  _validateFlowchart(data, errors, getIndex) {
    const nodeIds = new Set();
    if (!Array.isArray(data.nodes)) {
      errors.push({
        message: 'Flowchart "nodes" must be an array.',
        index: getIndex(["nodes"]),
      });
      return;
    }
    data.nodes.forEach((node, i) => {
      if (typeof node !== "object" || node === null) {
        errors.push({
          message: `Node at index ${i} must be an object.`,
          index: getIndex(["nodes", i]),
        });
        return;
      }
      if (typeof node.id !== "string" || !node.id.trim()) {
        errors.push({
          message: `Node at index ${i} must have a non-empty string "id".`,
          index: getIndex(["nodes", i, "id"]),
        });
      }
      if (nodeIds.has(node.id)) {
        errors.push({
          message: `Duplicate node ID: "${node.id}".`,
          index: getIndex(["nodes", i, "id"]),
        });
      }
      nodeIds.add(node.id);
      if (typeof node.label !== "string" || !node.label.trim()) {
        errors.push({
          message: `Node "${node.id}" must have a non-empty string "label".`,
          index: getIndex(["nodes", i, "label"]),
        });
      }
    });

    if (!Array.isArray(data.edges)) {
      errors.push({
        message: 'Flowchart "edges" must be an array.',
        index: getIndex(["edges"]),
      });
      return;
    }
    data.edges.forEach((edge, i) => {
      if (typeof edge !== "object" || edge === null) {
        errors.push({
          message: `Edge at index ${i} must be an object.`,
          index: getIndex(["edges", i]),
        });
        return;
      }
      if (typeof edge.from !== "string" || !nodeIds.has(edge.from)) {
        errors.push({
          message: `Edge at index ${i} "from" node "${edge.from}" not found.`,
          index: getIndex(["edges", i, "from"]),
        });
      }
      if (typeof edge.to !== "string" || !nodeIds.has(edge.to)) {
        errors.push({
          message: `Edge at index ${i} "to" node "${edge.to}" not found.`,
          index: getIndex(["edges", i, "to"]),
        });
      }
      if (edge.from === edge.to) {
        errors.push({
          message: `Edge at index ${i} forms a self-loop (${edge.from} to ${edge.to}). Self-loops are not allowed.`,
          index: getIndex(["edges", i]),
        });
      }
      if (edge.label && typeof edge.label !== "string") {
        errors.push({
          message: `Edge at index ${i} "label" must be a string.`,
          index: getIndex(["edges", i, "label"]),
        });
      }
    });

    const validDirections = ["TD", "TB", "LR", "RL"]; // TD=TB
    if (
      data.direction &&
      !validDirections.includes(data.direction.toUpperCase())
    ) {
      errors.push({
        message: `Flowchart "direction" must be one of: ${validDirections.join(
          ", "
        )}.`,
        index: getIndex(["direction"]),
      });
    }
  },

  _validateSequence(data, errors, getIndex) {
    const participantNames = new Set();
    if (!Array.isArray(data.participants)) {
      errors.push({
        message: 'Sequence "participants" must be an array.',
        index: getIndex(["participants"]),
      });
      return;
    }
    data.participants.forEach((p, i) => {
      if (typeof p !== "string" || !p.trim()) {
        errors.push({
          message: `Participant at index ${i} must be a non-empty string.`,
          index: getIndex(["participants", i]),
        });
      }
      if (participantNames.has(p)) {
        errors.push({
          message: `Duplicate participant name: "${p}".`,
          index: getIndex(["participants", i]),
        });
      }
      participantNames.add(p);
    });

    if (!Array.isArray(data.messages)) {
      errors.push({
        message: 'Sequence "messages" must be an array.',
        index: getIndex(["messages"]),
      });
      return;
    }
    data.messages.forEach((msg, i) => {
      if (typeof msg !== "object" || msg === null) {
        errors.push({
          message: `Message at index ${i} must be an object.`,
          index: getIndex(["messages", i]),
        });
        return;
      }
      if (typeof msg.from !== "string" || !participantNames.has(msg.from)) {
        errors.push({
          message: `Message at index ${i} "from" participant "${msg.from}" not found.`,
          index: getIndex(["messages", i, "from"]),
        });
      }
      if (typeof msg.to !== "string" || !participantNames.has(msg.to)) {
        errors.push({
          message: `Message at index ${i} "to" participant "${msg.to}" not found.`,
          index: getIndex(["messages", i, "to"]),
        });
      }
      if (typeof msg.text !== "string" || !msg.text.trim()) {
        errors.push({
          message: `Message at index ${i} must have a non-empty string "text".`,
          index: getIndex(["messages", i, "text"]),
        });
      }
    });
  },

  _validateERD(data, errors, getIndex) {
    const entityNames = new Set();
    const entityAttributes = new Map(); // Store {entityName: Set<attributeName>}

    if (!Array.isArray(data.entities)) {
      errors.push({
        message: 'ERD "entities" must be an array.',
        index: getIndex(["entities"]),
      });
      return;
    }

    data.entities.forEach((entity, i) => {
      if (typeof entity !== "object" || entity === null) {
        errors.push({
          message: `Entity at index ${i} must be an object.`,
          index: getIndex(["entities", i]),
        });
        return;
      }
      if (typeof entity.name !== "string" || !entity.name.trim()) {
        errors.push({
          message: `Entity at index ${i} must have a non-empty string "name".`,
          index: getIndex(["entities", i, "name"]),
        });
      }
      if (entityNames.has(entity.name)) {
        errors.push({
          message: `Duplicate entity name: "${entity.name}".`,
          index: getIndex(["entities", i, "name"]),
        });
      }
      entityNames.add(entity.name);
      entityAttributes.set(entity.name, new Set());

      if (!Array.isArray(entity.attributes)) {
        errors.push({
          message: `Entity "${entity.name}" "attributes" must be an array.`,
          index: getIndex(["entities", i, "attributes"]),
        });
        return;
      }

      let hasPk = false;
      entity.attributes.forEach((attr, j) => {
        if (typeof attr !== "object" || attr === null) {
          errors.push({
            message: `Attribute at entity "${entity.name}" index ${j} must be an object.`,
            index: getIndex(["entities", i, "attributes", j]),
          });
          return;
        }
        if (typeof attr.name !== "string" || !attr.name.trim()) {
          errors.push({
            message: `Attribute at entity "${entity.name}" index ${j} must have a non-empty string "name".`,
            index: getIndex(["entities", i, "attributes", j, "name"]),
          });
        }
        if (entityAttributes.get(entity.name).has(attr.name)) {
          errors.push({
            message: `Duplicate attribute name "${attr.name}" in entity "${entity.name}".`,
            index: getIndex(["entities", i, "attributes", j, "name"]),
          });
        }
        entityAttributes.get(entity.name).add(attr.name);

        if (typeof attr.type !== "string" || !attr.type.trim()) {
          errors.push({
            message: `Attribute "${attr.name}" in "${entity.name}" must have a non-empty string "type".`,
            index: getIndex(["entities", i, "attributes", j, "type"]),
          });
        }
        if (attr.pk === true) {
          hasPk = true;
        }
        if (attr.fk) {
          if (typeof attr.fk !== "string" || !attr.fk.includes(".")) {
            errors.push({
              message: `Foreign key "${attr.fk}" in "${entity.name}.${attr.name}" must be in "Entity.Attribute" format.`,
              index: getIndex(["entities", i, "attributes", j, "fk"]),
            });
          } else {
            const [fkEntity, fkAttr] = attr.fk.split(".");
            if (!entityNames.has(fkEntity)) {
              errors.push({
                message: `Foreign key entity "${fkEntity}" for "${entity.name}.${attr.name}" not found.`,
                index: getIndex(["entities", i, "attributes", j, "fk"]),
              });
            } else if (!entityAttributes.get(fkEntity).has(fkAttr)) {
              errors.push({
                message: `Foreign key attribute "${fkAttr}" in entity "${fkEntity}" for "${entity.name}.${attr.name}" not found.`,
                index: getIndex(["entities", i, "attributes", j, "fk"]),
              });
            }
          }
        }
        if (attr.unique && typeof attr.unique !== "boolean") {
          errors.push({
            message: `Attribute "${attr.name}" in "${entity.name}" "unique" must be a boolean.`,
            index: getIndex(["entities", i, "attributes", j, "unique"]),
          });
        }
      });
      if (!hasPk && entity.attributes.length > 0) {
        // Only require PK if attributes exist
        errors.push({
          message: `Entity "${entity.name}" must have at least one primary key (pk: true).`,
          index: getIndex(["entities", i]),
        });
      }
    });

    if (!Array.isArray(data.relationships)) {
      errors.push({
        message: 'ERD "relationships" must be an array.',
        index: getIndex(["relationships"]),
      });
      return;
    }

    const validCardinalities = ["0..1", "1..1", "1..*", "0..*", "*..*"];
    data.relationships.forEach((rel, i) => {
      if (typeof rel !== "object" || rel === null) {
        errors.push({
          message: `Relationship at index ${i} must be an object.`,
          index: getIndex(["relationships", i]),
        });
        return;
      }
      if (typeof rel.from !== "string" || !entityNames.has(rel.from)) {
        errors.push({
          message: `Relationship at index ${i} "from" entity "${rel.from}" not found.`,
          index: getIndex(["relationships", i, "from"]),
        });
      }
      if (typeof rel.to !== "string" || !entityNames.has(rel.to)) {
        errors.push({
          message: `Relationship at index ${i} "to" entity "${rel.to}" not found.`,
          index: getIndex(["relationships", i, "to"]),
        });
      }
      if (
        typeof rel.cardinality !== "string" ||
        !validCardinalities.includes(rel.cardinality)
      ) {
        errors.push({
          message: `Relationship at index ${i} "cardinality" must be one of: ${validCardinalities.join(
            ", "
          )}.`,
          index: getIndex(["relationships", i, "cardinality"]),
        });
      }
    });
  },
};
