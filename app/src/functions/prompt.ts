import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { initializeClient } from "../init";

interface PromptRequestBody {
    prompt: string;
}

export async function promptHttpTrigger(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${req.url}"`);

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
        body = req.body && typeof req.body === "object" && "prompt" in req.body ? req.body as PromptRequestBody : undefined;
    }

if (!body?.prompt) {
       return {
            status: 400,
            body: "Please provide a 'prompt' in the request body."
        };
    }

    const { projectClient, thread, agent } = await initializeClient();

    const message = await projectClient.agents.createMessage(
        thread.id,
        {role: "user",
        content: body?.prompt
    });
    context.log(`Created message, message ID: ${message.id}`);

    let run = await projectClient.agents.createRun(
        thread.id,
        agent.id
    );

    while (["queued", "in_progress", "requires_action"].includes(run.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        run = await projectClient.agents.getRun(thread.id, run.id);
    }

    context.log(`Run finished with status: ${run.status}`);

    if (run.status === "failed") {
        context.error(`Run failed: ${run.lastError}`);
    }

    const { data: messages } = await projectClient.agents.listMessages(thread.id);

    const lastMessage = messages.find((msg:any) => msg.sender === "assistant");

    let lastMessageContent: string="";
    if (lastMessage) {
        lastMessageContent = lastMessage.content.join(", ");
        context.log(`Last Message: ${lastMessageContent}`);
    }

    await projectClient.agents.deleteAgent(agent.id);
    context.log("Deleted agent");


    return { body: lastMessageContent || "No response from the assistant." };
};

app.http('httpTrigger1', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: promptHttpTrigger
});
