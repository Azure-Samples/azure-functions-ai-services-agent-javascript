import type { InvocationContext } from "@azure/functions";
import { app, output } from '@azure/functions';


const inputQueueName = "input";
const outputQueueName = "output";

interface QueueItem {
    location: string;
    coorelationId: string;
}

interface ProcessedQueueItem {
    Value: string;
    CorrelationId: string;
}

const queueOutput = output.storageQueue({
    queueName: outputQueueName,
    connection: 'STORAGE_CONNECTION',
});

export async function processQueueTrigger(queueItem: QueueItem, context: InvocationContext): Promise<ProcessedQueueItem> {
    context.log('Processing incoming queue item:', queueItem);

    return {
        Value: 'Weather is 74 degrees and sunny in ' + queueItem.location,
        CorrelationId: queueItem.coorelationId,
    };
}

app.storageQueue('storageQueueTrigger1', {
    queueName: inputQueueName, 
    connection: 'STORAGE_CONNECTION',
    extraOutputs: [queueOutput],
    handler: processQueueTrigger,
});