# OpenKBS &middot; [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) [![npm version](https://img.shields.io/badge/npm-v0.0.20-orange.svg)](https://www.npmjs.com/package/openkbs)

OpenKBS is an extendable open-source platform designed to build, 
deploy and integrate AI agents anywhere, from websites to IoT devices. 
Its event-driven architecture enables full customization of backend and 
frontend components, while the LLM abstraction layer allows seamless
switching between language models. With its powerful CLI, OpenKBS turns
complex tasks into simple prompt commands, letting developers focus on what matters.

## Table of Contents

- [Install CLI](#install-cli)
- [Create App](#create-app)
- [Deploy](#deploy)
- [Extend Frontend](#extend-frontend)
   - [Chat Render](#chat-render)
   - [Setup Local Development](#setup-local-development)
   - [Use Built-in MUI Components](#use-built-in-mui-components)
   - [AI-Powered Generation](#ai-powered-frontend-generation)
- [Extend Backend](#extend-backend)
- [Framework Documentation](#framework-documentation)
- [License](#license)
- [Contributing](#contributing)
- [Contact](#contact)

## Install CLI

First, ensure you have the OpenKBS CLI installed globally:

```bash
npm install -g openkbs
```

## Create App

Create a new application using the OpenKBS CLI:

```bash
openkbs create my-agent

cd my-agent

git init && git stage . && git commit -m "First commit" 
```

## Deploy

1. Log in to OpenKBS:

   ```bash
   openkbs login
   ```

2. Push your application to OpenKBS:

   ```bash
   openkbs push
   ```

   This command registers your application, uploads, builds and deploys all frontend and backend code. It will respond with an application URL (e.g., `https://{kbId}.apps.openkbs.com/`).

3. Open the provided URL and interact with your application.

## Extend Frontend

Let's enhance your application with additional libraries and features.
For example, to properly render chat messages with Markdown, you can integrate `react-markdown`:

### Chat Render
1. Add `react-markdown` to your dependencies:

   ```bash
   openkbs contentRender i react-markdown
   ```

2. Edit the frontend to use `react-markdown`:

   In `./src/Frontend/contentRender.js`, import `react-markdown`:

   ```js
   import ReactMarkdown from 'react-markdown';
   ```

   Modify the `onRenderChatMessage` function:

   ```js
   const onRenderChatMessage = async (params) => {
       const { content } = params.messages[params.msgIndex];
       return <ReactMarkdown>{content}</ReactMarkdown>;
   };
   ```

3. Ask the AI to 'Write a test plan' in the chat, then Push your changes and refresh to see the `react-markdown` rendering.



   ```bash
   openkbs push
   ```

### Setup Local Development

For faster frontend development, run the OpenKBS UI dev server locally:

   ```bash
   npm i
   npm start
   ```

This command opens a browser pointing to `localhost`, allowing automatic rebuilds of your frontend code locally.

### Use Built-in MUI Components

Enhance your UI with Material-UI components:

1. Import MUI components at the top of `contentRender.js`:

   ```js
   import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
   import { MoreVert as MenuIcon, AccountCircle as AccountIcon } from '@mui/icons-material';
   ```

2. Add this block at the end of the `Header` component inside `contentRender.js`:

   ```js
    return (
        <AppBar position="absolute" style={{ zIndex: 1300, flexGrow: 1, textAlign: 'left' }}>
            <Toolbar>
                <IconButton edge="start" color="inherit" aria-label="menu" style={{ marginRight: '16px' }}>
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    My Agent
                </Typography>
                <IconButton edge="end" color="inherit" aria-label="account">
                    <AccountIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
   ```

3. Observe real-time rendering by refreshing your browser at http://{kbId}.apps.localhost:38593/

4. Push the changes to your remote app instance:

   ```bash
   openkbs push 
   ```

### AI-Powered Frontend Generation

OpenKBS provides simple AI-powered code generation. Use the `openkbs modify` command followed by your requirement:

```bash
openkbs modify "Implementing UI to manage renderSettings"
```

If you need to revert changes:
```bash
git checkout -- .
```

## Extend Backend

## License

This project is licensed under the MIT License. For more details, please refer to the [LICENSE](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) file.

## Contributing

We welcome contributions from the community! Please feel free to submit issues, fork the repository, and send pull requests.

## Contact

For more information, visit our [official website](https://openkbs.com) or join our community discussions on [GitHub](https://github.com/open-kbs/openkbs/discussions).
