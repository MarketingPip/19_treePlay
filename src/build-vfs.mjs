import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// 1. Setup the plugin to handle remote URLs and esm.sh redirects
const urlResolvePlugin = {
  name: 'url-resolve-plugin',
  setup(build) {
    // Handle full URLs (deno.land, esm.sh, etc.)
    build.onResolve({ filter: /^https?:\/\// }, (args) => {
      return {
        path: args.path,
        namespace: 'http-url', // important for custom loading
      };
    });

    // Handle bare module imports (react, lodash, etc.)
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      // Ignore entry points (optional but safer)
      if (args.kind === 'entry-point') return;

      return {
        path: `https://esm.sh/${args.path}`,
        namespace: 'http-url',
      };
    });

    // Fetch the remote modules
    build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
      const res = await fetch(args.path);

      if (!res.ok) {
        throw new Error(`Failed to fetch ${args.path}: ${res.status}`);
      }

      const contents = await res.text();

      return {
        contents,
        loader: 'js', // or infer from content-type if needed
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
