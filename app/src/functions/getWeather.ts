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

const temperatures = [60, 65, 70, 75, 80, 85];
const descriptions = ["sunny", "cloudy", "rainy", "stormy", "windy"];

const queueOutput = output.storageQueue({
    queueName: outputQueueName,
    connection: 'STORAGE_CONNECTION',
});

export async function processQueueTrigger(queueItem: QueueItem, context: InvocationContext): Promise<ProcessedQueueItem> {
    context.log('QUEUE:', queueItem);

    const randomTemp = temperatures[Math.floor(Math.random() * temperatures.length)];
    const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];

    return {
        Value: `${queueItem.location} weather is ${randomTemp} degrees and ${randomDescription}`,
        CorrelationId: queueItem.coorelationId,
    };
}

app.storageQueue('storageQueueTrigger1', {
    queueName: inputQueueName,
    connection: 'STORAGE_CONNECTION',
    extraOutputs: [queueOutput],
    handler: processQueueTrigger,
});