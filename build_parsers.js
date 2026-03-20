const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// The standard modern command
const BUILD_CMD = 'npx tree-sitter build --wasm';

function buildGrammars(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    
    // Check if it's a directory containing a grammar
    if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'grammar.js'))) {
      console.log(`🔨 Building WASM for: ${file}...`);
      try {
        execSync(BUILD_CMD, { cwd: fullPath, stdio: 'inherit' });
        console.log(`✅ Success: ${file}\n`);
      } catch (err) {
        console.error(`❌ Failed to build ${file}. Ensure tree-sitter-cli is installed.\n`);
      }
    }
  }
}

buildGrammars(process.cwd());
