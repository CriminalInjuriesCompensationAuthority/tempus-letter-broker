// services/s3/index.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import esmock from "esmock";

const MODULE_PATH = "./index.js";
const LOGGER_PATH = "../logger/index.js";

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

async function loadS3Service({ S3Client, PutObjectCommand, logger }) {
    return esmock(MODULE_PATH, {
        "@aws-sdk/client-s3": { S3Client, PutObjectCommand },
        [LOGGER_PATH]: { logger },
    });
}

test("S3 service", async (t) => {
    process.env.LETTERS_BUCKET = "letters-bucket";
    process.env.KTA_DOCS_BUCKET = "docs-bucket";
    process.env.CICA_KMS_KEY = "kms-letters";
    process.env.DOCS_KMS_KEY = "kms-docs";

    await t.test(
        "uploads JSON letter with correct S3 key, bucket, contentType and KMS key",
        async () => {
            const { calls, s3Send, S3Client, PutObjectCommand } = makeAwsS3Fixtures();
            const logger = makeLoggerFixture();

            const { putLetterJson } = await loadS3Service({
                S3Client,
                PutObjectCommand,
                logger,
            });

            const userId = "user-123";
            const caseReferenceNumber = "X/26/700123-TM99";
            const transformedCrn = "26-700123";
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
                Key: `letters/${userId}/${transformedCrn}/${letterId}.json`,
                Body: JSON.stringify(letterDocument),
                ContentType: "application/json",
                ServerSideEncryption: "aws:kms",
                SSEKMSKeyId: "kms-letters",
            });

            assert.equal(s3Send.mock.calls.length, 1);

            assert.deepEqual(result, {
                key: `letters/${userId}/${transformedCrn}/${letterId}.json`,
                uri: `s3://letters-bucket/letters/${userId}/${transformedCrn}/${letterId}.json`,
            });
        }
    );

    await t.test(
        "uploads PDF preview with correct S3 key, bucket, contentType and KMS key",
        async () => {
            const { calls, s3Send, S3Client, PutObjectCommand } = makeAwsS3Fixtures();
            const logger = makeLoggerFixture();

            const { putPreviewPdf } = await loadS3Service({
                S3Client,
                PutObjectCommand,
                logger,
            });

            const caseReferenceNumber = "X/25/700123-TM99";
            const transformedCrn = "25-700123";
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
                Key: `${transformedCrn}/preview/${letterId}.pdf`,
                Body: pdfBuffer,
                ContentType: "application/pdf",
                ServerSideEncryption: "aws:kms",
                SSEKMSKeyId: "kms-docs",
            });

            assert.equal(s3Send.mock.calls.length, 1);

            assert.deepEqual(result, {
                key: `${transformedCrn}/preview/${letterId}.pdf`,
                uri: `s3://docs-bucket/${transformedCrn}/preview/${letterId}.pdf`,
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

        const { putPreviewPdf } = await loadS3Service({
            S3Client,
            PutObjectCommand,
            logger,
        });

        await assert.rejects(
            () =>
                putPreviewPdf({
                    caseReferenceNumber: "X/25/700123-TM99",
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
