import * as esbuild from 'esbuild';

const watchMode = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const commonConfig = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  loader: { '.js': 'jsx' },
  outdir: 'dist',
  absWorkingDir: process.cwd(),
  publicPath: '/dist/',
};

// List of entry points to build
const entryPoints = [
  'src/popup-handler.js',
  'src/background.js',
  'src/chatbot.js'
];

try {
  const contexts = await Promise.all(
    entryPoints.map(entry =>
      esbuild.context({
        ...commonConfig,
        entryPoints: [entry],
      })
    )
  );

  if (watchMode) {
    console.log('Watching for changes...');
    await Promise.all(contexts.map(context => context.watch()));
  } else {
    await Promise.all(contexts.map(context => context.rebuild()));
    await Promise.all(contexts.map(context => context.dispose()));
    console.log('Build complete');
  }
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}