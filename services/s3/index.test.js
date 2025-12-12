// Mock the AWS S3 client
jest.mock("@aws-sdk/client-s3", () => ({
    S3Client: jest.fn().mockImplementation(() => ({
        send: jest.fn(),
    })),
    PutObjectCommand: jest.fn(),
}));

// Mock the logger
jest.mock("../logger/index.js", () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

import { putLetterJson, putPreviewPdf } from "./index.js";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

describe("S3 service", () => {
    let mockS3Send;

    beforeEach(() => {
        jest.clearAllMocks();

        process.env.LETTERS_BUCKET = "letters-bucket";
        process.env.KTA_DOCS_BUCKET = "docs-bucket";
        process.env.CICA_KMS_KEY = "kms-letters";
        process.env.DOCS_KMS_KEY = "kms-docs";

        mockS3Send = S3Client.mock.results[0].value.send;
    });

    it("uploads JSON letter with correct S3 key, bucket, contentType and KMS key", async () => {
        const userId = "user-123";
        const caseReferenceNumber = "case-456";
        const letterId = "letter-789";
        const letterDocument = { foo: "bar" };

        const result = await putLetterJson({
            userId,
            caseReferenceNumber,
            letterId,
            letterDocument,
        });

        expect(PutObjectCommand).toHaveBeenCalledWith({
            Bucket: "letters-bucket",
            Key: `letters/${userId}/${caseReferenceNumber}/${letterId}.json`,
            Body: JSON.stringify(letterDocument),
            ContentType: "application/json",
            ServerSideEncryption: "aws:kms",
            SSEKMSKeyId: "kms-letters",
        });
        expect(mockS3Send).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            key: `letters/${userId}/${caseReferenceNumber}/${letterId}.json`,
            uri: `s3://letters-bucket/letters/${userId}/${caseReferenceNumber}/${letterId}.json`,
        });
    });

    it("uploads PDF preview with correct S3 key, bucket, contentType and KMS key", async () => {
        const caseReferenceNumber = "case-999";
        const letterId = "letter-111";
        const pdfBuffer = Buffer.from("fake-pdf");

        const result = await putPreviewPdf({
            caseReferenceNumber,
            letterId,
            pdfBuffer,
        });

        expect(PutObjectCommand).toHaveBeenCalledWith({
            Bucket: "docs-bucket",
            Key: `${caseReferenceNumber}/preview/${letterId}.pdf`,
            Body: pdfBuffer,
            ContentType: "application/pdf",
            ServerSideEncryption: "aws:kms",
            SSEKMSKeyId: "kms-docs",
        });
        expect(mockS3Send).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            key: `${caseReferenceNumber}/preview/${letterId}.pdf`,
            uri: `s3://docs-bucket/${caseReferenceNumber}/preview/${letterId}.pdf`,
        });
    });

    it("propagates errors thrown by S3", async () => {
        mockS3Send.mockRejectedValue(new Error("S3 failure"));

        await expect(
            putPreviewPdf({
                caseReferenceNumber: "case-x",
                letterId: "letter-y",
                pdfBuffer: Buffer.from("pdf"),
            })
        ).rejects.toThrow("S3 failure");
    });
});
