const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'node_modules', 'lucide', 'dist', 'umd', 'lucide.min.js');
const targetDirectory = path.join(__dirname, '..', 'vendor');
const target = path.join(targetDirectory, 'lucide.min.js');

if (!fs.existsSync(source)) {
  throw new Error('The local Lucide package was not installed. Run npm install first.');
}

fs.mkdirSync(targetDirectory, { recursive: true });
fs.copyFileSync(source, target);
