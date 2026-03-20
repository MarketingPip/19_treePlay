// src/index.js
import { createParser as _createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js";
function toAcornStyle(node) {
  const result = {
    type: node.type,
    start: node.startIndex,
    end: node.endIndex
  };
  if (node.childCount === 0) {
    result.text = node.text;
  } else {
    result.body = node.children.map((child) => toAcornStyle(child));
  }
  return result;
}
function generateCode(node, source, edits = /* @__PURE__ */ new Map()) {
  if (edits.has(node))
    return edits.get(node);
  if (!node.body)
    return node.text ?? "";
  let out = "";
  let cursor = node.start;
  for (const child of node.body) {
    out += source.slice(cursor, child.start);
    out += generateCode(child, source, edits);
    cursor = child.end;
  }
  out += source.slice(cursor, node.end);
  return out;
}
function walk(node, visitors) {
  visitors[node.type]?.(node);
  node.body?.forEach((child) => walk(child, visitors));
}
async function createParser(Grammar) {
  const parser = await _createParser(Grammar);
  const originalParse = parser.parse.bind(parser);
  parser.parse = function(code, ...args) {
    const tree = originalParse(code, ...args);
    return toAcornStyle(tree.rootNode);
  };
  return parser;
}
export {
  createParser,
  generateCode,
  walk
};
//# sourceMappingURL=index.js.map
