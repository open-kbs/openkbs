import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { projectApi } from '../lib/api.js';
import {
  getUserJwt,
  getProjectJwtGlobal,
  decodeJwtPayload,
  loadProjectConfig,
  saveProjectConfig,
} from '../lib/config.js';
import { downloadSkill } from '../lib/updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function lsCommand(): Promise<void> {
  const result = await projectApi('/projects') as {
    projects: Array<{ shortId: string; title: string; region: string }>;
  };

  if (result.projects.length === 0) {
    console.log('No projects. Create one with: openkbs create <name>');
    return;
  }

  console.log('Projects:\n');
  for (const p of result.projects) {
    console.log(`  ${p.shortId}  ${p.title}  (${p.region})`);
  }
}

// Copy template directory, replacing {{placeholders}} in file contents
function copyTemplates(
  srcDir: string,
  destDir: string,
  vars: Record<string, string>,
): void {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destName = entry.name.replace('.template', '');
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTemplates(srcPath, destPath, vars);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      let content = fs.readFileSync(srcPath, 'utf-8');
      for (const [key, val] of Object.entries(vars)) {
        content = content.replaceAll(`{{${key}}}`, val);
      }
      fs.writeFileSync(destPath, content);
    }
  }
}

/**
 * Scaffold a project from templates into projectDir.
 * Downloads skill if running from compiled binary.
 */
export async function scaffoldProject(
  projectDir: string,
  vars: { projectId: string; region: string },
): Promise<void> {
  // Copy template files — try local templates/ dir first, then download from CDN
  const templateDir = path.resolve(__dirname, '..', '..', 'templates', 'quick-start');
  if (fs.existsSync(templateDir)) {
    copyTemplates(templateDir, projectDir, vars);
  } else {
    // Compiled binary — download templates with skill
    console.log('Downloading templates...');
    const tmpDir = path.join(projectDir, '.tmp-templates');
    const ok = await downloadSkill(tmpDir);
    if (ok && fs.existsSync(path.join(tmpDir, 'templates', 'quick-start'))) {
      copyTemplates(path.join(tmpDir, 'templates', 'quick-start'), projectDir, vars);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } else {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      // Fallback: write minimal openkbs.json
      fs.writeFileSync(path.join(projectDir, 'openkbs.json'),
        JSON.stringify({ projectId: vars.projectId, region: vars.region }, null, 2) + '\n');
    }
  }

  // Install skill — try local skill/ dir first, then download from CDN
  const skillDir = path.join(projectDir, '.claude', 'skills', 'openkbs');
  const localSkillDir = path.resolve(__dirname, '..', '..', 'skill');
  if (fs.existsSync(localSkillDir) && fs.existsSync(path.join(localSkillDir, 'SKILL.md'))) {
    fs.mkdirSync(skillDir, { recursive: true });
    copyTemplates(localSkillDir, skillDir, {});
    // Remove templates/ from skill dir if present
    fs.rmSync(path.join(skillDir, 'templates'), { recursive: true, force: true });
  } else {
    console.log('Downloading skill...');
    const ok = await downloadSkill(skillDir);
    if (ok) {
      fs.rmSync(path.join(skillDir, 'templates'), { recursive: true, force: true });
    } else {
      console.log('Skill download failed (run openkbs update later)');
    }
  }
}

/**
 * Create a local-only project (no cloud API call).
 */
export async function createLocalProject(
  name: string,
  baseDir: string,
): Promise<{ projectDir: string; projectId: string }> {
  const projectId = 'local-' + crypto.randomUUID().slice(0, 8);
  const projectDir = path.join(baseDir, name);

  if (fs.existsSync(projectDir)) {
    throw new Error(`Directory "${name}" already exists`);
  }
  fs.mkdirSync(projectDir, { recursive: true });

  const region = 'us-east-1';
  await scaffoldProject(projectDir, { projectId, region });

  // Set target to local in the generated openkbs.json
  const configPath = path.join(projectDir, 'openkbs.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.target = 'local';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return { projectDir, projectId };
}

// openkbs create [name] — create + scaffold project
export async function createCommand(name: string | undefined, opts: { region: string }): Promise<void> {
  let shortId: string;
  let region = opts.region || 'eu-central-1';

  const globalToken = getProjectJwtGlobal();

  if (globalToken) {
    // Container mode: use existing projectJWT
    const payload = decodeJwtPayload(globalToken);
    if (!payload?.shortId) {
      throw new Error('Invalid project token');
    }
    shortId = payload.shortId as string;

    try {
      const result = await projectApi('/projects') as {
        projects: Array<{ shortId: string; region: string }>;
      };
      if (result.projects.length > 0) region = result.projects[0].region;
    } catch {}
  } else if (getUserJwt()) {
    // Local mode: create project on platform
    const title = name || 'My Project';
    const result = await projectApi('/projects', {
      method: 'POST',
      body: { title, region },
    }) as { project: { shortId: string; region: string } };

    shortId = result.project.shortId;
    region = result.project.region;
    console.log(`Project created: ${shortId}`);
  } else {
    throw new Error('Not logged in. Run: openkbs login');
  }

  // If name is provided in local mode, create a subdirectory
  let projectDir = process.cwd();
  if (name && !globalToken) {
    projectDir = path.join(process.cwd(), name);
    if (fs.existsSync(projectDir)) {
      throw new Error(`Directory "${name}" already exists`);
    }
    fs.mkdirSync(projectDir, { recursive: true });
  }

  await scaffoldProject(projectDir, { projectId: shortId, region });

  if (name && !globalToken) {
    console.log(`Project scaffolded in ./${name}/`);
  } else {
    console.log(`Project scaffolded: ${shortId} (${region})`);
  }
}
