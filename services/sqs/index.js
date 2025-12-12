import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { logger } from "../logger/index.js"

const sqs = new SQSClient({});

async function sendMessage({ messageType, payload }) {
    const messageBody = {
        type: messageType,
        ...payload,
        requestedAt: new Date().toISOString(),
    };

    logger.info(`Sending ${messageType} message to SQS`, {
        queueUrl: process.env.LETTER_QUEUE_URL,
        payload,
    });

    await sqs.send(
        new SendMessageCommand({
            QueueUrl: process.env.LETTER_QUEUE_URL,
            MessageBody: JSON.stringify(messageBody),
            MessageAttributes: {
                MessageType: {
                    DataType: "String",
                    StringValue: messageType,
                },
            },
        })
    );

    logger.info(`${messageType} message sent successfully`, payload)
}

export async function sendDeleteMessage({ userId, caseReferenceNumber, letterId }) {
    return sendMessage({
        messageType: 'DELETE',
        payload: { userId, caseReferenceNumber, letterId },
    })
}

export async function sendSendMessage({ key }) {
    return sendMessage({
        messageType: 'SEND',
        payload: { key },
    })
}
