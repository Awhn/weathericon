const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const requiredFiles = ['index.html', '404.html', 'asset-manifest.json', 'manifest.json', '.nojekyll'];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(build, file))) {
    throw new Error(`Static build is missing build/${file}`);
  }
}

const html = fs.readFileSync(path.join(build, 'index.html'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const homepage = packageJson.homepage || '';
const projectBase = homepage.startsWith('/') ? `${homepage.replace(/\/$/, '')}/` : '';
const rootAbsoluteAsset = /(?:src|href)=["']\/(?!\/)/g;
const invalidRootAssets = [...html.matchAll(rootAbsoluteAsset)]
  .filter((match) => projectBase && !html.slice(match.index).startsWith(match[0].replace('/', projectBase)));

if (invalidRootAssets.length || (!projectBase && rootAbsoluteAsset.test(html))) {
  throw new Error('Static build contains a root-absolute asset URL outside the configured project Pages base.');
}

if (projectBase && !html.includes(`src="${projectBase}static/`)) {
  throw new Error(`Static build is not using the configured Pages base path: ${projectBase}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(build, 'asset-manifest.json'), 'utf8'));
const entrypoints = manifest.entrypoints || [];

if (!entrypoints.length) {
  throw new Error('Static build has no JavaScript or CSS entrypoints.');
}

for (const entrypoint of entrypoints) {
  const relativePath = entrypoint.replace(/^\.\//, '').replace(new RegExp(`^${projectBase}`), '');
  if (!fs.existsSync(path.join(build, relativePath))) {
    throw new Error(`Static build entrypoint does not exist: build/${relativePath}`);
  }
}

console.log(`Verified static Pages artifact: build/ (${entrypoints.length} entrypoints)`);
