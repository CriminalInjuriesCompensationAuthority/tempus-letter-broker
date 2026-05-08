import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { logger } from "../logger/index.js"
import getSecret from '../secret-manager/index.js';

const s3 = new S3Client({
    region: 'eu-west-2'
});

const LETTERS_BUCKET = process.env.LETTERS_BUCKET;
const PREVIEW_BUCKET = process.env.KTA_DOCS_BUCKET;
const SECRETS_ARN = process.env.SECRETS_ARN;

async function putObject({ bucket, key, body, contentType, ServerSideEncryption, SSEKMSKeyId }) {
    logger.info("Writing object to S3", { bucket, key, contentType });

    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            ...(ServerSideEncryption ? { ServerSideEncryption } : {}),
            ...(SSEKMSKeyId ? { SSEKMSKeyId } : {})
        })
    );

    logger.info("Object written to S3 successfully", { bucket, key });

    return key
}

export async function putLetterJson({ userId, caseReferenceNumber, letterId, letterDocument }) {
    const jsonKey = `letters/${userId}/${caseReferenceNumber}/${letterId}.json`;

    await putObject({
        bucket: LETTERS_BUCKET,
        key: jsonKey,
        body: JSON.stringify(letterDocument),
        contentType: "application/json"
    });

    return {
        key: jsonKey,
        uri: `s3://${LETTERS_BUCKET}/${jsonKey}`,
    }
}

export async function putPreviewPdf({ caseReferenceNumber, letterId, pdfBuffer }) {
    const previewKey = `${caseReferenceNumber}/preview/${letterId}.pdf`;
    const {PREVIEW_BUCKET_KMS} = JSON.parse(await getSecret(SECRETS_ARN));

    await putObject({
        bucket: PREVIEW_BUCKET,
        key: previewKey,
        body: pdfBuffer,
        contentType: "application/pdf",
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: PREVIEW_BUCKET_KMS
    });

    return {
        key: previewKey,
        uri: `s3://${PREVIEW_BUCKET}/${previewKey}`,
    }
}
