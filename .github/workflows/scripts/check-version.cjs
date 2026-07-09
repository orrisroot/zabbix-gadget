const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../../..');

const pkgPath = path.join(rootDir, 'package.json');
const cargoPath = path.join(rootDir, 'src-tauri/Cargo.toml');
const tauriConfPath = path.join(rootDir, 'src-tauri/tauri.conf.json');

// 1. Get package.json version
if (!fs.existsSync(pkgPath)) {
  console.error(`Error: File not found at ${pkgPath}`);
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pkgVersion = pkg.version;

// 2. Get src-tauri/Cargo.toml version
if (!fs.existsSync(cargoPath)) {
  console.error(`Error: File not found at ${cargoPath}`);
  process.exit(1);
}
const cargoToml = fs.readFileSync(cargoPath, 'utf8');
const cargoMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
if (!cargoMatch) {
  console.error(`Error: Could not find version in ${cargoPath}`);
  process.exit(1);
}
const cargoVersion = cargoMatch[1];

// 3. Get src-tauri/tauri.conf.json version
if (!fs.existsSync(tauriConfPath)) {
  console.error(`Error: File not found at ${tauriConfPath}`);
  process.exit(1);
}
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
const tauriVersion = tauriConf.version;

// 4. Get GitHub tag version (e.g. v1.0.0 -> 1.0.0)
const githubRefName = process.env.GITHUB_REF_NAME;
if (!githubRefName) {
  console.error('Error: GITHUB_REF_NAME environment variable is not defined');
  process.exit(1);
}
const tagVersion = githubRefName.startsWith('v') ? githubRefName.slice(1) : githubRefName;

console.log(`Comparing version strings:`);
console.log(`- GitHub Tag Version: ${tagVersion} (from ${githubRefName})`);
console.log(`- package.json:       ${pkgVersion}`);
console.log(`- src-tauri/Cargo:    ${cargoVersion}`);
console.log(`- tauri.conf.json:    ${tauriVersion}`);

let hasMismatch = false;

if (pkgVersion !== tagVersion) {
  console.error(`[FAIL] package.json version (${pkgVersion}) does not match tag version (${tagVersion})`);
  hasMismatch = true;
}
if (cargoVersion !== tagVersion) {
  console.error(`[FAIL] src-tauri/Cargo.toml version (${cargoVersion}) does not match tag version (${tagVersion})`);
  hasMismatch = true;
}
if (tauriVersion !== tagVersion) {
  console.error(
    `[FAIL] src-tauri/tauri.conf.json version (${tauriVersion}) does not match tag version (${tagVersion})`,
  );
  hasMismatch = true;
}

if (hasMismatch) {
  console.error('[FAIL] Version mismatch detected. Aborting build.');
  process.exit(1);
}

console.log('[SUCCESS] All versions match. Proceeding to build.');
