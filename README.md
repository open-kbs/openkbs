# OpenKBS &middot; [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) [![npm version](https://img.shields.io/badge/npm-v0.0.10-orange.svg)](https://www.npmjs.com/package/openkbs)

OpenKBS is an open-source platform for building and deploying AI agents and applications. Our mission is to provide developers with a flexible and powerful framework that empowers them to create advanced AI agents with ease, using simple text prompts to specify requirements.

### Last Updates
- openkbs-ai-server: added support for stable-diffusion-3.5-large

### Table of Contents


- [Creating Your First AI Agent Manually](#creating-your-first-ai-agent-manually)
    - [Step 1: Install CLI](#step-1-install-cli)
    - [Step 2: Create new Application](#step-2-create-new-application)
    - [Step 3: Understand the Project Structure](#step-3-understand-the-project-structure)
    - [Step 4: Deploy Your Application](#step-4-deploy-your-application)
    - [Step 5: Enhance Your Application](#step-5-enhance-your-application)
    - [Step 6: Local Development](#step-6-local-development)
    - [Step 7: Use Built-in MUI Components](#step-7-use-built-in-mui-components)
    - [Step 8: Running the Backend Locally (On-Premises)](#step-8-running-the-backend-locally-on-premises)
- [Installing openkbs-ai-server and Integrating Llama 3.1 and Stable Diffusion 3 Locally](#installing-openkbs-ai-server-and-integrating-llama-31-and-stable-diffusion-3-locally)
- [License](#license)
- [Contributing](#contributing)
- [Contact](#contact)

## Installation

This module needs to be installed globally, so use the `-g` flag when installing:

```bash
npm install -g openkbs
```
![ai1.png](examples%2Fcloud-master%2Fai1.png)

## Key Features

[//]: # (- **Generative AI First**: An intuitive development interface designed for human beings. Employs generative AI tools to streamline the development life cycle, enabling rapid requirements gathering, system design, and deployment.)
- **Seamless LLM Integration**: LLM abstraction layer providing a unified interface for various LLM vendors, such as OpenAI, Anthropic, and open-source models like LLaMA and Mistral. This layer allows one-click switching between LLMs without modifying source code, enabling seamless testing across models.
- **Extensive Tooling**: Utilize a broad range of AI tools and services to build robust, scalable AI agents. This includes code execution, database engines, web browsing, image generation, embedding models, speech synthesis, and recognition. These tools enable LLMs to operate autonomously, with more resources continually being added.
- **Open Source**: Provides developers with the freedom to customize, modify, and distribute the software freely.

---


## Creating Your First AI Agent Manually

Follow these steps to create and deploy your first OpenKBS app using React and Node.js, 

### Step 1: Install CLI

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



### Step 2: Create New Application

Create a new application using the OpenKBS CLI:

```bash
openkbs create my-pc-agent
```

Navigate into your newly created application directory:

```bash
cd my-pc-agent
```

### Step 3: Understand the Project Structure

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
### Step 4: Deploy Your Application

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

### Step 5: Enhance Your Application

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

### Step 6: Local Development

For faster frontend development, run the OpenKBS UI dev server locally:

   ```bash
   npm i
   npm start
   ```

This command opens a browser pointing to `localhost`, allowing automatic rebuilds of your frontend code locally.

### Step 7: Use Built-in MUI Components

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

### Step 8: Running the Backend Locally (On-Premises)

To run the backend services of your AI application locally, follow these steps. This allows you to manage chat services, code execution, and AI LLM services on your own infrastructure.

#### Running the Chat Service Locally

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
   - You can remove the cloud models options by setting `"enableCloudModels": false` in `config.json`

#### Running the Code Execution Service Locally

1. **Start the Code Execution Service**:
   - Open another terminal tab, navigate to the root folder of your KB app, and run:

     ```bash
     npm run code
     ```

2. **Enter Secrets**:
   - You may be prompted to enter any secret placeholders in your `./src/Events/actions.js`. By default, this includes `googlesearch_api_key` and `googlesearch_engine_id`.
   - You can press enter to skip, but for using Google Search as an AI tool, it's recommended to fill them. Google provides 100 free searches per day.

Congratulations! The LLM can now execute NodeJS code directly on your machine!

#### Enhancing Your Application with Code Execution

To utilize the code execution feature, follow these steps:

1. **Update `contentRender.js`**:
    - Modify your local `contentRender.js` file to match the version found at [contentRender.js](./examples/cloud-master/contentRender.js). This update will provide the necessary UI components for local code execution and response rendering.

2. **Update `instructions.txt`**:
    - Edit your local `instructions.txt` file to include the instructions found at [instructions.txt](./examples/cloud-master/instructions.txt). These instructions will guide the LLM on how to output code and other API commands for execution by the OpenKBS framework.
   
3. **Push the new instructions**:
   - we have to push the instructions which are stored encrypted at OpenKBS registry:
     ```bash
     openkbs push origin app/instructions.txt 
     ```
   - push to localstack to build and deploy all Node.js events - ./src/Events
     ```bash
     openkbs push localstack
     ```
4. **Requesting the AI to Perform Tasks on Your PC and AWS Cloud**:
   - Instruct the AI to list your desktop files, review the code, click `execute`, and click `send`:
        ```
        List my desktop files
        ```
   - Instruct the AI to create an S3 bucket and backup your desktop images to it:
        ```
        Create an S3 bucket and back up my desktop images to it
        ```
![backup.png](examples%2Fcloud-master%2Fbackup.png)
---

## Installing openkbs-ai-server and Integrating Llama 3.1 and Stable Diffusion 3 Locally

![llama-loaded.png](examples%2Fcloud-master%2Fllama-loaded.png)

To set up the `openkbs-ai-server` and integrate advanced AI models like Llama 3.1 and Stable Diffusion 3 on your local machine, follow the steps outlined below.

### Prerequisites

Ensure you have the following prerequisites installed and configured:

- Ubuntu 22.04 or a compatible Linux distribution.
- Python 3.10 and virtual environment tools.
- Node.js and npm.
- NVIDIA or AMD GPU drivers, depending on your hardware.

Please follow the installation on [GitHub](https://github.com/open-kbs/openkbs-ai-server).

### Step 1: Checkout, Build, and Run

Clone the `openkbs-ai-server` repository and set up the environment:

```bash
git clone git@github.com:open-kbs/openkbs-ai-server.git
cd openkbs-ai-server/cluster
npm i
cd ..
python -m venv .env
source .env/bin/activate
```

**IMPORTANT: SELECT THE CORRECT GPU INSTRUCTIONS BELOW. DO NOT EXECUTE BOTH.**

#### **FOR AMD GPUS:**

**ONLY FOLLOW THESE INSTRUCTIONS IF YOU HAVE AN AMD GPU.**

Install necessary libraries and Python packages:

```bash
sudo apt-get install -y libjpeg-dev libpng-dev
pip install wheel setuptools
pip install --pre torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/rocm6.1/
pip install -r ./models/requirements_AMD.txt
```

#### **FOR NVIDIA GPUS:**

**ONLY FOLLOW THESE INSTRUCTIONS IF YOU HAVE AN NVIDIA GPU.**

Install the required Python packages:

```bash
pip install torch
pip install -r ./models/requirements_NVIDIA.txt
```

### Step 2: Configure Hugging Face Authentication

Log in to Hugging Face to access the AI models:

```bash
huggingface-cli login
```

Enter your Hugging Face token when prompted.

### Step 3: Install Global Node.js Packages

Install global Node.js packages required for running the server:

```bash
npm install -g pm2 nodemon react-scripts
```

### Step 4: Start the AI Server

Launch the AI server using the provided script:

```bash
./start.sh
```

This command will start both the frontend and backend services using pm2. Your default web browser should automatically open to [http://localhost:7080/register](http://localhost:7080/register), where you can register the admin account for the AI server.

### Step 5: Install AI Models

In the AI server admin panel, search for and install the following models:

- **Llama-3.1-8B-Instruct**: Ensure you have access to [Llama-3.1-8B-Instruct](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct) on Hugging Face.
- **Stable Diffusion 3**: Ensure you have access to [Stable Diffusion 3](https://huggingface.co/stabilityai/stable-diffusion-3-medium) on Hugging Face.

After installation, restart your chat server to apply the changes.

### Step 6: Integrate Stable Diffusion under Events actions, so that Llama can call it

Go to your app root folder
```bash
cd my-pc-agent
```

Add to `./src/Events/actions.js`
```javascript
    [/\/?textToImage\("(.*)"\)/, async (match) => {
        try {
            const response = await axios.get(`http://localhost:8080/pipe/stabilityai--stable-diffusion-3-medium-diffusers--default?prompt=${encodeURIComponent(match[1])}`, {
                responseType: 'arraybuffer'
            });

            const base64Data = Buffer.from(response.data, 'binary').toString('base64');
            const contentType = response.headers['content-type'];
            const imageSrc = `data:${contentType};base64,${base64Data}`;

            return { type: 'SAVED_CHAT_IMAGE', imageSrc, ...meta };
        } catch (error) {
            console.error('Error fetching image:', error);
            throw error; // or handle the error as needed
        }
    }]
```

Push the changes:
```bash
openkbs push localstack
```
### Step 7: Test Llama agent

Once the models are installed and the server is running, select `Llama-3.1-8B-Inst` in your Chat Models selection and type in the chat:

```
Hey Llama, search Google for the latest AI news and wait, then generate news image. Finally, use a template function to create an HTML page hosted on the S3 bucket 'ai-news-openkbs'.
```

![ai1.png](examples%2Fcloud-master%2Fai1.png)

![llama-loaded.png](examples%2Fcloud-master%2Fllama-loaded.png)

![sd3-loaded.png](examples%2Fcloud-master%2Fsd3-loaded.png)

![ai2.png](examples%2Fcloud-master%2Fai2.png)

![ai3.png](examples%2Fcloud-master%2Fai3.png)
Have fun!

---

## License

This project is licensed under the MIT License. For more details, please refer to the [LICENSE](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) file.

## Contributing

We welcome contributions from the community! Please feel free to submit issues, fork the repository, and send pull requests.

## Contact

For more information, visit our [official website](https://openkbs.com) or join our community discussions on [GitHub](https://github.com/open-kbs/openkbs/discussions).
