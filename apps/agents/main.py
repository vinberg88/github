# Copyright (c) Microsoft. All rights reserved.

import asyncio
import os
from contextlib import asynccontextmanager

from agent_framework import Agent, WorkflowBuilder
from agent_framework.foundry import FoundryChatClient
from azure.ai.agentserver.agentframework import from_agent_framework
from azure.identity.aio import AzureCliCredential, ManagedIdentityCredential
from dotenv import load_dotenv

load_dotenv(override=True)

# Configure these for your Foundry project
# Read the explicit variables present in the .env file
FOUNDRY_PROJECT_ENDPOINT = os.getenv(
    "FOUNDRY_PROJECT_ENDPOINT"
)  # e.g., "https://<project>.services.ai.azure.com/api/projects/<project-name>"

# Model recommendations (set FOUNDRY_MODEL in .env to override):
#   gpt-4.1-mini  — default; fast and cost-effective for most drafts
#   gpt-4.1       — higher quality; better reasoning and nuanced edits
#   gpt-4o        — balanced speed and quality; great general-purpose choice
#   gpt-4.1-nano  — cheapest and fastest; good for high-volume, simple content
#   o3-mini       — reasoning model; ideal when the Reviewer needs deeper critique
FOUNDRY_MODEL = os.getenv("FOUNDRY_MODEL", "gpt-4.1-mini")


def get_credential():
    """Use Managed Identity when running in Azure, otherwise fall back to Azure CLI."""
    return ManagedIdentityCredential() if os.getenv("MSI_ENDPOINT") else AzureCliCredential()


@asynccontextmanager
async def create_agents():
    async with get_credential() as credential:
        client = FoundryChatClient(
            project_endpoint=FOUNDRY_PROJECT_ENDPOINT,
            model=FOUNDRY_MODEL,
            credential=credential,
        )
        writer = Agent(
            client=client,
            name="Writer",
            instructions=(
                "You are an expert content writer with a clear, engaging style. "
                "When given a topic or brief, produce well-structured, original content. "
                "When given reviewer feedback, revise your draft to address every point concisely "
                "while preserving your voice. Always output only the revised content — no meta-commentary."
            ),
        )
        reviewer = Agent(
            client=client,
            name="Reviewer",
            instructions=(
                "You are a sharp, constructive content reviewer. "
                "Evaluate the writer's draft against these criteria: clarity, accuracy, tone, and structure. "
                "For each issue found, give a single, actionable instruction (e.g., 'Shorten paragraph 2 to one sentence'). "
                "If the draft meets all criteria, respond with exactly: APPROVED"
            ),
        )
        yield writer, reviewer


def create_workflow(writer: Agent, reviewer: Agent) -> Agent:
    workflow = WorkflowBuilder(start_executor=writer).add_edge(writer, reviewer).build()
    return Agent(client=workflow)


async def main() -> None:
    """
    Writer-Reviewer multi-agent workflow.

    The Writer drafts content based on the user's input; the Reviewer provides
    concise, actionable feedback until the draft is approved.

    Required environment variables (see .env.example):
        FOUNDRY_PROJECT_ENDPOINT  Your Microsoft Foundry project endpoint URL
        FOUNDRY_MODEL             Model deployment name (default: gpt-4.1-mini)
    """
    async with create_agents() as (writer, reviewer):
        agent = create_workflow(writer, reviewer)
        await from_agent_framework(agent).run_async()


if __name__ == "__main__":
    asyncio.run(main())
