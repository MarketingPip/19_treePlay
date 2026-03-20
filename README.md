# 🌳 tree-morph.js

A lightweight, pure JavaScript library to parse, traverse, and transform source code into an Acorn-style AST — for any language supported by Tree-sitter.

`tree-morph.js` leverages Tree-sitter via WebAssembly to produce a lossless syntax tree with exact byte offsets, so you can modify and regenerate source code without losing formatting, comments, or indentation.


## ✨ Features

- **Pure JS/ESM** — Works in the browser, Node.js, and Deno via `esm.sh`.
- **Any language** — Rust, TypeScript, Python, C, HTML, CSS, JSON, YAML, TOML, Nix, Bash, and more.
- **Acorn-style AST** — Transforms Tree-sitter's CST into simplified, walkable JSON objects with a familiar `{ type, start, end, body }` shape.


## 🚀 Quick Start

```js
import { createParser } from './tree-morph.js';
import rustGrammar from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/rust.js';
import MagicString from 'https://esm.sh/magic-string';

const code = `fn main() { let x = "Hello"; }`;

// 1. Initialize and parse
const parser = await createParser(rustGrammar);
const ast = parser.toAst(code);
const ms = new MagicString(code);

// 2. Walk and overwrite
parser.walk(ast, {
  string_literal(node) {
    ms.overwrite(node.start, node.end, '"Hello from tree-morph.js!"');
  }
});

// 3. Regenerate
console.log(ms.toString());
// → fn main() { let x = "Hello from tree-morph.js!"; }
```



## 🌐 Supported Languages

All grammars are available via `esm.sh` with no install required:

```js
import rust       from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/rust.js';
import typescript from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/typescript.js';
import tsx        from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/tsx.js';
import javascript from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/javascript.js';
import python     from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/python.js';
import c          from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/c.js';
import cpp        from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/cpp.js';
import html       from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/html.js';
import css        from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/css.js';
import json       from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/json.js';
import yaml       from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/yaml.js';
import toml       from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/toml.js';
import bash       from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/bash.js';
import nix        from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/nix.js';
import wat        from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/wat.js';
import wast       from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/wast.js';
import gitignore  from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/gitignore.js';
```

Pass any grammar to `createParser()` — the API is identical regardless of language.


## 🛠 API Reference

### `createParser(grammar)` → `Promise<Parser>`

Loads the Tree-sitter WASM runtime with the given grammar. Must be awaited before calling any other method.

---

### `parser.toAst(code)` → `AstNode`

Parses source code and returns a plain, JSON-serializable AST. Each node contains:

| Field  | Description |
|--------|-------------|
| `type` | Tree-sitter node type, e.g. `let_declaration`, `function_definition` |
| `start` | Byte offset of the node's start in the original source |
| `end`  | Byte offset of the node's end in the original source |
| `text` | Leaf nodes only — the exact source text of this token |
| `body` | Inner nodes only — array of all child nodes, including punctuation |

---

### `parser.walk(ast, visitors)`

Recursively visits every node in the AST. `visitors` is an object whose keys are node type strings and values are callbacks:

```js
parser.walk(ast, {
  function_definition(node) {
    const name = node.body?.find(n => n.type === 'identifier');
    console.log('Found function:', name?.text);
  }
});
```

---

### `parser.generate(ast, originalSource, edits?)` → `string`

Reconstructs the source string from the AST. Whitespace and formatting are recovered from the byte-offset gaps between sibling nodes in `originalSource`.

`edits` is an optional `Map<AstNode, string>` of substitutions. When a node is present in the map its replacement string is used instead of the original source slice. Node references come from the same `ast` object passed to `walk` — they are not JSON-serializable.

> For most use cases, prefer `magic-string` over `parser.generate()`. See the FAQ below.

---

## 📦 Installation

### Via ESM (browser / Deno — no install required)

```js
import { createParser } from 'https://esm.sh/gh/your-user/tree-morph.js/main/tree-morph.js';
```

### Via npm (Node.js)

```sh
npm install tree-morph.js
```

```js
import { createParser } from 'tree-morph.js';
```



## ❓ FAQ

### Can I use `magic-string` instead of `parser.generate()`?

Yes, and it's often the better choice. `magic-string` gives you the same lossless output with less boilerplate, plus a free source map linking transformed positions back to the original source.

```js
import { createParser } from './tree-morph.js';
import rustGrammar from 'https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/rust.js';
import MagicString from 'https://esm.sh/magic-string';

const code = `
use std::collections::HashMap;
use std::io::{Read, Write};

fn main() {
    let message = "Hello JS";
    println!("{}", message);
}
`;

const parser = await createParser(rustGrammar);
const ast = parser.toAst(code);
const ms = new MagicString(code);

parser.walk(ast, {
  // Rename a crate across all use declarations
  use_declaration(node) {
    const original = code.slice(node.start, node.end);
    ms.overwrite(node.start, node.end, original.replace(/\bstd\b/g, 'no_std_compat'));
  },
  // Replace a string literal
  string_literal(node) {
    ms.overwrite(node.start, node.end, '"Hello Deno"');
  }
});

console.log(ms.toString());
// → use no_std_compat::collections::HashMap; ...

// Source map (output positions → original positions)
const map = ms.generateMap({ hires: true });
```

Use `parser.generate()` when you need multiple independent edit passes on the same AST. Use `magic-string` when you want source maps or prefer its chainable API.


## 🤝 Contributing

This project is in early development, inspired by the ergonomics of `jscodeshift` — the goal is to make scripting code refactors across any language as approachable as JS codemods. Contributions and feedback welcome.
