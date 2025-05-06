# OpenKBS Framework Quick Guide (Claude.md)

This guide provides a brief overview of developing backend and frontend logic for your OpenKBS app/agent.

## Project Structure Overview

A typical OpenKBS project has the following key directories:

*   **`src/`**: Contains your custom source code.
    *   **`Events/`**: Houses backend event handlers.
        *   `actions.js`: Often used for shared logic/tool definitions.
        *   `onRequest.js`: Handles incoming user messages before LLM processing.
        *   `onRequest.json`: NPM dependencies for `onRequest.js`.
        *   `onResponse.js`: Handles LLM responses before sending to the user.
        *   `onResponse.json`: NPM dependencies for `onResponse.js`.
        *   `onPublicAPIRequest.js`: Handles unauthenticated public API calls.
        *   `onPublicAPIRequest.json`: Dependencies for `onPublicAPIRequest.js`.
        *   `onAddMessages.js`: Handles messages added via the `chatAddMessages` API.
        *   `onAddMessages.json`: Dependencies for `onAddMessages.js`.
    *   **`Frontend/`**: Contains frontend customization logic.
        *   `contentRender.js`: Custom UI rendering for chat messages, headers, etc.
        *   `contentRender.json`: NPM dependencies for `contentRender.js`.
*   **`app/`**: Application-level configuration.
    *   `settings.json`: Core application settings (model, vendor, etc.).
    *   `instructions.txt`: Instructions for the LLM.
    *   `icon.png`: Application icon.

## Backend Dependencies

To use external NPM packages in your backend event handlers (e.g., `onRequest.js`, `onResponse.js`), you must declare them in the corresponding `.json` file.

For example, to use the `mysql2` package in your `onRequest.js` handler:

1.  **Declare in `src/Events/onRequest.json` and `src/Events/onResponse.json`** (as each handler have separate build):
    ```json
    {
      "dependencies": {
        "mysql2": "^3.14.1" // Specify the desired version
      }
    }
    ```

2.  **Import in `src/Events/onRequest.js` (or `actions.js` if shared)**:
    ```javascript
    // Example: src/Events/actions.js
    import mysql from 'mysql2/promise'; // Using the promise-based version

    export const getActions = (meta) => {
        return [
            [/\/?fetchFromDB\("(.*)"\)/, async (match, event) => {
                const connection = await mysql.createConnection({ /* connection details */ });
                const [rows, fields] = await connection.execute('SELECT * FROM your_table WHERE id = ?', [match[1]]);
                await connection.end();
                return { result: rows, ...meta };
            }],
            // ... other actions
        ];
    };
    ```
    Then, import `getActions` into `onRequest.js` or `onResponse.js` as shown in the main documentation.

## Managing Secrets

Sensitive information like API keys or database credentials should never be hardcoded. OpenKBS uses a placeholder syntax `{{secrets.your_secret_name}}` which are replaced at runtime with values you set securely in the OpenKBS platform's file manager for your app.

**Example: Database Connection with Secrets**

Imagine you have secrets named `db_host`, `db_user`, `db_password`, and `db_name` defined in the OpenKBS platform.

You can use them in your backend code (e.g., in `src/Events/actions.js` or a dedicated database module):

```javascript
// Example: src/Events/dbUtils.js (if you create a separate file)
import mysql from 'mysql2/promise';

export async function connectToDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: '{{secrets.db_host}}',
            user: '{{secrets.db_user}}',
            password: '{{secrets.db_password}}',
            database: '{{secrets.db_name}}',
            port: parseInt('{{secrets.db_port_optional_default_3306}}', 10) || 3306 // Example with optional port
        });
        console.log("Successfully connected to the database.");
        return connection;
    } catch (error) {
        console.error("Error connecting to the database:", error);
        throw error; // Re-throw to be handled by the caller
    }
}

```

Remember to define these secrets (`db_host`, `db_user`, etc.) in your application's secrets manager on the OpenKBS platform. The platform injects these values at runtime, keeping your code clean and your credentials secure.