import * as esbuild from 'esbuild';

// Simple plugin to redirect imports to esm.sh
const urlResolvePlugin = {
  name: 'url-resolve-plugin',
  setup(build) {
    // Intercept anything starting with http:// or https://
    build.onResolve({ filter: /^https?:\/\// }, args => {
      return { 
        path: args.path, 
        external: true 
      };
    });

    // Also handle bare imports if you want them to go to esm.sh
    build.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.\// }, args => {
      // If it's a standard package name, redirect it
      if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
        return { 
          path: `https://esm.sh/${args.path}`, 
          external: true 
        };
      }
    });
  },
};

async function runBuild() {
  console.log("🚀 Starting ESM build...");

  try {
    await esbuild.build({
      entryPoints: ['src/index.js'],
      bundle: true,
      format: 'esm',
      outfile: 'dist/index.js',
      platform: 'browser', // or 'node' depending on your target
      target: 'es2022',
      plugins: [urlResolvePlugin],
      minify: false, // Set to true for production
      sourcemap: true,
    });

    console.log("✅ Build complete: dist/index.js");
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
}

runBuild();
