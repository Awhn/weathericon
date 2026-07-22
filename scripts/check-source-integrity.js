const fs = require('fs');
const path = require('path');

const sourceRoot = path.resolve(__dirname, '..', 'src');
const forbiddenLine = /^\s*(<<<<<<<.*|=======|>>>>>>>.*|main|work)\s*$/;
const failures = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.(js|css)$/.test(entry.name)) {
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (forbiddenLine.test(line)) failures.push(`${path.relative(sourceRoot, file)}:${index + 1}: ${line.trim()}`);
      });
    }
  }
}

visit(sourceRoot);
if (failures.length) throw new Error(`Unresolved merge residue found:\n${failures.join('\n')}`);
console.log('Source integrity check passed.');
