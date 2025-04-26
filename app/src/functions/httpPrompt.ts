import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { initializeClient, getThread } from "../azureProjectInit";
import type { MessageTextContentOutput } from "@azure/ai-projects";

interface PromptRequestBody {
    prompt: string;
}

export async function promptHttpTrigger(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`HTTP "${req.url}"`);

    try {

        let body = await req.json() as PromptRequestBody;

        if (!body?.prompt) {
            context.log("No prompt provided in the request body.");

            return {
                status: 400,
                body: "Please provide a 'prompt' in the request body."
            };
        }
        context.log(`HTTP body.prompt: ${body.prompt}`);

        const { projectClient, agent } = await initializeClient();
        const thread = await getThread(projectClient);

        // <CreateMessage>
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
        // </CreateMessage>

        if (run.status === "failed") {
            context.error(`Run failed: ${run.lastError}`);
        }

        // <ListMessages>
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
        // </ListMessages>

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
