# OpenKBS Development Guidelines

## Development Flow

1. **Read existing code first:**
   - `./app/` folder (settings, instructions, etc.)
   - `./src/` folder (all Events and Frontend files)

2. **Assess implementation requirements:**
   - **Minor changes only**: Simple modifications to existing code that don't require framework knowledge
   - **Framework implementation needed**: New features, new event handlers, new frontend components, or new app development

3. **For framework implementation:**
   - Read all source code in `.openkbs/knowledge/examples/`, read every file (except the icon)
   - Study complete working applications to understand OpenKBS patterns
   - Never guess framework methods or variables - always reference examples

## When Examples Are Required

- New OpenKBS application development (placeholder app)
- Adding new event handlers (onRequest, onResponse, etc.)
- Creating new frontend components
- Implementing OpenKBS-specific functionality
- Any framework-related implementation

## When Examples May Not Be Needed

- Simple text changes to existing files
- Minor bug fixes in existing code
- Configuration adjustments that don't involve framework methods

## Critical Rule

**When in doubt, read the examples.** They contain all necessary framework knowledge for proper OpenKBS implementation.