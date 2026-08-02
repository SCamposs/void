# VOID Mind local setup

VOID Mind is a general-purpose conversational AI that talks to a local `llama-server`. It does not include cloud inference, paid APIs, accounts, telemetry, model downloads, or autonomous tools.

## Prepare llama.cpp on Windows

1. Open the official [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases).
2. Download a Windows x64 build that includes `llama-server.exe`. For an AMD RX 6600, prefer a Vulkan-enabled build. Keep a CPU build available as a fallback.
3. Extract the release into a user-controlled folder such as `D:\AI\llama.cpp`. Do not place it inside the VOID installation directory.
4. Obtain a compatible instruct/chat GGUF from a source you trust. Review its license, size, prompt template, and published checksum before downloading it.
5. Store models outside the repositories and installer, for example `D:\AI\models\model-name-q4_k_m.gguf`.

VOID never downloads either file silently.

## Launch A0 with external-server mode

Open PowerShell in the llama.cpp folder and run:

```powershell
.\llama-server.exe --model "D:\AI\models\model-name-q4_k_m.gguf" --host 127.0.0.1 --port 8080 --ctx-size 4096 --n-gpu-layers 24
```

Then:

1. Open **Mind** in VOID.
2. Choose **Use running server**.
3. Keep the endpoint at `http://127.0.0.1:8080` and select **Test local server**.
4. When health and model discovery succeed, VOID labels the first detected compatible model as provisional **A0**.
5. Select **Open VOID Mind**.
6. Open **Controls → Model Manager → Import manifest** if the model has a VOID Mind manifest. Until then, the UI says **Manifest not imported** and does not invent lineage or hashes.

If the model does not fit in VRAM, lower `--n-gpu-layers`. Use `0` for CPU-only execution. If memory pressure remains, lower `--ctx-size` to `2048` or choose a smaller quantization/model. Increase settings only after a stable conversation succeeds.

## Launch A0 with managed mode

1. Open **Mind** and choose **Let VOID start it**.
2. Select the exact `llama-server.exe` file and a local `.gguf` file.
3. Set context and GPU layers. Start with `4096` and `24` for the RX 6600, then tune down if loading fails.
4. Select **Start local runtime**. VOID validates both paths, reserves the loopback port, and launches only that executable with fixed llama.cpp arguments.
5. Use **Controls → Runtime → Stop runtime** to unload the model and stop the managed process.

Managed mode always binds `127.0.0.1`, refuses executable names other than `llama-server`, prevents duplicate processes, hides the child console on Windows, detects early crashes during startup, and stops the child when VOID exits.

## Create and import an A1

In the sibling `void-mind` repository:

```powershell
uv sync --extra dev
uv run mind dataset validate samples/datasets/tiny-conversations.jsonl
uv run mind train dry-run samples/train/qlora-dry-run.json
uv run mind manifest create "D:\AI\models\void-mind-a1.manifest.json" "D:\AI\models\void-mind-a1-q4_k_m.gguf" --name "VOID Mind" --version A1 --base "upstream/base-model" --source "https://source.example/base-model" --license "MODEL-LICENSE" --quantization Q4_K_M --language pt-BR --language en --context 4096 --chat-template llama3
```

Training, adapter merge, export, and quantization are never started by the desktop app. The lab artifact commands are previews unless `--run` is supplied and the required local tool exists.

To switch from A0 to A1:

1. Stop the managed runtime, or stop the external `llama-server` process.
2. In **Model Manager**, import the A1 GGUF metadata and select it.
3. Import `void-mind-a1.manifest.json` while A1 is selected.
4. Start the runtime again. In external mode, restart the command with the A1 GGUF path and run **Check local runtime**.
5. Confirm that the UI shows A1, the expected quantization/context, and **Manifest verified** before continuing the conversation.

## Privacy and memory boundaries

- Conversation retention is local and can be disabled, exported, deleted per chat, or reset for the entire Mind module.
- Personal memory is a separate, inspectable future layer. A0 stores no hidden memories, even if the reserved preference is enabled.
- The system prompt, response profile, deterministic input/output policy, model weights, and future memory retrieval remain separate controls.
- Markdown remote images and remote scripts are blocked by the Tauri content security policy. Runtime connections are limited to loopback HTTP origins.
