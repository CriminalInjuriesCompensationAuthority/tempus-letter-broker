jest.mock("@aws-sdk/client-sqs", () => ({
    SQSClient: jest.fn().mockImplementation(() => ({
        send: jest.fn(),
    })),
    SendMessageCommand: jest.fn(),
}));

jest.mock("../logger/index.js", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import { sendDeleteMessage, sendSendMessage } from "./index.js";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

describe("SQS service", () => {
    let mockSqsSend;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.LETTER_QUEUE_URL = "https://sqs.example.com/letters";
        mockSqsSend = SQSClient.mock.results[0].value.send;
    });

    it("sends a DELETE message with correct payload and attributes", async () => {
        const payload = {
            userId: "user-1",
            caseReferenceNumber: "case-1",
            letterId: "letter-1",
        };

        await sendDeleteMessage(payload);

        const commandInput = {
            QueueUrl: "https://sqs.example.com/letters",
            MessageBody: expect.stringContaining('"type":"DELETE"'),
            MessageAttributes: {
                MessageType: {
                    DataType: "String",
                    StringValue: "DELETE",
                },
            },
        };

        expect(SendMessageCommand).toHaveBeenCalledWith(expect.objectContaining(commandInput));

        const passedMessageBody = JSON.parse(
            SendMessageCommand.mock.calls[0][0].MessageBody
        );

        expect(passedMessageBody).toMatchObject({
            type: "DELETE",
            userId: "user-1",
            caseReferenceNumber: "case-1",
            letterId: "letter-1",
        });
        expect(new Date(passedMessageBody.requestedAt).toString()).not.toBe("Invalid Date");
        expect(mockSqsSend).toHaveBeenCalledTimes(1);
    });

    it("sends a SEND message with correct payload and attributes", async () => {
        const payload = {
            userId: "user-2",
            caseReferenceNumber: "case-2",
            letterId: "letter-2",
        };

        await sendSendMessage(payload);

        const commandInput = {
            QueueUrl: "https://sqs.example.com/letters",
            MessageBody: expect.stringContaining('"type":"SEND"'),
            MessageAttributes: {
                MessageType: {
                    DataType: "String",
                    StringValue: "SEND",
                },
            },
        };

        expect(SendMessageCommand).toHaveBeenCalledWith(expect.objectContaining(commandInput));

        const passedMessageBody = JSON.parse(
            SendMessageCommand.mock.calls[0][0].MessageBody
        );

        expect(passedMessageBody).toMatchObject({
            type: "SEND",
            userId: "user-2",
            caseReferenceNumber: "case-2",
            letterId: "letter-2",
        });
        expect(new Date(passedMessageBody.requestedAt).toString()).not.toBe("Invalid Date");
        expect(mockSqsSend).toHaveBeenCalledTimes(1);
    });

    it("propagates errors from the SQS client", async () => {
        mockSqsSend.mockRejectedValue(new Error("SQS failed"));

        await expect(
            sendSendMessage({
                userId: "u",
                caseReferenceNumber: "c",
                letterId: "l",
            })
        ).rejects.toThrow("SQS failed");
    });
});
