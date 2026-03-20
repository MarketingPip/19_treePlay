import * as esbuild from 'esbuild';

// Simple plugin to redirect imports to esm.sh
const esmShimPlugin = {
  name: 'esm-sh-plugin',
  setup(build) {
    // Intercept all imports that don't start with ./ or /
    build.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.\// }, args => {
      // If it's a bare module specifier (like 'lodash' or 'tree-sitter')
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
      plugins: [esmShimPlugin],
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
