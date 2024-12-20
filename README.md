# OpenKBS &middot; [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) [![npm version](https://img.shields.io/badge/npm-v0.0.19-orange.svg)](https://www.npmjs.com/package/openkbs)

OpenKBS is an open-source platform for building and deploying AI agents. Our mission is to provide developers with a flexible and powerful framework that empowers them to create advanced AI agents, using simple text prompts to specify requirements.

### Last Updates

### Table of Contents

- [Install CLI](#install-cli)
- [Create new Application](#create-new-application)
- [Deploy Your Application](#deploy-your-application)
- [Enhance Your Application](#enhance-your-application)
- [Local Development](#local-development)
- [Use Built-in MUI Components](#use-built-in-mui-components)
- [License](#license)
- [Contributing](#contributing)
- [Contact](#contact)

## Creating Your First AI Agent Manually

Follow these steps to create and deploy your first OpenKBS app using React and Node.js, 

### Install CLI

First, ensure you have the OpenKBS CLI installed globally:

- **Option 1: using NPM**
```bash
npm install -g openkbs
```

- **Option 2: Download Binary**

  - **Linux (x64):**
    ```bash
    wget -O ~/Downloads/openkbs https://downloads.openkbs.com/cli/linux/openkbs && chmod +x ~/Downloads/openkbs && sudo mv ~/Downloads/openkbs /usr/local/bin/openkbs
    ```
  - **Windows (x64):**
    ```powershell
    Invoke-WebRequest -Uri "https://downloads.openkbs.com/cli/windows/openkbs.exe" -OutFile "$Env:USERPROFILE\Downloads\openkbs.exe"
    $Env:Path += ";$Env:USERPROFILE\Downloads"
    ```
    
  - **Mac (new M series):**
    ```bash
    curl -o ~/Downloads/openkbs https://downloads.openkbs.com/cli/macos/openkbs && mkdir -p /usr/local/bin && chmod +x ~/Downloads/openkbs && sudo mv ~/Downloads/openkbs /usr/local/bin/openkbs
    ```
  - **Mac (old models):**
    ```bash
    curl -o ~/Downloads/openkbs https://downloads.openkbs.com/cli/macos/openkbs-x64 && mkdir -p /usr/local/bin && chmod +x ~/Downloads/openkbs && sudo mv ~/Downloads/openkbs /usr/local/bin/openkbs
    ```



### Create New Application

Create a new application using the OpenKBS CLI:

```bash
openkbs create my-pc-agent
```

Navigate into your newly created application directory:

```bash
cd my-pc-agent
```

### Deploy Your Application

You have two options for deployment: OpenKBS Cloud or LocalStack.

#### Deploy to OpenKBS Cloud

1. Log in to OpenKBS:

   ```bash
   openkbs login
   ```

2. Push your application to OpenKBS Cloud:

   ```bash
   openkbs push
   ```

   This command registers your application, uploads, builds and deploys all frontend and backend code. It will respond with an application URL (e.g., `https://{kbId}.apps.openkbs.com/`).

3. Open the provided URL and interact with your application.

### Enhance Your Application

To improve your application's rendering, you can use libraries like `react-markdown` for example.

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

### Local Development

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
        <AppBar position="absolute" style={{ zIndex: 2000, flexGrow: 1, textAlign: 'left' }}>
            <Toolbar>
                <IconButton edge="start" color="inherit" aria-label="menu" style={{ marginRight: '16px' }}>
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    My PC Agent
                </Typography>
                <IconButton edge="end" color="inherit" aria-label="account">
                    <AccountIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
   ```

3. Observe real-time rendering by refreshing your browser at http://{kbId}.apps.localhost:38593/

4. Push the changes to your remote KB:

   ```bash
   openkbs push 
   ```

## License

This project is licensed under the MIT License. For more details, please refer to the [LICENSE](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) file.

## Contributing

We welcome contributions from the community! Please feel free to submit issues, fork the repository, and send pull requests.

## Contact

For more information, visit our [official website](https://openkbs.com) or join our community discussions on [GitHub](https://github.com/open-kbs/openkbs/discussions).
