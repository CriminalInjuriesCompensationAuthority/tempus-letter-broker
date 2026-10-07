import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import esmock from "esmock";

const MODULE_PATH = "./index.js";
const LOGGER_PATH = "../logger/index.js";
const SECRET_MANAGER_PATH = "../secret-manager/index.js";

function makeAwsS3Fixtures({ sendImpl } = {}) {
    const calls = [];
    const s3Send = mock.fn(sendImpl ?? (async () => undefined));

    class S3Client {
        constructor() {
            this.send = s3Send;
        }
    }

    class PutObjectCommand {
        constructor(input) {
            this.input = input;
            calls.push(input);
        }
    }

    return { calls, s3Send, S3Client, PutObjectCommand };
}

function makeLoggerFixture() {
    return {
        info: mock.fn(),
        error: mock.fn(),
        warn: mock.fn(),
        debug: mock.fn(),
    };
}

function makeSecretManagerFixture() {
    const getSecret = mock.fn(async () =>
        JSON.stringify({
            PREVIEW_BUCKET_KMS: 'kms-key-test',
        })
    );

    return { getSecret };
}

async function loadS3Service({ S3Client, PutObjectCommand, logger, getSecret }) {
    return esmock(MODULE_PATH, {
        "@aws-sdk/client-s3": { S3Client, PutObjectCommand },
        [LOGGER_PATH]: { logger },
        [SECRET_MANAGER_PATH]: { default: getSecret },
    });
}

test("S3 service", async (t) => {
    process.env.LETTERS_BUCKET = "letters-bucket";
    process.env.KTA_DOCS_BUCKET = "docs-bucket";
    process.env.SECRETS_ARN = "arn:dummy";

    await t.test(
        "uploads JSON letter with correct S3 key, bucket, contentType",
        async () => {
            const { calls, s3Send, S3Client, PutObjectCommand } = makeAwsS3Fixtures();
            const logger = makeLoggerFixture();

            const { putLetterJson } = await loadS3Service({
                S3Client,
                PutObjectCommand,
                logger,
            });

            const userId = "user-123";
            const caseReferenceNumber = "26-700123";
            const letterId = "letter-789";
            const letterDocument = { foo: "bar" };

            const result = await putLetterJson({
                userId,
                caseReferenceNumber,
                letterId,
                letterDocument,
            });

            assert.equal(calls.length, 1);
            assert.deepEqual(calls[0], {
                Bucket: "letters-bucket",
                Key: `letters/${userId}/${caseReferenceNumber}/${letterId}.json`,
                Body: JSON.stringify(letterDocument),
                ContentType: "application/json"
            });

            assert.equal(s3Send.mock.calls.length, 1);

            assert.deepEqual(result, {
                key: `letters/${userId}/${caseReferenceNumber}/${letterId}.json`,
                uri: `s3://letters-bucket/letters/${userId}/${caseReferenceNumber}/${letterId}.json`,
            });
        }
    );

    await t.test(
        "uploads PDF preview with correct S3 key, bucket, contentType",
        async () => {
            const { calls, s3Send, S3Client, PutObjectCommand } = makeAwsS3Fixtures();
            const logger = makeLoggerFixture();
            const { getSecret } = makeSecretManagerFixture();

            const { putPreviewPdf } = await loadS3Service({
                S3Client,
                PutObjectCommand,
                logger,
                getSecret
            });

            const caseReferenceNumber = "25-700123";
            const letterId = "letter-111";
            const pdfBuffer = Buffer.from("fake-pdf");

            const result = await putPreviewPdf({
                caseReferenceNumber,
                letterId,
                pdfBuffer,
            });

            assert.equal(calls.length, 1);
            assert.deepEqual(calls[0], {
                Bucket: "docs-bucket",
                Key: `${caseReferenceNumber}/preview/${letterId}.pdf`,
                Body: pdfBuffer,
                ContentType: "application/pdf",
                ServerSideEncryption: "aws:kms",
                SSEKMSKeyId: "kms-key-test"
            });

            assert.equal(s3Send.mock.calls.length, 1);

            assert.deepEqual(result, {
                key: `${caseReferenceNumber}/preview/${letterId}.pdf`,
                uri: `s3://docs-bucket/${caseReferenceNumber}/preview/${letterId}.pdf`,
            });
        }
    );

    await t.test("propagates errors thrown by S3", async () => {
        const { calls, s3Send, S3Client, PutObjectCommand } = makeAwsS3Fixtures({
            sendImpl: async () => {
                throw new Error("S3 failure");
            },
        });
        const logger = makeLoggerFixture();
        const { getSecret } = makeSecretManagerFixture();

        const { putPreviewPdf } = await loadS3Service({
            S3Client,
            PutObjectCommand,
            logger,
            getSecret
        });

        await assert.rejects(
            () =>
                putPreviewPdf({
                    caseReferenceNumber: "25-700123",
                    letterId: "letter-y",
                    pdfBuffer: Buffer.from("pdf"),
                }),
            (err) => {
                assert.equal(err?.message, "S3 failure");
                return true;
            }
        );

        assert.equal(calls.length, 1);
        assert.equal(s3Send.mock.calls.length, 1);
    });
});
