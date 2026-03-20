#!/usr/bin/env node
/**
 * build-parsers.js
 *
 * Builds tree-sitter WASM parsers and emits self-decoding ES modules
 * into ./main/<lang>.js
 *
 * Sources (in priority order per grammar):
 *   1. npm package  — grabbed via npm install, uses pre-built .wasm if present
 *   2. git URL      — cloned and built with `tree-sitter build --wasm`
 *
 * Usage:
 *   node build-parsers.js [--force] [lang1 lang2 ...]
 *   node build-parsers.js --extra path/to/grammars.json [--force] [lang1 ...]
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WASM_INCOMPATIBLE_MSG = "isn't available to Wasm parsers"

// ─── Built-in grammar registry ───────────────────────────────────────────────
// Each entry: { lang, npm?, gh? }
// npm takes priority over gh when both are present.
// gh is a GitHub (or any git) URL — cloned and built with tree-sitter build --wasm.
const BUILTIN_GRAMMARS = [
  { lang: "ada",                npm: "tree-sitter-ada",                         gh: "https://github.com/briot/tree-sitter-ada"                        },
  { lang: "agda",                                                                gh: "https://github.com/tree-sitter/tree-sitter-agda"                 },
  { lang: "angular",                                                             gh: "https://github.com/dlvandenberg/tree-sitter-angular"             },
  { lang: "asm",                                                                 gh: "https://github.com/RubixDev/tree-sitter-asm"                     },
  { lang: "astro",                                                               gh: "https://github.com/virchau13/tree-sitter-astro"                  },
  { lang: "awk",                                                                 gh: "https://github.com/Beaglefoot/tree-sitter-awk"                   },
  { lang: "bash",               npm: "tree-sitter-bash",                        gh: "https://github.com/tree-sitter/tree-sitter-bash"                 },
  { lang: "beancount",                                                           gh: "https://github.com/polarmutex/tree-sitter-beancount"             },
  { lang: "bicep",                                                               gh: "https://github.com/amaanq/tree-sitter-bicep"                     },
  { lang: "c",                  npm: "tree-sitter-c",                           gh: "https://github.com/tree-sitter/tree-sitter-c"                    },
  { lang: "c-sharp",            npm: "tree-sitter-c-sharp",                     gh: "https://github.com/tree-sitter/tree-sitter-c-sharp"              },
  { lang: "cairo",                                                               gh: "https://github.com/amaanq/tree-sitter-cairo"                     },
  { lang: "clojure",                                                             gh: "https://github.com/sogaiu/tree-sitter-clojure"                   },
  { lang: "cmake",                                                               gh: "https://github.com/uyha/tree-sitter-cmake"                       },
  { lang: "commonlisp",                                                          gh: "https://github.com/theHamsta/tree-sitter-commonlisp"             },
  { lang: "cpp",                npm: "tree-sitter-cpp",                         gh: "https://github.com/tree-sitter/tree-sitter-cpp"                  },
  { lang: "css",                npm: "tree-sitter-css",                         gh: "https://github.com/tree-sitter/tree-sitter-css"                  },
  { lang: "cuda",                                                                gh: "https://github.com/theHamsta/tree-sitter-cuda"                   },
  { lang: "d",                                                                   gh: "https://github.com/gdamore/tree-sitter-d"                        },
  { lang: "dart",                                                                gh: "https://github.com/UserNobody14/tree-sitter-dart"                },
  { lang: "devicetree",                                                          gh: "https://github.com/joelspadin/tree-sitter-devicetree"            },
  { lang: "diff",                                                                gh: "https://github.com/the-mikedavis/tree-sitter-diff"               },
  { lang: "dockerfile",                                                          gh: "https://github.com/camdencheek/tree-sitter-dockerfile"           },
  { lang: "dot",                                                                 gh: "https://github.com/rydesun/tree-sitter-dot"                      },
  { lang: "earthfile",                                                           gh: "https://github.com/glehmann/tree-sitter-earthfile"               },
  { lang: "elisp",              npm: "tree-sitter-elisp",                       gh: "https://github.com/Wilfred/tree-sitter-elisp"                    },
  { lang: "elixir",                                                              gh: "https://github.com/elixir-lang/tree-sitter-elixir"               },
  { lang: "elm",                                                                 gh: "https://github.com/elm-tooling/tree-sitter-elm"                  },
  { lang: "elvish",                                                              gh: "https://github.com/elves/tree-sitter-elvish"                     },
  { lang: "erlang",                                                              gh: "https://github.com/WhatsApp/tree-sitter-erlang"                  },
  { lang: "fennel",                                                              gh: "https://github.com/alexmozaidze/tree-sitter-fennel"              },
  { lang: "fish",                                                                gh: "https://github.com/ram02z/tree-sitter-fish"                      },
  { lang: "fortran",                                                             gh: "https://github.com/stadelmanma/tree-sitter-fortran"              },
  { lang: "gdscript",                                                            gh: "https://github.com/PrestonKnopp/tree-sitter-gdscript"            },
  { lang: "gleam",                                                               gh: "https://github.com/gleam-lang/tree-sitter-gleam"                 },
  { lang: "glsl",                                                                gh: "https://github.com/theHamsta/tree-sitter-glsl"                   },
  { lang: "go",                 npm: "tree-sitter-go",                          gh: "https://github.com/tree-sitter/tree-sitter-go"                   },
  { lang: "gomod",                                                               gh: "https://github.com/camdencheek/tree-sitter-go-mod"               },
  { lang: "graphql",                                                             gh: "https://github.com/bkegley/tree-sitter-graphql"                  },
  { lang: "groovy",                                                              gh: "https://github.com/murtaza64/tree-sitter-groovy"                 },
  { lang: "hack",                                                                gh: "https://github.com/slackhq/tree-sitter-hack"                     },
  { lang: "haskell",            npm: "tree-sitter-haskell",                     gh: "https://github.com/tree-sitter/tree-sitter-haskell"              },
  { lang: "hcl",                                                                 gh: "https://github.com/MichaHoffmann/tree-sitter-hcl"               },
  { lang: "heex",                                                                gh: "https://github.com/connorlay/tree-sitter-heex"                   },
  { lang: "hjson",                                                               gh: "https://github.com/winston0410/tree-sitter-hjson"                },
  { lang: "hlsl",                                                                gh: "https://github.com/theHamsta/tree-sitter-hlsl"                   },
  { lang: "html",               npm: "tree-sitter-html",                        gh: "https://github.com/tree-sitter/tree-sitter-html"                 },
  { lang: "http",                                                                gh: "https://github.com/rest-nvim/tree-sitter-http"                   },
  { lang: "java",               npm: "tree-sitter-java",                        gh: "https://github.com/tree-sitter/tree-sitter-java"                 },
  { lang: "javascript",         npm: "tree-sitter-javascript",                  gh: "https://github.com/tree-sitter/tree-sitter-javascript"           },
  { lang: "jq",                                                                  gh: "https://github.com/flurie/tree-sitter-jq"                        },
  { lang: "json",               npm: "tree-sitter-json",                        gh: "https://github.com/tree-sitter/tree-sitter-json"                 },
  { lang: "json5",                                                               gh: "https://github.com/Joakker/tree-sitter-json5"                    },
  { lang: "jsonnet",                                                             gh: "https://github.com/sourcegraph/tree-sitter-jsonnet"              },
  { lang: "julia",              npm: "tree-sitter-julia",                       gh: "https://github.com/tree-sitter/tree-sitter-julia"                },
  { lang: "just",                                                                gh: "https://github.com/IndianBoy42/tree-sitter-just"                 },
  { lang: "kdl",                                                                 gh: "https://github.com/amaanq/tree-sitter-kdl"                       },
  { lang: "kotlin",             npm: "tree-sitter-kotlin",                      gh: "https://github.com/fwcd/tree-sitter-kotlin"                      },
  { lang: "latex",                                                               gh: "https://github.com/latex-lsp/tree-sitter-latex"                  },
  { lang: "ledger",                                                              gh: "https://github.com/cbarrete/tree-sitter-ledger"                  },
  { lang: "liquid",                                                              gh: "https://github.com/hankthetank27/tree-sitter-liquid"             },
  { lang: "llvm",                                                                gh: "https://github.com/benwilliamgraham/tree-sitter-llvm"            },
  { lang: "lua",                npm: "tree-sitter-lua",                         gh: "https://github.com/MunifTanjim/tree-sitter-lua"                  },
  { lang: "make",                                                                gh: "https://github.com/alemuller/tree-sitter-make"                   },
  { lang: "markdown",                                                            gh: "https://github.com/MDeiml/tree-sitter-markdown"                  },
  { lang: "matlab",                                                              gh: "https://github.com/acristoffers/tree-sitter-matlab"              },
  { lang: "meson",                                                               gh: "https://github.com/Decodetalkers/tree-sitter-meson"              },
  { lang: "nim",                                                                 gh: "https://github.com/alaviss/tree-sitter-nim"                      },
  { lang: "ninja",                                                               gh: "https://github.com/alemuller/tree-sitter-ninja"                  },
  { lang: "nix",                npm: "tree-sitter-nix",                         gh: "https://github.com/cstrahan/tree-sitter-nix"                     },
  { lang: "ocaml",              npm: "tree-sitter-ocaml",                       gh: "https://github.com/tree-sitter/tree-sitter-ocaml"                },
  { lang: "odin",                                                                gh: "https://github.com/amaanq/tree-sitter-odin"                      },
  { lang: "org",                                                                 gh: "https://github.com/milisims/tree-sitter-org"                     },
  { lang: "pascal",                                                              gh: "https://github.com/Isopod/tree-sitter-pascal"                    },
  { lang: "perl",                                                                gh: "https://github.com/tree-sitter-perl/tree-sitter-perl"            },
  { lang: "php",                npm: "tree-sitter-php",                         gh: "https://github.com/tree-sitter/tree-sitter-php"                  },
  { lang: "prisma",                                                              gh: "https://github.com/victorhqc/tree-sitter-prisma"                 },
  { lang: "proto",                                                               gh: "https://github.com/treywood/tree-sitter-proto"                   },
  { lang: "python",             npm: "tree-sitter-python",                      gh: "https://github.com/tree-sitter/tree-sitter-python"               },
  { lang: "r",                  npm: "@davisvaughan/tree-sitter-r",             gh: "https://github.com/r-lib/tree-sitter-r"                          },
  { lang: "racket",                                                              gh: "https://github.com/6cdh/tree-sitter-racket"                      },
  { lang: "regex",                                                               gh: "https://github.com/tree-sitter/tree-sitter-regex"                },
  { lang: "rst",                                                                 gh: "https://github.com/stsewd/tree-sitter-rst"                       },
  { lang: "ruby",               npm: "tree-sitter-ruby",                        gh: "https://github.com/tree-sitter/tree-sitter-ruby"                 },
  { lang: "rust",               npm: "tree-sitter-rust",                        gh: "https://github.com/tree-sitter/tree-sitter-rust"                 },
  { lang: "scala",              npm: "tree-sitter-scala",                       gh: "https://github.com/tree-sitter/tree-sitter-scala"                },
  { lang: "scheme",                                                              gh: "https://github.com/6cdh/tree-sitter-scheme"                      },
  { lang: "scss",                                                                gh: "https://github.com/serenadeai/tree-sitter-scss"                  },
  { lang: "slint",                                                               gh: "https://github.com/slint-ui/tree-sitter-slint"                   },
  { lang: "smithy",                                                              gh: "https://github.com/indoorvivants/tree-sitter-smithy"             },
  { lang: "solidity",                                                            gh: "https://github.com/JoranHonig/tree-sitter-solidity"              },
  { lang: "sql",                npm: "tree-sitter-sql",                         gh: "https://github.com/derekstride/tree-sitter-sql"                  },
  { lang: "svelte",                                                              gh: "https://github.com/tree-sitter-grammars/tree-sitter-svelte"      },
  { lang: "swift",              npm: "tree-sitter-swift",                       gh: "https://github.com/alex-pinkus/tree-sitter-swift"                },
  { lang: "tcl",                                                                 gh: "https://github.com/tree-sitter-grammars/tree-sitter-tcl"         },
  { lang: "templ",                                                               gh: "https://github.com/vrischmann/tree-sitter-templ"                 },
  { lang: "terraform",                                                           gh: "https://github.com/MichaHoffmann/tree-sitter-hcl"               },
  { lang: "toml",               npm: "tree-sitter-toml",                        gh: "https://github.com/tree-sitter-grammars/tree-sitter-toml"        },
  { lang: "tsx",                npm: "tree-sitter-typescript",                  gh: "https://github.com/tree-sitter/tree-sitter-typescript"           },
  { lang: "turtle",                                                              gh: "https://github.com/BonaBeavis/tree-sitter-turtle"               },
  { lang: "twig",                                                                gh: "https://github.com/gbprod/tree-sitter-twig"                      },
  { lang: "typescript",         npm: "tree-sitter-typescript",                  gh: "https://github.com/tree-sitter/tree-sitter-typescript"           },
  { lang: "typst",                                                               gh: "https://github.com/uben0/tree-sitter-typst"                      },
  { lang: "unison",                                                              gh: "https://github.com/kylegoetz/tree-sitter-unison"                 },
  { lang: "vala",                                                                gh: "https://github.com/vala-lang/tree-sitter-vala"                   },
  { lang: "verilog",                                                             gh: "https://github.com/tree-sitter/tree-sitter-verilog"              },
  { lang: "vim",                                                                 gh: "https://github.com/neovim/tree-sitter-vim"                       },
  { lang: "vimdoc",                                                              gh: "https://github.com/neovim/tree-sitter-vimdoc"                    },
  { lang: "vue",                                                                 gh: "https://github.com/tree-sitter-grammars/tree-sitter-vue"         },
  { lang: "wgsl",                                                                gh: "https://github.com/szebniok/tree-sitter-wgsl"                    },
  { lang: "xml",                                                                 gh: "https://github.com/tree-sitter-grammars/tree-sitter-xml"         },
  { lang: "yaml",               npm: "@tree-sitter-grammars/tree-sitter-yaml",  gh: "https://github.com/tree-sitter-grammars/tree-sitter-yaml"        },
  { lang: "yang",                                                                gh: "https://github.com/Hubro/tree-sitter-yang"                       },
  { lang: "zig",                npm: "tree-sitter-zig",                         gh: "https://github.com/maxxnino/tree-sitter-zig"                     },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sh(cmd, cwd) {
  return spawnSync(cmd, { cwd, shell: true, stdio: "inherit" })
}

function gitHead(dir) {
  try { return execSync("git rev-parse HEAD", { cwd: dir }).toString().trim() }
  catch { return "main" }
}

function makeTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: prefix.replace(/-$/, ""), version: "0.0.0", private: true }, null, 2)
  )
  return dir
}

function findWasm(dir, hint) {
  const preferred = `tree-sitter-${hint}.wasm`
  let fallback = null
  function walk(d, depth = 0) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isFile()) {
        if (e.name === preferred)     return full
        if (e.name.endsWith(".wasm")) fallback = fallback ?? full
      } else if (e.isDirectory() && depth < 3 && e.name !== "node_modules") {
        const r = walk(full, depth + 1)
        if (r) return r
      }
    }
    return null
  }
  return walk(dir) ?? fallback
}

function emitJs(buf, lang) {
  const b64 = buf.toString("base64")
  return [
    `// Generated Tree-sitter WASM bundle — ${lang}`,
    `// Auto-generated by build-parsers.js — do not edit`,
    `const b64 = "${b64}";`,
    `const decode = typeof atob !== "undefined"`,
    `  ? (s) => atob(s)`,
    `  : (s) => Buffer.from(s, "base64").toString("binary");`,
    `const bytes = Uint8Array.from(decode(b64), c => c.charCodeAt(0));`,
    `export default bytes;`,
    `export { bytes };`,
    "",
  ].join("\n")
}

/** Clone a git URL into a temp dir and return the dir path */
function cloneGit(url) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-git-"))
  console.log(`  📥 Cloning ${url} …`)
  const res = sh(`git clone --depth 1 ${url} .`, dir)
  if (res.status !== 0) { fs.rmSync(dir, { recursive: true, force: true }); return null }
  return dir
}

/** Build wasm in a directory using the tree-sitter CLI binary */
function buildWasm(cliBin, buildDir, lang) {
  if (!cliBin) return null
  const res = spawnSync(cliBin, ["build", "--wasm"], {
    cwd: buildDir,
    stdio: ["inherit", "inherit", "pipe"],
  })
  const stderr = res.stderr?.toString() ?? ""
  if (stderr.includes(WASM_INCOMPATIBLE_MSG)) return null
  return findWasm(buildDir, lang)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rawArgs = process.argv.slice(2)
  const isForce = rawArgs.includes("--force")

  // --extra path/to/grammars.json
  const extraIdx = rawArgs.indexOf("--extra")
  let extraGrammars = {}
  if (extraIdx !== -1) {
    const extraFile = rawArgs[extraIdx + 1]
    if (!extraFile) { console.error("--extra requires a path argument"); process.exit(1) }
    extraGrammars = JSON.parse(fs.readFileSync(path.resolve(extraFile), "utf8"))
    // { lang: "git-url-or-npm" } — detect by whether value starts with "tree-sitter-" or looks like a URL/path
  }

  const filterArgs = rawArgs.filter((a, i) =>
    a !== "--force" && a !== "--extra" && rawArgs[extraIdx + 1] !== a
  )

  // Merge extra grammars into the registry
  // Extra format: { "lang": "https://github.com/..." } or { "lang": "npm-package-name" }
  const extraEntries = Object.entries(extraGrammars).map(([lang, src]) => {
    const isUrl  = src.startsWith("http://") || src.startsWith("https://") || src.startsWith("git@")
    const isPath = src.startsWith("/") || src.startsWith("./") || src.startsWith("C:/") || src.startsWith("C:\\")
    return isUrl || isPath
      ? { lang, gh: src }
      : { lang, npm: src }
  })

  // Build full registry: builtins first, extras fill in missing langs
  const builtinLangs = new Set(BUILTIN_GRAMMARS.map(g => g.lang))
  const allGrammars  = [
    ...BUILTIN_GRAMMARS,
    ...extraEntries.filter(g => !builtinLangs.has(g.lang)),
  ]

  let targets = filterArgs.length
    ? allGrammars.filter(g => filterArgs.includes(g.lang))
    : allGrammars

  if (!targets.length) {
    console.error("No matching grammars for:", filterArgs)
    process.exit(1)
  }

  const rootDir = process.cwd()
  const mainDir = path.join(rootDir, "main")
  if (!fs.existsSync(mainDir)) fs.mkdirSync(mainDir, { recursive: true })

  // ── Skip already-built langs ──────────────────────────────────────────────
  const results = { ok: [], builtFromSource: [], failed: [], skipped: [] }

  if (!isForce) {
    targets = targets.filter(g => {
      const outJs = path.join(mainDir, `${g.lang}.js`)
      if (fs.existsSync(outJs)) {
        results.skipped.push(g.lang)
        results.ok.push(g.lang)
        return false
      }
      return true
    })

    if (results.skipped.length) {
      console.log(`⏭️  Skipping ${results.skipped.length} already-built parser(s): ${results.skipped.join(", ")}`)
      console.log(`   (pass --force to rebuild)`)
    }

    if (!targets.length) {
      console.log("✅ All requested parsers are already built.")
      return
    }
  }

  // ── Split targets by source type ─────────────────────────────────────────
  const npmTargets = targets.filter(g => g.npm)
  const gitTargets = targets.filter(g => !g.npm && g.gh)

  const uniqueNpm = [...new Set(npmTargets.flatMap(g => [g.npm, ...(g.alts ?? [])]))]

  // ── Install tree-sitter-cli (needed for any source build) ─────────────────
  // We install it if there are git-only targets, or npm targets that may lack
  // pre-built wasm (we can't know ahead of time without inspecting the package).
  let cliBin = null
  let cliDir = null

  if (targets.length) {
    cliDir = makeTmp("ts-cli-")
    console.log(`\n🔧 Installing tree-sitter-cli …`)
    sh(`npm install --no-save tree-sitter-cli`, cliDir)
    const cliBinName = process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter"
    cliBin = path.join(cliDir, "node_modules", ".bin", cliBinName)
    if (!fs.existsSync(cliBin)) { console.warn("⚠️  tree-sitter-cli not found, source builds will fail"); cliBin = null }
  }

  // ── Install npm grammars ──────────────────────────────────────────────────
  let grammarDir = null

  if (npmTargets.length) {
    grammarDir = makeTmp("ts-grammars-")
    console.log(`📦 Installing ${uniqueNpm.length} npm grammar package(s) …\n`)
    const res = sh(
      `npm install --no-save --legacy-peer-deps --ignore-scripts ${uniqueNpm.join(" ")}`,
      grammarDir
    )
    if (res.status !== 0) { console.error("❌ grammar npm install failed"); process.exit(1) }
  }

  // ── Process npm-based targets ─────────────────────────────────────────────
  for (const { lang, npm, alts = [] } of npmTargets) {
    console.log(`${"─".repeat(60)}`)
    console.log(`🔍 Processing: ${lang} (npm: ${npm})`)

    const pkgDir  = path.join(grammarDir, "node_modules", npm)
    if (!fs.existsSync(pkgDir)) {
      results.failed.push({ lang, reason: "npm package dir missing" }); continue
    }

    // Find grammar subdir
    let buildDir = pkgDir
    if (!fs.existsSync(path.join(pkgDir, "grammar.js"))) {
      for (const sub of [lang, `tree-sitter-${lang}`, ...fs.readdirSync(pkgDir)]) {
        const candidate = path.join(pkgDir, sub)
        if (fs.existsSync(path.join(candidate, "grammar.js"))) { buildDir = candidate; break }
      }
    }

    let wasmPath = findWasm(buildDir, lang) || findWasm(pkgDir, lang)

    if (!wasmPath) {
      console.log(`  ⚙️  No pre-built wasm, building from source …`)
      wasmPath = buildWasm(cliBin, buildDir, lang)
      // If npm build failed and we have a gh fallback, try that
      if (!wasmPath && g.gh) {
        console.log(`  🔄 npm build failed, falling back to gh: ${g.gh} …`)
        const cloneDir = cloneGit(g.gh)
        if (cloneDir) {
          gitCloneDirs.push(cloneDir)
          let ghBuildDir = cloneDir
          if (!fs.existsSync(path.join(cloneDir, "grammar.js"))) {
            for (const sub of [lang, `tree-sitter-${lang}`]) {
              const candidate = path.join(cloneDir, sub)
              if (fs.existsSync(path.join(candidate, "grammar.js"))) { ghBuildDir = candidate; break }
            }
          }
          wasmPath = buildWasm(cliBin, ghBuildDir, lang)
        }
      }
    }

    if (wasmPath) {
      fs.writeFileSync(path.join(mainDir, `${lang}.js`), emitJs(fs.readFileSync(wasmPath), lang))
      results.ok.push(lang)
      if (!findWasm(buildDir, lang) && !findWasm(pkgDir, lang)) results.builtFromSource.push(lang)
      console.log(`  ✅ Generated main/${lang}.js`)
    } else {
      results.failed.push({ lang, reason: "wasm not found / build failed" })
      console.log(`  ❌ Failed`)
    }
  }

  // ── Process git-based targets ─────────────────────────────────────────────
  const gitCloneDirs = []

  for (const { lang, gh } of gitTargets) {
    console.log(`${"─".repeat(60)}`)
    console.log(`🔍 Processing: ${lang} (gh: ${gh})`)

    // Local path — use directly; remote URL — clone
    const isLocal = !gh.startsWith("http") && !gh.startsWith("git@")
    const srcDir  = isLocal ? path.resolve(gh) : cloneGit(gh)
    if (!srcDir || !fs.existsSync(srcDir)) {
      results.failed.push({ lang, reason: "clone failed / path missing" }); continue
    }
    if (!isLocal) gitCloneDirs.push(srcDir)

    // Find grammar subdir (some repos have it nested, e.g. tree-sitter-typescript)
    let buildDir = srcDir
    if (!fs.existsSync(path.join(srcDir, "grammar.js"))) {
      for (const sub of [lang, `tree-sitter-${lang}`]) {
        const candidate = path.join(srcDir, sub)
        if (fs.existsSync(path.join(candidate, "grammar.js"))) { buildDir = candidate; break }
      }
    }

    let wasmPath = findWasm(srcDir, lang)

    if (!wasmPath) {
      console.log(`  ⚙️  Building from source …`)
      wasmPath = buildWasm(cliBin, buildDir, lang)
    }

    if (wasmPath) {
      fs.writeFileSync(path.join(mainDir, `${lang}.js`), emitJs(fs.readFileSync(wasmPath), lang))
      results.ok.push(lang)
      results.builtFromSource.push(lang)
      console.log(`  ✅ Generated main/${lang}.js`)
    } else {
      results.failed.push({ lang, reason: "wasm not found / build failed" })
      console.log(`  ❌ Failed`)
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  if (cliDir)     fs.rmSync(cliDir,     { recursive: true, force: true })
  if (grammarDir) fs.rmSync(grammarDir, { recursive: true, force: true })
  for (const d of gitCloneDirs) fs.rmSync(d, { recursive: true, force: true })

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`)
  console.log(`✅ Total Ready:    ${results.ok.length}`)
  if (results.skipped.length)        console.log(`⏭️  Already built:  ${results.skipped.length}`)
  if (results.builtFromSource.length) console.log(`⚙️  Built from src: ${results.builtFromSource.join(", ")}`)
  if (results.failed.length) {
    console.log(`❌ Failed:`)
    results.failed.forEach(f => console.log(`   • ${f.lang}: ${f.reason}`))
  }
}

main().catch(console.error)
