import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// 1. Setup the plugin to handle remote URLs and esm.sh redirects
const urlResolvePlugin = {
  name: 'url-resolve-plugin',
  setup(build) {
    // Intercept anything starting with http:// or https:// (deno.land, etc.)
    build.onResolve({ filter: /^https?:\/\// }, args => ({
      path: args.path,
      external: true,
    }));

    // Redirect bare module imports to esm.sh, but SKIP local files
    build.onResolve({ filter: /^[^./]/ }, args => {
      // If it doesn't look like a relative or absolute path, it's a package
      return { 
        path: `https://esm.sh/${args.path}`, 
        external: true 
      };
    });
  },
};

async function runBuild() {
  const outDir = 'dist';
  const outFile = path.join(outDir, 'index.js');

  console.log("🚀 Starting ESM build...");

  try {
    // 2. Ensure the dist directory exists to prevent "no such file or directory" errors
    if (!fs.existsSync(outDir)) {
      console.log(`📁 Creating directory: ${outDir}`);
      fs.mkdirSync(outDir, { recursive: true });
    }

    // 3. Execute the esbuild process
    await esbuild.build({
      entryPoints: ['src/index.js'],
      bundle: true,
      format: 'esm',
      outfile: outFile,
      platform: 'browser',
      target: 'es2022',
      plugins: [urlResolvePlugin],
      minify: false, // Set to true for a smaller production bundle
      sourcemap: true,
      // This is crucial for tree-sitter: it prevents esbuild 
      // from trying to resolve node-specific globals
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    });

    console.log(`✅ Build complete: ${outFile}`);
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
}

runBuild();
