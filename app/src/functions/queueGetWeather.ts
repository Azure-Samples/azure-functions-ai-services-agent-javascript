import type { InvocationContext } from '@azure/functions';
import { app } from '@azure/functions';
import { QueueClient } from '@azure/storage-queue';
import { DefaultAzureCredential } from '@azure/identity';

interface QueueItem {
  location: string;
  CorrelationId: string;
}

const temperatures = [60, 65, 70, 75, 80, 85];
const descriptions = ['sunny', 'cloudy', 'rainy', 'stormy', 'windy'];

export async function processQueueTrigger(
  queueItem: QueueItem,
  context: InvocationContext
): Promise<void> {
  context.log('QUEUE:', JSON.stringify(Object.keys(queueItem)));
  const { location, CorrelationId } = queueItem;

  try {
    const queueClient = new QueueClient(
      `${process.env.STORAGE_CONNECTION__queueServiceUri}/output`,
      new DefaultAzureCredential()
    );

    // Simulate processing the queue item
    const randomTemp =
      temperatures[Math.floor(Math.random() * temperatures.length)];
    const randomDescription =
      descriptions[Math.floor(Math.random() * descriptions.length)];

    // Prepare the result for the output queue
    const result = {
      Value: `${location} weather is ${randomTemp} degrees and ${randomDescription}`,
      CorrelationId
    };
    const messageContent = Buffer.from(JSON.stringify(result)).toString(
      'base64'
    );
    await queueClient.sendMessage(messageContent);

    context.log('QUEUE RESULT:', JSON.stringify(Object.keys(result)));

    context.log(
      `Sent message to queue: output with message ${JSON.stringify(result)}`
    );
  } catch (error) {
    context.error(`QUEUE Error: ${JSON.stringify(error)}`);
  }
}

app.storageQueue('storageQueueTrigger1', {
  queueName: 'input',
  connection: 'STORAGE_CONNECTION',
  handler: processQueueTrigger
});
