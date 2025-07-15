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


## OpenKBS Documentation

OpenKBS is an AI platform for building, deploying, and integrating AI agents/apps. This guide overviews backend/frontend development.

### Project Structure

*   **`src/`**: Custom source code.
   *   **`Events/`**: Backend LLM event handlers.
      *   `actions.js`: Shared backend logic/tools.
      *   `onRequest.js`: Handles user messages before LLM.
      *   `onRequest.json`: NPM deps for `onRequest.js`.
      *   `onResponse.js`: Handles LLM responses before sending to user.
      *   `onResponse.json`: NPM deps for `onResponse.js`.
      *   `onPublicAPIRequest.js`: Handles public, unauthenticated API calls.
      *   `onPublicAPIRequest.json`: Deps for `onPublicAPIRequest.js`.
      *   `onAddMessages.js`: Handles `chatAddMessages` API calls.
      *   `onAddMessages.json`: Deps for `onAddMessages.js`.
   *   **`Frontend/`**: Frontend customization.
      *   `contentRender.js`: Custom UI rendering (messages, headers).
      *   `contentRender.json`: NPM deps for `contentRender.js`.
*   **`app/`**: App-level configuration.
   *   `settings.json`: Core settings (model, vendor).
   *   `instructions.txt`: LLM instructions.
   *   `icon.png`: App icon.

### Backend Handlers
- Files named `on*.js` (e.g., `onRequest.js`) are handlers.
- Handlers are NodeJS entry points for platform events.
- Use ES6 `import`, not `require()`.

#### onRequest & onResponse
These are core Node.js middleware handlers.
- **`onRequest`**: Invoked on user message. Process input, extract commands, perform actions.
- **`onResponse`**: Invoked after LLM response. Process output, execute commands.

#### NPM Dependencies
If a file (`actions.js`) imports a dependency (`mysql2`) and is then imported by a handler (`onRequest.js`), 
the dependency (`mysql2`) must be in the handler's JSON (`onRequest.json`).

### Secrets Management
Use `{{secrets.your_secret_name}}` for secrets. Never hardcode them. Users provide values via the secrets manager.

### Frontend
The React-based frontend allows UI customization via the `contentRender.js` module.

#### contentRender.js
This file exports functions for custom rendering.
- **`onRenderChatMessage(params)`:** Renders each chat message. Returns a React component. If it returns `undefined`, default rendering is used.
   - **`params` object includes:** `msgIndex`, `messages`, `setMessages`, `iframeRef`, `KB`, `chatContainerRef`, `RequestChatAPI`, `setSystemAlert`, `setBlockingLoading`, `blockingLoading`, `sendButtonRef`, `sendButtonRippleRef`, `setInputValue`, `renderSettings`, `axios`, `itemsAPI`, `createEmbeddingItem`, `indexedDB`, `chatAPI`, `generateMsgId`, `kbUserData`, `executeNodejs`.

#### Meta Actions
Triggered in `onResponse` to control conversation flow.
*   **`REQUEST_CHAT_MODEL`:** Sends the conversation to the LLM to continue the chat.
*   **`SAVED_CHAT_IMAGE`:** Saves a generated/processed image to chat history. Requires `imageSrc` in the return object.

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
