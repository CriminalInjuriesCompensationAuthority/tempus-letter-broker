// services/sqs/index.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import esmock from "esmock";

const MODULE_PATH = "./index.js";
const LOGGER_PATH = "../logger/index.js";

function makeAwsSqsFixtures({ sendImpl } = {}) {
    const calls = [];
    const sqsSend = mock.fn(sendImpl ?? (async () => undefined));

    class SQSClient {
        constructor() {
            this.send = sqsSend;
        }
    }

    class SendMessageCommand {
        constructor(input) {
            this.input = input;
            calls.push(input);
        }
    }

    return { calls, sqsSend, SQSClient, SendMessageCommand };
}

function makeLoggerFixture() {
    return {
        info: mock.fn(),
        warn: mock.fn(),
        error: mock.fn(),
        debug: mock.fn(),
    };
}

async function loadSqsService({ SQSClient, SendMessageCommand, logger }) {
    return esmock(MODULE_PATH, {
        "@aws-sdk/client-sqs": { SQSClient, SendMessageCommand },
        [LOGGER_PATH]: { logger },
    });
}

test("SQS service", async (t) => {
    const originalQueueUrl = process.env.LETTER_QUEUE_URL;

    t.beforeEach(() => {
        process.env.LETTER_QUEUE_URL = "https://sqs.example.com/letters";
    });

    t.afterEach(() => {
        process.env.LETTER_QUEUE_URL = originalQueueUrl;
    });

    await t.test("sends a DELETE message with correct payload and attributes", async () => {
        const { calls, sqsSend, SQSClient, SendMessageCommand } = makeAwsSqsFixtures();
        const logger = makeLoggerFixture();

        const { sendDeleteMessage } = await loadSqsService({
            SQSClient,
            SendMessageCommand,
            logger,
        });

        await sendDeleteMessage({
            userId: "user-1",
            caseReferenceNumber: "case-1",
            letterId: "letter-1",
        });

        assert.equal(calls.length, 1);
        const cmd = calls[0];

        assert.equal(cmd.QueueUrl, "https://sqs.example.com/letters");
        assert.ok(cmd.MessageBody.includes('"type":"DELETE"'));
        assert.deepEqual(cmd.MessageAttributes, {
            MessageType: { DataType: "String", StringValue: "DELETE" },
        });

        const parsed = JSON.parse(cmd.MessageBody);
        assert.equal(parsed.type, "DELETE");
        assert.equal(parsed.userId, "user-1");
        assert.equal(parsed.caseReferenceNumber, "case-1");
        assert.equal(parsed.letterId, "letter-1");
        assert.notEqual(new Date(parsed.requestedAt).toString(), "Invalid Date");

        assert.equal(sqsSend.mock.calls.length, 1);
    });

    await t.test("sends a SEND message with correct payload and attributes", async () => {
        const { calls, sqsSend, SQSClient, SendMessageCommand } = makeAwsSqsFixtures();
        const logger = makeLoggerFixture();

        const { sendSendMessage } = await loadSqsService({
            SQSClient,
            SendMessageCommand,
            logger,
        });

        await sendSendMessage({
            key: "letters/user-2/case-2/letter-2.json",
        });

        assert.equal(calls.length, 1);
        const cmd = calls[0];

        assert.equal(cmd.QueueUrl, "https://sqs.example.com/letters");
        assert.ok(cmd.MessageBody.includes('"type":"SEND"'));
        assert.deepEqual(cmd.MessageAttributes, {
            MessageType: { DataType: "String", StringValue: "SEND" },
        });

        const parsed = JSON.parse(cmd.MessageBody);
        assert.equal(parsed.type, "SEND");
        assert.equal(parsed.key, "letters/user-2/case-2/letter-2.json");
        assert.notEqual(new Date(parsed.requestedAt).toString(), "Invalid Date");

        // Ensure DELETE fields are not accidentally present for SEND
        assert.equal(parsed.userId, undefined);
        assert.equal(parsed.caseReferenceNumber, undefined);
        assert.equal(parsed.letterId, undefined);

        assert.equal(sqsSend.mock.calls.length, 1);
    });

    await t.test("propagates errors from the SQS client", async () => {
        const { calls, sqsSend, SQSClient, SendMessageCommand } = makeAwsSqsFixtures({
            sendImpl: async () => {
                throw new Error("SQS failed");
            },
        });
        const logger = makeLoggerFixture();

        const { sendSendMessage } = await loadSqsService({
            SQSClient,
            SendMessageCommand,
            logger,
        });

        await assert.rejects(
            () => sendSendMessage({ key: "letters/u/c/l.json" }),
            (err) => {
                assert.equal(err?.message, "SQS failed");
                return true;
            }
        );

        assert.equal(calls.length, 1);
        assert.equal(sqsSend.mock.calls.length, 1);
    });
});
