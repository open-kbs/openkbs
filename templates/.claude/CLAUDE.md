``# OpenKBS Platform Project

## MANDATORY FIRST STEPS (DO NOT SKIP)

**CRITICAL: You MUST execute these two commands AT THE VERY START of every session, before doing anything else. No exceptions. Do not skip, defer, or ignore these steps.**

1. **Run this first:** `openkbs update`
2. **Then load the skill:** `/openkbs`

These steps are required before any other work begins. If you skip them, your actions may fail or produce incorrect results.

## Setup Flow

### 1. Get Whitelabel Agent kbId
```bash
openkbs ls
```
If auth error, ask user to run `openkbs login` first.

Pick the whitelabel agent kbId from the list.

### 2. Configure Settings
Update these files with values from step 1 and openkbs.json:

**site/settings.json** and **functions/settings.json**:
- Replace `{{WHITELABEL_KB_ID}}` with kbId from step 1
- Replace `{{REGION}}` with region from openkbs.json

### 3. Deploy
```bash
openkbs deploy        # Elastic services (Postgres, Storage, Pulse)
openkbs site push     # Static site
openkbs fn push api   # API function (optional)
```

## Project Structure
- `openkbs.json` - Elastic services config (region, postgres, storage, pulse)
- `site/` - Static frontend (settings.json links to whitelabel agent)
- `functions/` - Serverless Lambda functions
- `agents/` - AI agents (optional, each gets own kbId on push)
