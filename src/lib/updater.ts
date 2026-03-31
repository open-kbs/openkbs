import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

// Only bump PATCH (e.g. 2.3.1 → 2.3.2). Bump MINOR only when explicitly requested.
export const CLI_VERSION = '2.4.5';
// Only bump PATCH (e.g. 1.0.0 → 1.0.1). Bump MINOR only when explicitly requested.
export const SKILL_VERSION = '1.1.2';

const VERSION_URL = 'https://openkbs.com/cli/version.json';
const CLI_BASE_URL = 'https://openkbs.com/cli';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CONFIG_DIR = path.join(os.homedir(), '.openkbs');
const LAST_CHECK_FILE = path.join(CONFIG_DIR, 'last_update_check');

function getPlatformBinary(): string {
  const p = os.platform();
  const a = os.arch();
  const pMap: Record<string, string> = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
  const aMap: Record<string, string> = { x64: 'x64', arm64: 'arm64' };
  const pName = pMap[p];
  const aName = aMap[a];
  if (!pName || !aName) return '';
  return p === 'win32' ? `openkbs-${pName}-${aName}.exe` : `openkbs-${pName}-${aName}`;
}

function shouldCheck(): boolean {
  try {
    const ts = parseInt(fs.readFileSync(LAST_CHECK_FILE, 'utf-8').trim());
    return Date.now() - ts > CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markChecked(): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(LAST_CHECK_FILE, Date.now().toString());
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

// Download and extract skill.tar.gz into a target directory
export async function downloadSkill(targetDir: string): Promise<boolean> {
  try {
    const res = await fetch(`${CLI_BASE_URL}/skill.tar.gz`);
    if (!res.ok) return false;

    const buffer = Buffer.from(await res.arrayBuffer());
    const tmpFile = path.join(CONFIG_DIR, 'skill.tar.gz');
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(tmpFile, buffer);

    fs.mkdirSync(targetDir, { recursive: true });
    spawnSync('tar', ['xzf', tmpFile, '-C', targetDir], { stdio: 'ignore' });
    fs.unlinkSync(tmpFile);
    return true;
  } catch {
    return false;
  }
}

// Resolve writable binary path: prefer ~/.openkbs/bin/openkbs, fall back to process.execPath
function getWritableBinPath(): string {
  const userBin = path.join(os.homedir(), '.openkbs', 'bin', 'openkbs');
  if (fs.existsSync(userBin)) return userBin;
  return process.execPath;
}

// Auto-update check (runs before every command, updates binary only)
export async function checkForUpdate(): Promise<void> {
  if (process.argv[1]?.match(/\.[mc]?[jt]sx?$/)) return;
  if (process.env.OPENKBS_SKIP_UPDATE) return;
  if (!shouldCheck()) return;

  try {
    markChecked();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(VERSION_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return;

    const { version: latest } = (await res.json()) as { version: string };

    if (compareVersions(CLI_VERSION, latest) >= 0) return;

    const binaryName = getPlatformBinary();
    if (!binaryName) return;

    console.log(`Updating OpenKBS CLI: ${CLI_VERSION} → ${latest}`);

    const binRes = await fetch(`${CLI_BASE_URL}/${binaryName}`);
    if (!binRes.ok) {
      console.log('Update failed: could not download new version');
      return;
    }

    const buffer = Buffer.from(await binRes.arrayBuffer());
    const targetBin = getWritableBinPath();
    const tmpPath = targetBin + '.tmp';

    fs.writeFileSync(tmpPath, buffer);
    fs.chmodSync(tmpPath, 0o755);
    fs.renameSync(tmpPath, targetBin);

    console.log(`Updated to ${latest}\n`);

    const result = spawnSync(targetBin, process.argv.slice(2), {
      stdio: 'inherit',
      env: { ...process.env, OPENKBS_SKIP_UPDATE: '1' },
    });
    process.exit(result.status ?? 0);
  } catch {
    // Silently fail
  }
}

// openkbs update — explicit: update CLI binary + download skill into project
export async function updateCommand(): Promise<void> {
  console.log(`Current CLI version: ${CLI_VERSION}`);

  // 1. Check for binary update
  try {
    const res = await fetch(VERSION_URL);
    if (res.ok) {
      const { version: latest } = (await res.json()) as { version: string };
      if (compareVersions(CLI_VERSION, latest) < 0) {
        const binaryName = getPlatformBinary();
        if (binaryName) {
          console.log(`Updating CLI: ${CLI_VERSION} → ${latest}`);
          const binRes = await fetch(`${CLI_BASE_URL}/${binaryName}`);
          if (binRes.ok) {
            const buffer = Buffer.from(await binRes.arrayBuffer());
            const targetBin = getWritableBinPath();
            const tmpPath = targetBin + '.tmp';
            fs.writeFileSync(tmpPath, buffer);
            fs.chmodSync(tmpPath, 0o755);
            fs.renameSync(tmpPath, targetBin);
            console.log(`CLI updated to ${latest}`);
          }
        }
      } else {
        console.log('CLI is up to date');
      }
    }
  } catch (err: any) {
    console.log(`CLI update check failed: ${err.message}`);
  }

  // 2. Download skill into project's .claude/skills/openkbs/
  const projectDir = process.cwd();
  const skillDir = path.join(projectDir, '.claude', 'skills', 'openkbs');
  console.log('Downloading latest skill...');
  const ok = await downloadSkill(skillDir);
  if (ok) {
    // Copy CLAUDE.md from templates if missing (for containers created before this feature)
    const claudeMdSrc = path.join(skillDir, 'templates', 'quick-start', '.claude', 'CLAUDE.md');
    const claudeMdDest = path.join(projectDir, '.claude', 'CLAUDE.md');
    if (fs.existsSync(claudeMdSrc) && !fs.existsSync(claudeMdDest)) {
      fs.copyFileSync(claudeMdSrc, claudeMdDest);
      console.log('Created .claude/CLAUDE.md');
    }
    // Remove templates/ from skill dir — only needed for scaffolding, not for LLM context
    fs.rmSync(path.join(skillDir, 'templates'), { recursive: true, force: true });
    console.log(`Skill updated in .claude/skills/openkbs/`);
  } else {
    console.log('Skill download failed (will retry on next update)');
  }

  markChecked();
}
