# OpenKBS &middot; [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) [![npm version](https://img.shields.io/badge/npm-v0.0.10-orange.svg)](https://www.npmjs.com/package/openkbs)

OpenKBS is an open-source platform for building and deploying AI agents and applications. Our mission is to provide developers with a flexible and powerful framework that empowers them to create advanced AI agents with ease, using simple text prompts to specify requirements.

## Installation

This module needs to be installed globally, so use the `-g` flag when installing:

```bash
npm install -g openkbs
```

## Key Features

- **Generative AI First**: An intuitive development interface designed for human beings. Employs generative AI tools to streamline the development life cycle, enabling rapid requirements gathering, system design, and deployment.
- **Seamless LLM Integration**: LLM abstraction layer providing a unified interface for various LLM vendors, such as OpenAI, Anthropic, and open-source models like LLaMA and Mistral. This layer allows one-click switching between LLMs without modifying source code, enabling seamless testing across models.
- **Extensive Tooling**: Utilize a broad range of AI tools and services to build robust, scalable AI agents. This includes code execution, database engines, web browsing, image generation, embedding models, speech synthesis, and recognition. These tools enable LLMs to operate autonomously, with more resources continually being added.
- **Open Source**: Provides developers with the freedom to customize, modify, and distribute the software freely.

---

## Get Started

### Creating Your First KB

Follow these steps to create and deploy your first OpenKBS application.

#### Step 1: Install the OpenKBS CLI

First, ensure you have the OpenKBS CLI installed globally:

```bash
npm install -g openkbs
```

#### Step 2: Create a Local Knowledge Base Application

Create a new application using the OpenKBS CLI:

```bash
openkbs create my-pc-agent
```

Navigate into your newly created application directory:

```bash
cd my-pc-agent
```

#### Step 3: Understand the Project Structure

Your application will have the following structure:

- `./app/icon.png`: Application icon.
- `./app/settings.json`: Application settings.
- `./app/instructions.txt`: Agent instructions.
- `./src/Events/actions.js`: Contains all backend actions (LLM commands).
- `./src/Events/onRequest.js`: Event handler that executes a command on user input.
- `./src/Events/onRequest.json`: Contains all npm package dependencies for onRequest module.
- `./src/Events/onResponse.js`: Similar to `onRequest.js`, but executed against LLM output.
- `./src/Events/onResponse.json`: Contains all npm package dependencies for onResponse module.
- `./src/Frontend/contentRender.js`: Contains frontend components of your application.
- `./src/Frontend/contentRender.json`: Contains all npm package dependencies for contentRender module.
#### Step 4: Deploy Your Application

You have two options for deployment: OpenKBS Cloud or LocalStack.

##### Deploy to OpenKBS Cloud

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

#### Step 5: Enhance Your Application

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

#### Step 6: Local Development

For faster frontend development, run the OpenKBS UI dev server locally:

   ```bash
   npm i
   npm start
   ```

This command opens a browser pointing to `localhost`, allowing automatic rebuilds of your frontend code locally.

#### Step 7: Use Built-in MUI Components

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

---

#### Step 8: Running the Backend Locally (On-Premises)

To run the backend services of your AI application locally, follow these steps. This allows you to manage chat services, code execution, and AI LLM services on your own infrastructure.

##### Running the Chat Service Locally

1. **Start the Chat Service**:
   - Open a new terminal and navigate to the root folder of your application.
   - Run the following command:

     ```bash
     npm run chat
     ```

   - If LocalStack is not installed, you will receive instructions on how to install it based on your platform.
   - Open another terminal, navigate to `/tmp`, and install LocalStack using the suggested commands and retrun `npm run chat`


4. **Configure OpenAI Key**:
   - Enter your `OPENAI_KEY` when prompted. This key will be stored at `~/.openkbs/.env`.

5. **Access the Local Chat Service**:
   - Refresh your browser at `http://{kbId}.apps.localhost:38593/chat`.
   - You will see "On-Premises" in green text, indicating that your OpenKBS instance is using the local chat server to communicate with the OpenAI streaming API.

##### Running the Code Execution Service Locally

1. **Start the Code Execution Service**:
   - Open another terminal tab, navigate to the root folder of your KB app, and run:

     ```bash
     npm run code
     ```

2. **Enter Secrets**:
   - You may be prompted to enter any secret placeholders in your `./src/Events/actions.js`. By default, this includes `googlesearch_api_key` and `googlesearch_engine_id`.
   - You can press enter to skip, but for using Google Search as an AI tool, it's recommended to fill them. Google provides 100 free searches per day.

Congratulations! The LLM can now execute NodeJS code directly on your machine!

##### Enhancing Your Application with Code Execution

To utilize the code execution feature, follow these steps:

1. **Edit local `contentRender.js`**:
   - Update your local `contentRender.js` to match [contentRender.js](./examples/cloud-master/contentRender.js), which provides UI for local code execution and response rendering:

   
2. **Edit local `instructions.txt`**:
   - Set the following instruction [instructions.txt](./examples/cloud-master/instructions.txt):

3. **Push the new instructions**:
   - frontend changes are updated automatically, however we have to push the instructions which are stored encrypted at OpenKBS registry:
     ```bash
     openkbs push origin app/instructions.txt
     ```

4. **Requesting the AI to Perform Tasks on Your PC and AWS Cloud**:
   - Instruct the AI to list your desktop files, review the code, click `execute`, and click `send`:
        ```
        List my desktop files
        ```
   - Instruct the AI to create an S3 bucket and back up your desktop images to it:
        ```
        Create an S3 bucket and back up my desktop images to it
        ```


---

Create some S3 bucket and backup my desktop images there



## License

This project is licensed under the MIT License. For more details, please refer to the [LICENSE](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) file.

## Contributing

We welcome contributions from the community! Please feel free to submit issues, fork the repository, and send pull requests.

## Contact

For more information, visit our [official website](https://openkbs.com) or join our community discussions on [GitHub](https://github.com/open-kbs/openkbs/discussions).
