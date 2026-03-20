const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Standard command for modern tree-sitter
const BUILD_CMD = 'npx tree-sitter build --wasm';

function buildGrammars(dir) {
  const mainDir = path.join(dir, 'main');
  if (!fs.existsSync(mainDir)) fs.mkdirSync(mainDir);

  // Get the current commit hash for the import string output
  let commitHash = "main";
  try {
    commitHash = execSync('git rev-parse HEAD').toString().trim();
  } catch (e) {
    console.warn("⚠️ Not a git repository, using 'main' as fallback hash.");
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    
    if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'grammar.js'))) {
      console.log(`🔨 Building WASM for: ${file}...`);
      
      try {
        // 1. Build the WASM file
        execSync(BUILD_CMD, { cwd: fullPath, stdio: 'inherit' });

        // 2. Find the generated .wasm file (usually tree-sitter-lang.wasm)
        const wasmFile = fs.readdirSync(fullPath).find(f => f.endsWith('.wasm'));
        
        if (wasmFile) {
          const wasmPath = path.join(fullPath, wasmFile);
          const langName = wasmFile.replace('tree-sitter-', '').replace('.wasm', '');
          
          // 3. Binaryify: Convert to Base64 and wrap in a JS module
          const wasmBuffer = fs.readFileSync(wasmPath);
          const base64Data = wasmBuffer.toString('base64');
          
          // Create the bundle-able JS content
          const jsContent = `// Generated Tree-sitter Parser Bundle\nexport default "${base64Data}";\n`;
          const outJsPath = path.join(mainDir, `${langName}.js`);
          
          fs.writeFileSync(outJsPath, jsContent);

          // 4. Generate the CamelCase name for the console log
          const camelName = langName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          
          console.log(`✅ Success: ${file}`);
          console.log(`📦 Generated: main/${langName}.js`);
          console.log(`🔗 import ${camelName} from "https://github.com/jeff-hykin/common_tree_sitter_languages/raw/${commitHash}/main/${langName}.js"\n`);
        }
      } catch (err) {
        console.error(`❌ Failed to build ${file}: ${err.message}\n`);
      }
    }
  }
}

buildGrammars(process.cwd());
