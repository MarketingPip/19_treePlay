import { createParser as _createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js";
import pkg from '../package.json' with { type: 'json' };
import languages from './build/languages.json' with { type: 'json' };

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

const cdnUrls = generateCdnMap(languages, pkg.version, repo);

function toAcornStyle(node) {
  const result = {
    type:  node.type,
    start: node.startIndex,
    end:   node.endIndex,
  };
  if (node.childCount === 0) {
    result.text = node.text;
  } else {
    result.body = node.children.map(child => toAcornStyle(child));
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
  visitors[node.type]?.(node);
  node.body?.forEach(child => walk(child, visitors));
}



export async function createParser(Grammar) {
  const parser = await _createParser(Grammar);

  // Bind the original method so it keeps its context (this)
  const originalParse = parser.parse.bind(parser);

  parser.parse = function(code, ...args) {
    // Standard Tree-sitter parse returns a Tree object
    const tree = originalParse(code, ...args);
    
    // Transform the resulting Tree/AST to Acorn style
    return toAcornStyle(tree.rootNode);
  };

  return parser;
}
