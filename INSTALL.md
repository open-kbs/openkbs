- **Download CLI Binary**

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