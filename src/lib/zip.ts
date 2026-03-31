import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Zip a function directory and return the zip buffer.
 * Installs npm dependencies if package.json exists and node_modules doesn't.
 */
export function zipFunctionDir(fnDir: string): Buffer {
  // Check for package.json and run npm install if node_modules doesn't exist
  const pkgPath = path.join(fnDir, 'package.json');
  if (fs.existsSync(pkgPath) && !fs.existsSync(path.join(fnDir, 'node_modules'))) {
    console.log('  Installing dependencies...');
    execSync('npm install --production', { cwd: fnDir, stdio: 'pipe' });
  }

  // Create zip
  const zipPath = path.join(fnDir, '.deploy.zip');
  try {
    execSync(`cd "${fnDir}" && zip -r -q "${zipPath}" . -x '.deploy.zip' '*.git*'`, { stdio: 'pipe' });
  } catch {
    throw new Error('zip command not found. Install zip to deploy functions.');
  }

  const zipBuffer = fs.readFileSync(zipPath);
  fs.unlinkSync(zipPath);
  return zipBuffer;
}
