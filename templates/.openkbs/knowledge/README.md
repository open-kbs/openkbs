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

OpenKBS is an AI platform for building, deploying, and integrating AI agents/apps. This guide overviews backend/frontend development.

### Backend SDK (`openkbs` object)
Utilities available in backend handlers.
*   **`openkbs.textToImage(prompt, params)`**: Generate image from text.
*   **`openkbs.speechToText(audioURL, params)`**: Transcribe audio URL to text.
*   **`openkbs.webpageToText(pageURL, params)`**: Extract text from a webpage.
*   **`openkbs.googleSearch(q, params)`**: Perform a Google search.
*   **`openkbs.sendMail(email, subject, content)`**: Send an email.
*   **`openkbs.documentToText(documentURL, params)`**: Extract text from documents.
*   **`openkbs.imageToText(imageUrl, params)`**: Extract text from an image.
*   **`openkbs.translate(text, to)`**: Translate text.
*   **`openkbs.detectLanguage(text, params)`**: Detect text language.
*   **`openkbs.textToSpeech(text, params)`**: Convert text to speech. `response.audioContent` auto-plays.
*   **`openkbs.encrypt(plaintext)`**: Encrypt data.
*   **`openkbs.decrypt(ciphertext)`**: Decrypt data.
*   **`openkbs.items(data)`**: Use Items API (CRUD).
*   **`openkbs.chats(data)`**: Use Chats API.
*   **`openkbs.kb(data)`**: Use Knowledge Base API.
*   **`openkbs.clientHeaders`**: Access client headers (e.g., `openkbs.clientHeaders['x-forwarded-for']`).
*   **`openkbs.createEmbeddings(input, model)`**: Create embeddings from text.

### Available Models (`settings.json`)
`claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022`, `gemini-2.5-pro`, `gpt-4o`
