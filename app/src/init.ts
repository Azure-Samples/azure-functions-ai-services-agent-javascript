import {
    AIProjectsClient
} from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import dotenv from 'dotenv';


dotenv.config();

const model = "gpt-4o-mini"
const inputQueueName = "input";
const outputQueueName = "output";
const projectConnectionString = process.env.PROJECT_CONNECTION_STRING as string;
const storageConnectionString = process.env.STORAGE_CONNECTION__queueServiceUri as string;

export async function initializeClient() {

    const projectClient = AIProjectsClient.fromConnectionString(
        projectConnectionString || "",
        new DefaultAzureCredential(),
    );

    const agent = await projectClient.agents.createAgent(
        model, {
        name: "azure-function-agent-get-weather",
        instructions: "You are a helpful support agent. Answer the user's questions to the best of your ability.",
        headers: { "x-ms-enable-preview": "true" },
        tools: [
            {
                type: "azure_function",
                function_tool: {
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
                    input_binding: {
                        type: "storage_queue",
                        storage_queue: {
                            queue_service_uri: storageConnectionString,
                            queue_name: inputQueueName,
                        },
                    },
                    output_binding: {
                        type: "storage_queue",
                        storage_queue: {
                            queue_service_uri: storageConnectionString,
                            queue_name: outputQueueName,
                        },
                    },
                },
            },
        ],
    });

    console.log(`Created agent, agent ID: ${agent.id}`);

    const thread = await projectClient.agents.createThread();
    console.log(`Created thread, thread ID: ${thread.id}`);

    return { projectClient, thread, agent };
}
