import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { initializeClient } from "../init";
import type { MessageTextContentOutput } from "@azure/ai-projects";

interface PromptRequestBody {
    prompt: string;
}

export async function promptHttpTrigger(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`HTTP "${req.url}"`);

    try {

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
            context.log("No prompt provided in the request body.");

            return {
                status: 400,
                body: "Please provide a 'prompt' in the request body."
            };
        }
        context.log(`HTTP body.prompt: ${body.prompt}`);

        const { projectClient, thread, agent } = await initializeClient();

        const message = await projectClient.agents.createMessage(
            thread.id,
            {
                role: "user",
                content: body?.prompt
            });
        context.log(`Created message, message ID: ${message.id}`);

        let run = await projectClient.agents.createRun(
            thread.id,
            agent.id
        );
        context.log(`Created run, run ID: ${run.status}`);

        while (["queued", "in_progress", "requires_action"].includes(run.status)) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            run = await projectClient.agents.getRun(thread.id, run.id);
            context.log(`Created run, run ID: ${run.id}, status: ${run.status}`);
        }

        context.log(`Run finished with status: ${run.status}`);

        if (run.status === "failed") {
            context.error(`Run failed: ${run.lastError}`);
        }

        const { data: messages } = await projectClient.agents.listMessages(thread.id);

        context.log(`Messages received: ${messages.length}`);
        context.log(`First message: ${JSON.stringify(messages[0])}`);

        const assistantMessage = messages.find((msg) => msg.role === "assistant");
        const responseText = assistantMessage?.content
        ?.filter((item: MessageTextContentOutput) => item.type === "text" && item.text?.value)
        ?.map((item: MessageTextContentOutput) => item.text.value)
        ?.join(" ") || "No response from the assistant.";

        context.log(`Assistant response: ${responseText}`);

        await projectClient.agents.deleteAgent(agent.id);
        context.log("Deleted agent");

        const result = { body: responseText || "No response from the assistant." };
        context.log(`PROMPT Result: ${JSON.stringify(result)}`);

        return result;
    } catch (error) {
        context.error(`PROMPT  Error: ${JSON.stringify(error)}`);
        return {
            status: 500,
            body: "An error occurred while processing your request."
        };
    }
};

app.http('prompt', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: promptHttpTrigger
});
