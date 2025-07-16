# OpenKBS Agent Development Guidelines

## MANDATORY FIRST STEP
**READ EVERY SINGLE FILE IN THE EXAMPLES FOLDER**

Read the content of ALL files in `.openkbs/knowledge/examples/` directory and ALL subdirectories (without the icon.png)

## Development Flow

1. **Read ALL example files first** to get familiar with OpenKBS framework for building AI agents
2. **Read existing agent code:**
   - `./app/` folder (settings, instructions, etc.)
   - `./src/` folder (all Events and Frontend files)
   - `./run_job.js` any files starting with "run"
3. **Implement using knowledge from examples**

## Critical Rules

- Never skip reading examples
- Never guess framework methods - reference the examples
- Study the complete working applications in examples to understand OpenKBS patterns

### Available Models in (`settings.json`)
`claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022`, `gemini-2.5-pro`
