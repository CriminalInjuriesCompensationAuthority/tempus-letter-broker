import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { logger } from "../logger/index.js"

const s3 = new S3Client({});

const LETTERS_BUCKET = process.env.LETTERS_BUCKET;
const PREVIEW_BUCKET = process.env.KTA_DOCS_BUCKET;
const KTA_DOCS_KMS = process.env.DOCS_KMS_KEY;
const CICA_LETTERS_KMS = process.env.CICA_KMS_KEY;

function normaliseCaseReference(input) {
    // "X/25/700123-TM2A"
    const [, year, numberWithTeam] = input.split("/");
    // numberWithSuffix: "700123-TM2A"
    const number = numberWithTeam.split("-")[0];
    // 25-700123
    return `${year}-${number}`;
}

async function putObject({ bucket, key, body, contentType, kmsKey }) {
    logger.info("Writing object to S3", { bucket, key, contentType });

    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            ServerSideEncryption: "aws:kms",
            SSEKMSKeyId: kmsKey,
        })
    );

    logger.info("Object written to S3 successfully", { bucket, key });

    return key
}

export async function putLetterJson({ userId, caseReferenceNumber, letterId, letterDocument }) {
    const caseRef = normaliseCaseReference(caseReferenceNumber);
    const jsonKey = `letters/${userId}/${caseRef}/${letterId}.json`;

    await putObject({
        bucket: LETTERS_BUCKET,
        key: jsonKey,
        body: JSON.stringify(letterDocument),
        contentType: "application/json",
        kmsKey: CICA_LETTERS_KMS
    });

    return {
        key: jsonKey,
        uri: `s3://${LETTERS_BUCKET}/${jsonKey}`,
    }
}

export async function putPreviewPdf({ caseReferenceNumber, letterId, pdfBuffer }) {
    const caseRef = normaliseCaseReference(caseReferenceNumber);
    const previewKey = `${caseRef}/preview/${letterId}.pdf`;

    await putObject({
        bucket: PREVIEW_BUCKET,
        key: previewKey,
        body: pdfBuffer,
        contentType: "application/pdf",
        kmsKey: KTA_DOCS_KMS
    });

    return {
        key: previewKey,
        uri: `s3://${PREVIEW_BUCKET}/${previewKey}`,
    }
}
