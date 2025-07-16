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
3. **Implement requested features using knowledge from examples**

## Critical Rules

- Never skip reading examples
- Never guess framework methods, settings or variables — always reference the examples.
- Study the complete working applications in examples to understand OpenKBS patterns

### settings itemTypes Structure

Each item type has:
- **Embedding Template**: Defines how text fields are combined, using placeholders like `${item.title}`.

#### Attributes
Each attribute includes:
- **label**: Descriptive name.
- **placeholder**: Placeholder text.
- **encrypted**: `true` or `false`.
- **attrName**: Attribute name.
- **attrType**: Unique type, e.g., `keyword1`, `text1`.

#### Attribute Types
- **keyword**: `keyword1`, `keyword2`, ...
- **text**: `text1`, `text2`, ...
- **integer**: `integer1`, `integer2`, ...
- **boolean**: `boolean1`, `boolean2`, ...
- **float**: `float1`, `float2`, ...
- **date**: `date1`, `date2`, ...
- **long**: `long1`, `long2`, ...
- **double**: `double1`, `double2`, ...

Each `attrType` must have unique suffix number per type.
