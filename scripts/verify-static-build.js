const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const requiredFiles = ['index.html', '404.html', 'asset-manifest.json', 'manifest.json', '.nojekyll'];
 main

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(build, file))) {
    throw new Error(`Static build is missing build/${file}`);
  }
}

const html = fs.readFileSync(path.join(build, 'index.html'), 'utf8');
const rootAbsoluteAsset = /(?:src|href)=["']\/(?!\/)/;

if (rootAbsoluteAsset.test(html)) {
  throw new Error('Static build contains a root-absolute asset URL that will break on a project Pages site.');
}

const manifest = JSON.parse(fs.readFileSync(path.join(build, 'asset-manifest.json'), 'utf8'));
const entrypoints = manifest.entrypoints || [];

if (!entrypoints.length) {
  throw new Error('Static build has no JavaScript or CSS entrypoints.');
}

for (const entrypoint of entrypoints) {
  const relativePath = entrypoint.replace(/^\.\//, '');
  if (!fs.existsSync(path.join(build, relativePath))) {
    throw new Error(`Static build entrypoint does not exist: build/${relativePath}`);
  }
}

console.log(`Verified static Pages artifact: build/ (${entrypoints.length} entrypoints)`);
