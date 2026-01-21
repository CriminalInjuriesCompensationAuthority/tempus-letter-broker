import { logger } from "../../services/logger/index.js";
import { sendDeleteMessage, sendSendMessage } from "../../services/sqs/index.js";
import { putLetterJson, putPreviewPdf } from "../../services/s3/index.js";
import { respond, parseAndValidateBody, generatePdf } from "../utils/index.js";

export async function handleDeleteUser(event) {
    const { userId } = event.pathParameters || {};

    logger.info("Handling delete all letters for user", { userId });

    await sendDeleteMessage({
        userId,
        caseReferenceNumber: null,
        letterId: null,
    });

    // 204 No Content – empty body
    return respond(204, "");
}

export async function handleDeleteCase(event) {
    const { userId, caseReferenceNumber } = event.pathParameters || {};

    logger.info("Handling delete all letters for case", { userId, caseReferenceNumber });

    await sendDeleteMessage({
        userId,
        caseReferenceNumber,
        letterId: null,
    });

    return respond(204, "");
}

export async function handleDeleteLetter(event) {
    const { userId, caseReferenceNumber, letterId } = event.pathParameters || {};

    logger.info("Handling delete specific letter", { userId, caseReferenceNumber, letterId });

    await sendDeleteMessage({
        userId,
        caseReferenceNumber,
        letterId,
    });

    return respond(204, "");
}

export async function handleSend(event) {
    const { userId, caseReferenceNumber, letterId } = event.pathParameters || {};

    logger.info("Handling send letter", { userId, caseReferenceNumber, letterId });

    const { body, template } = parseAndValidateBody(event.body);

    const letterDocument = {
        userId,
        caseReferenceNumber,
        letterId,
        letterType: body.letterType,
        letterData: body.letterData,
        contactPreference: body.contactPreference,
        userEmail: body.userEmail || null,
        userPhone: body.userPhone || null,
        createdAt: new Date().toISOString(),
        expiresAt: body.expiryDate,
        template
    };

    const { key } = await putLetterJson({
        userId,
        caseReferenceNumber,
        letterId,
        letterDocument,
    });

    await sendSendMessage({
        key
    });

    return respond(200, {
        letterId
    });
}

export async function handlePreview(event) {
    const { userId, caseReferenceNumber, letterId } = event.pathParameters || {};

    logger.info("Handling generate preview PDF", { userId, caseReferenceNumber, letterId });

    const { body, template }  = parseAndValidateBody(event.body);

    const pdfBuffer = await generatePdf(body, template, letterId);

    const { uri } = await putPreviewPdf({
        caseReferenceNumber,
        letterId,
        pdfBuffer
    });

    return respond(201, { letterId, uri });
}
