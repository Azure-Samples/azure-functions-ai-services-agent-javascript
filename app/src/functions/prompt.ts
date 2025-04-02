import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { initializeClient } from "../config/initialize";

interface PromptRequestBody {
    prompt: string;
}

// HTTP trigger function
export async function promptHttpTrigger(request: HttpRequest, context: InvocationContext): Promise<void> {
    context.log("HTTP trigger function processed a request.");

    let body: PromptRequestBody | undefined;
    if (req.body instanceof ReadableStream) {
        const reader = req.body.getReader();
        const decoder = new TextDecoder();
        const chunks: string[] = [];
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                chunks.push(decoder.decode(value, { stream: !done }));
            }
        }

        body = JSON.parse(chunks.join("")) as PromptRequestBody;
    } else if (typeof req.body === "string") {
        body = JSON.parse(req.body) as PromptRequestBody;
    } else {
        body = typeof req.body === "object" && "prompt" in req.body ? req.body as PromptRequestBody : undefined;
    }

    if (!body?.prompt) {
        context.res = {
            status: 400,
            body: "Please provide a 'prompt' in the request body."
        };
        return;
    }

    const { projectClient, thread, agent } = await initializeClient();

    const message = await projectClient.agents.createMessage({
        threadId: thread.id,
        role: "user",
        content: prompt
    });
    context.log(`Created message, message ID: ${message.id}`);

    let run = await projectClient.agents.createRun({
        threadId: thread.id,
        assistantId: agent.id
    });

    while (["queued", "in_progress", "requires_action"].includes(run.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        run = await projectClient.agents.getRun(thread.id, run.id);
    }

    context.log(`Run finished with status: ${run.status}`);

    if (run.status === "failed") {
        context.log.error(`Run failed: ${run.lastError}`);
    }

    const messages = await projectClient.agents.getMessages(thread.id);
    const lastMessage = messages.find((msg) => msg.sender === "assistant");

    if (lastMessage) {
        context.log(`Last Message: ${lastMessage.text?.value}`);
    }

    await projectClient.agents.deleteAgent(agent.id);
    context.log("Deleted agent");

    context.res = {
        body: lastMessage?.text?.value || "No response from the assistant."
    };
};

export { prompt };