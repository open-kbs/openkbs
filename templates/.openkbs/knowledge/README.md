# OpenKBS Agent Development Guidelines

## MANDATORY FIRST STEP
Read the content of ALL files in `.openkbs/knowledge/examples/` directory and ALL subdirectories (without the images)

## Development Flow

1. **Read ALL example files first** to get familiar with OpenKBS framework for building AI agents
2. **Read existing agent code:**
   - `./app/` folder (settings, instructions, etc.)
   - `./src/` folder (all Events and Frontend files)
   - `./run_job.js` any files starting with "run"
3. **Implement using knowledge from examples**

## Critical Rules

- Never skip reading examples
- Never guess framework methods - reference the examples and documentation below
- Study the complete working applications in examples to understand OpenKBS patterns

## Other OpenKBS commands
- `openkbs push` - deploy the agent to the cloud
- `openkbs pull` - pull locally any agent changes from the cloud

## OpenKBS Documentation

### Available Models for (`settings.json`)
`claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022`, `gemini-2.5-pro`, `gpt-4o`
