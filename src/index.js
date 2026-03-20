import { createParser as _createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js";
import pkg from '../package.json' with { type: 'json' };
import {BUILTIN_GRAMMARS} from './build/build-parsers.js';

/**
 * Generates a mapping of language keys to esm.sh CDN URLs.
 * * @param {string[]} langs - Array of language keys (e.g., ["javascript", "typescript"])
 * @param {string} version - The version string (e.g., "1.0.4")
 * @param {string} repoName - The GitHub repository name (e.g., "jeff-hykin/common_tree_sitter_languages")
 * @returns {Object} - Mapping of { lang: cdnUrl }
 */
function generateCdnMap(langs, version, repoName) {
  const baseUrl = `https://esm.sh/gh/${repoName}@${version}`;
  
  return langs.reduce((acc, lang) => {
    // Constructing the path to the generated JS files in the /main directory
    acc[lang] = `${baseUrl}/dist/${lang}.min.js`;
    return acc;
  }, {});
}


 
const repo = `MarketingPipeline/${pkg.name}`;

const _languages = BUILTIN_GRAMMARS.map(g => g.lang);


export const languages = generateCdnMap(_languages, pkg.version, repo);

 

function toAcornStyle(node, parent = null, path = []) {
  const currentPath = [...path, node.type]; // Add current node type to the breadcrumb

  const result = {
    type: node.type,
    start: node.startIndex,
    end: node.endIndex,
    parent: parent,
    path: currentPath, // e.g., ["source_file", "function_declaration", "block", "string_literal"]
  };

  if (node.childCount === 0) {
    result.text = node.text;
  } else {
    // Pass the current node as parent and the currentPath as the base for children
    result.body = node.children.map(child => 
      toAcornStyle(child, result, currentPath)
    );
  }
  return result;
}


export function generateCode(node, source, edits = new Map()) {
  if (edits.has(node)) return edits.get(node);

  // Leaf node — return its original text verbatim
  if (!node.body) return node.text ?? "";

  // Inner node — interleave children with the whitespace that lived between
  // them in the original source (gaps between sibling start/end offsets).
  let out    = "";
  let cursor = node.start;
  for (const child of node.body) {
    out   += source.slice(cursor, child.start);   // whitespace gap
    out   += generateCode(child, source, edits);
    cursor = child.end;
  }
  out += source.slice(cursor, node.end);           // any trailing content
  return out;
}

export function walk(node, visitors) {
  // Pass node and node.parent to the visitor function
  visitors[node.type]?.(node, node.parent);
  
  // Also support a catch-all visitor if you want
  visitors._default?.(node, node.parent);

  node.body?.forEach(child => walk(child, visitors));
}

export function walkWithCursor(node, visitors) {
  const cursor = node.walk();
  let reachedRoot = false;

  while (!reachedRoot) {
    // 1. Enter: Call the visitor for the current node
    visitors[cursor.nodeType]?.(cursor.currentNode);

    // 2. Move Depth-First
    if (cursor.gotoFirstChild()) {
      continue;
    }

    // 3. Move Sibling or Back up
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) {
        reachedRoot = true;
        break;
      }
    }
  }
}

export async function createParser(Grammar) {
  const parser = await _createParser(Grammar);

  // Bind the original method so it keeps its context (this)
  const originalParse = parser.parse.bind(parser);

  parser.parse = function(code, ...args) {
    // Standard Tree-sitter parse returns a Tree object
    const tree = originalParse(code, ...args);
    
    // Transform the resulting Tree/AST to Acorn style
    return toAcornStyle(tree.rootNode, null, []);
  };

  return parser;
}


