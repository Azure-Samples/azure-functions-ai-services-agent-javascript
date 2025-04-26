import {
    AIProjectsClient
} from "@azure/ai-projects";
import type { AgentThreadOutput, AgentOutput } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

// <CreateAgent>
export async function initializeClient():Promise<{
    projectClient: AIProjectsClient,
    agent: AgentOutput
}> {

    const model = "gpt-4o-mini"

    const projectConnectionString = process.env.PROJECT_CONNECTION_STRING as string;
    const storageConnectionString = process.env.STORAGE_CONNECTION__queueServiceUri as string;
    
    if(!projectConnectionString){
        throw new Error("projectConnectionString is empty");
    }

    const projectClient = AIProjectsClient.fromConnectionString(
        projectConnectionString,
        new DefaultAzureCredential(),
    );

    const agent = await projectClient.agents.createAgent(
        model, {
        name: "azure-function-agent-get-weather",
        instructions: "You are a helpful support agent. Answer the user's questions to the best of your ability.",
        requestOptions: {
            headers: { "x-ms-enable-preview": "true" }
        },
        tools: [
            {
                type: "azure_function",
                azureFunction: {
                    function: {
                        name: "GetWeather",
                        description: "Get the weather in a location.",
                        parameters: {
                            type: "object",
                            properties: {
                                location: { type: "string", description: "The location to look up." },
                            },
                            required: ["location"],
                        },
                    },
                    inputBinding: {
                        type: "storage_queue",
                        storageQueue: {
                            queueServiceEndpoint: storageConnectionString,
                            queueName: "input",
                        },
                    },
                    outputBinding: {
                        type: "storage_queue",
                        storageQueue: {
                            queueServiceEndpoint: storageConnectionString,
                            queueName: "output",
                        },
                    },
                },
            },
        ],
    });

    console.log(`Created agent, agent ID: ${agent.id}`);

    return { projectClient, agent };
}
// </CreateAgent>

// <CreateThread>
export async function getThread(projectClient: AIProjectsClient):Promise<AgentThreadOutput>{

    const thread = await projectClient.agents.createThread();
    console.log(`Created thread, thread ID: ${thread.id}`);

    return thread;
} 
// </CreateThread>
