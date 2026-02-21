``# OpenKBS Platform Project

## MANDATORY FIRST STEP (DO NOT SKIP)

**CRITICAL: You MUST load the openkbs skill AT THE VERY START of every session, before doing anything else. No exceptions. Do not skip, defer, or ignore this step.**

**Run this first:** `/openkbs`

This step is required before any other work begins. If you skip it, your actions may fail or produce incorrect results.

## Setup Flow

### 1. Get Whitelabel Agent kbId
```bash
openkbs ls
```
If auth error, ask user to run `openkbs login` first.

Pick the whitelabel agent kbId from the list.

### 2. Configure Settings
Update `openkbs.json`:
- Replace `{{WHITELABEL_KB_ID}}` with kbId from step 1

### 3. Deploy
```bash
openkbs deploy        # Elastic services (Postgres, Storage, Pulse)
openkbs site push     # Static site
openkbs fn push api   # API function (optional)
```

## Project Structure
- `openkbs.json` - Project config (kbId, region, elastic services)
- `site/` - Static frontend
- `functions/` - Serverless Lambda functions
- `agents/` - AI agents (optional, each gets own kbId on push)
