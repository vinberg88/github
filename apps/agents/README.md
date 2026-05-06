# Writer-Reviewer Multi-Agent Workflow

A multi-agent workflow built with the [Microsoft Agent Framework SDK](https://github.com/microsoft/agent-framework) and hosted via the [Azure AI AgentServer SDK](https://pypi.org/project/azure-ai-agentserver-agentframework/).

Two AI agents collaborate to produce high-quality content:

1. **Writer** — drafts and revises content based on a user prompt and reviewer feedback.
2. **Reviewer** — evaluates each draft against clarity, accuracy, tone, and structure criteria, issuing concise actionable feedback until the draft is approved.

---

## Model recommendations

The default model is `gpt-4.1-mini`. Choose a different model by setting `FOUNDRY_MODEL` in your `.env` file.

| Model | Best for | Notes |
|---|---|---|
| `gpt-4.1-mini` | **Default** — fast, cost-effective everyday drafts | Good balance of speed and quality |
| `gpt-4.1` | High-quality long-form content | Stronger reasoning; higher cost |
| `gpt-4o` | General-purpose, balanced workloads | Great speed-to-quality ratio |
| `gpt-4.1-nano` | High-volume, simple or short content | Cheapest and fastest option |
| `o3-mini` | Detailed, critical reviews | Reasoning model; deeper analysis |

> **Tip:** Use `gpt-4.1-mini` for the Writer (fast iteration) and `o3-mini` for the Reviewer (deeper critique) by running two separate client instances with different `FOUNDRY_MODEL` values.

---

## Prerequisites

1. **Python 3.10 or higher** — `python --version`
2. **Azure CLI** — installed and authenticated (`az login`)
3. **Microsoft Foundry project** with a chat model deployed
   - Grab your project endpoint URL and model deployment name from [Microsoft Foundry](https://ai.azure.com/)

---

## Setup

1. Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   ```
   FOUNDRY_PROJECT_ENDPOINT=https://<your-resource>.services.ai.azure.com/api/projects/<your-project>
   FOUNDRY_MODEL=gpt-4.1-mini
   ```

2. Install dependencies (recommended via [`uv`](https://docs.astral.sh/uv/)):

   ```bash
   uv venv .venv
   uv pip install --prerelease=allow -r requirements.txt
   ```

   Or with plain `venv`:

   ```bash
   python -m venv .venv
   source .venv/bin/activate        # macOS/Linux
   .\.venv\Scripts\Activate.ps1     # Windows PowerShell
   pip install -r requirements.txt
   ```

---

## Running locally

```bash
uv run main.py
# or
python main.py
```

The agent starts on `http://localhost:8088/`.

Send a content brief:

```bash
curl -sS -H "Content-Type: application/json" -X POST http://localhost:8088/responses \
  -d '{"input": "Write a short tagline for an affordable, eco-friendly electric SUV.", "stream": false}'
```

---

## Deploying to Microsoft Foundry

Follow the [hosted-agents deployment guide](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry&tabs=cli) and run:

```bash
azd auth login
azd env new <env-name>
azd up
```

---

## How it works

```
User prompt
    │
    ▼
 Writer ──► drafts content
    │
    ▼
Reviewer ──► feedback or APPROVED
    │
    └── feedback? ──► Writer (revise) ──► Reviewer (re-review) ──► ...
                                                   │
                                               APPROVED
                                                   │
                                                   ▼
                                          Final content returned
```

The `WorkflowBuilder` in `main.py` wires the agents together. Once the Reviewer responds with exactly `APPROVED`, the workflow returns the final draft to the caller.
