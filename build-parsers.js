const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD_CMD = 'npx tree-sitter build --wasm';

function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function buildGrammars(dir) {
  const mainDir = path.join(dir, 'main');
  if (!fs.existsSync(mainDir)) fs.mkdirSync(mainDir);

  let commitHash = "main";
  try {
    commitHash = execSync('git rev-parse HEAD').toString().trim();
  } catch (e) {
    console.warn("⚠️ Not a git repository, using 'main' as fallback hash.");
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (
      fs.statSync(fullPath).isDirectory() &&
      fs.existsSync(path.join(fullPath, 'grammar.js'))
    ) {
      console.log(`🔨 Building WASM for: ${file}...`);

      try {
        execSync(BUILD_CMD, { cwd: fullPath, stdio: 'inherit' });

        const wasmFile = fs.readdirSync(fullPath).find(f => f.endsWith('.wasm'));
        if (!wasmFile) {
          console.warn(`⚠️ No .wasm found in ${file} after build.\n`);
          continue;
        }

        const wasmPath = path.join(fullPath, wasmFile);
        const langName = wasmFile.replace('tree-sitter-', '').replace('.wasm', '');
        const camelName = toCamelCase(langName);

        const wasmBuffer = fs.readFileSync(wasmPath);
        const base64Data = wasmBuffer.toString('base64');

        // Emit a self-decoding ES module — consumers get a Uint8Array ready
        // to pass directly to Parser.Language.load()
        const jsContent = [
          `// Generated Tree-sitter Parser Bundle — ${langName}`,
          `const base64 = "${base64Data}";`,
          `const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));`,
          `export default bytes;`,
          `export { bytes };`,
          '',
        ].join('\n');

        const outJsPath = path.join(mainDir, `${langName}.js`);
        fs.writeFileSync(outJsPath, jsContent);

        console.log(`✅ Success: ${file}`);
        console.log(`📦 Generated: main/${langName}.js`);
        console.log(`🔗 import ${camelName} from "https://github.com/jeff-hykin/common_tree_sitter_languages/raw/${commitHash}/main/${langName}.js"\n`);

      } catch (err) {
        console.error(`❌ Failed to build ${file}: ${err.message}\n`);
      }
    }
  }
}

buildGrammars(process.cwd());
