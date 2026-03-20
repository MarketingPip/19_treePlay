import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
// 1. Setup the plugin to handle remote URLs and esm.sh redirects
const urlResolvePlugin = {
  name: 'url-resolve-plugin',
  setup(build) {
    // Resolve full URLs
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: 'http-url',
    }));

    // ✅ FIX: resolve relative imports inside fetched modules
    build.onResolve({ filter: /^\.+\// }, (args) => {
      if (args.namespace === 'http-url') {
        return {
          path: new URL(args.path, args.importer).toString(),
          namespace: 'http-url',
        };
      }
    });

    // Bare imports → esm.sh
    /*build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.kind === 'entry-point') return;

      return {
        path: `https://esm.sh/${args.path}`,
        namespace: 'http-url',
      };
    });*/ 

    // Load remote files
    build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
      const res = await fetch(args.path);

      if (!res.ok) {
        throw new Error(`Failed to fetch ${args.path}: ${res.status}`);
      }

      const contents = await res.text();

      return {
        contents,
        loader: 'js',
      };
    });
  },
};

async function runBuild() {
  const outDir = 'dist';
  const outFile = path.join(outDir, 'tree-morph.min.js');

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
      plugins: [nodeModulesPolyfillPlugin(), urlResolvePlugin],
      minify: true, // Set to true for a smaller production bundle
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
