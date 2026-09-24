const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// Load environment variables from .env if present
try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch (e) {}

process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'Ishtiak734@';

const testFiles = fs.readdirSync(rootDir)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .sort();

console.log(`Running ${testFiles.length} test files:\n${testFiles.join('\n')}\n`);

let failed = [];
for (const file of testFiles) {
  console.log(`\n=== ${file} ===`);
  try {
    execSync(`node ${file}`, { 
      stdio: 'inherit', 
      cwd: rootDir,
      env: { ...process.env }
    });
  } catch (err) {
    failed.push(file);
  }
}

console.log('\n=== SUMMARY ===');
if (failed.length) {
  console.log(`FAILED (${failed.length}/${testFiles.length}): ${failed.join(', ')}`);
  process.exit(1);
} else {
  console.log(`All ${testFiles.length} test files passed.`);
}
