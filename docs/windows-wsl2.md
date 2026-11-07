# Windows: run the workshop inside WSL2

The stack runs in Linux containers. On Windows that means **Docker Desktop with the
WSL2 backend**, and the repository **inside the WSL2 filesystem**.

1. Install WSL2 and a distribution (Ubuntu): `wsl --install` in an admin PowerShell,
   reboot.
2. Install Docker Desktop → Settings → General: *Use the WSL 2 based engine*;
   Resources → WSL integration: enable your distribution.
3. Give WSL enough memory: `%UserProfile%\.wslconfig`

   ```ini
   [wsl2]
   memory=6GB
   ```

   then `wsl --shutdown` and start the terminal again.
4. In the **Ubuntu (WSL) terminal** — not PowerShell, not Git Bash:

   ```sh
   sudo apt-get update && sudo apt-get install -y make git curl
   cd ~                                    # NOT /mnt/c/…
   git clone https://github.com/fredpalas/otel-incident-lab.git
   cd otel-incident-lab
   make doctor && make pull && make up
   ```

5. Open <http://localhost:3000> in your Windows browser.

## Why inside WSL, and why LF

- Files under `/mnt/c` are on the Windows filesystem: bind mounts from there are slow
  and file changes aren't seen by the containers. `make doctor` warns about it.
- With Git for Windows' default `core.autocrlf=true`, scripts get CRLF line endings
  and break inside Linux. The repo forces LF (`.gitattributes`) and `make doctor`
  checks it; cloning inside WSL avoids the problem altogether.

Editing: VS Code with the *WSL* extension (`code .` from the WSL terminal) edits the
files in place.
