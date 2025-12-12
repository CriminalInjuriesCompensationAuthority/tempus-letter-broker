import {logger} from "../../services/logger";
import ajv from "../../services/schemaValidation";
import nilDecisionTemplate from 'q-templates-review';
import letterBuilder from 'q-letter-transformer';

const supportedSchema = {
    tx45: nilDecisionTemplate
};

export const respond = (statusCode, body, additionalHeaders = {}) => ({
    statusCode,
    headers: {
        "Content-Type": "application/json",
        "X-Request-Id": global.requestId || "unknown",
        ...additionalHeaders,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
});

export const errorResponse = (statusCode, message, code = null, details = null) => {
    const body = { message };
    if (code) body.code = code;
    if (details) body.details = details;
    return respond(statusCode, body);
};

export class ValidationError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = "ValidationError";
        this.details = details;
    }
}

export const parseAndValidateBody = (bodyString) => {
    if (!bodyString) {
        throw new ValidationError("Request body is required");
    }

    let body;
    try {
        body = JSON.parse(bodyString);
    } catch {
        throw new ValidationError("Invalid JSON in request body");
    }

    const { letterType, letterData, contactPreference, userEmail, userPhone } = body;

    if (typeof letterType !== "string" || !letterType.trim()) {
        throw new ValidationError("letterType is required");
    }

    if (letterData === undefined || typeof letterData !== "object") {
        throw new ValidationError("letterData is required");
    }

    if (contactPreference !== "E" && contactPreference !== "T") {
        throw new ValidationError(
            "contactPreference must be 'E' (email) or 'T' (text)"
        );
    }

    if (contactPreference === "E") {
        if (!userEmail) {
            throw new ValidationError(
                "userEmail is required when contactPreference is 'E'"
            );
        }
    }

    if (contactPreference === "T") {
        if (!userPhone) {
            throw new ValidationError(
                "userPhone is required when contactPreference is 'T'"
            );
        }
    }

    const schema = supportedSchema[String(letterType).toLowerCase()].inputSchema;
    if (!schema) {
        throw new ValidationError(
            `Unsupported letterType: ${letterType}`,
            { supportedTypes: Object.keys(supportedSchema) }
        );
    }

    const validate = ajv.compile(schema);
    if (!validate(letterData)) {
        throw new ValidationError("Letter validation failed", validate.errors);
    }

    return body;
};

export const generatePdf = async (bodyString, letterId) => {
    let body;
    try {
        body = JSON.parse(bodyString);
    } catch {
        throw new ValidationError("Invalid JSON in request body");
    }

    const { letterType, letterData, isPreview} = body;

    if (typeof letterType !== "string" || !letterType.trim()) {
        throw new ValidationError("letterType is required");
    }

    if (letterData === undefined || typeof letterData !== "object") {
        throw new ValidationError("letterData is required");
    }

    logger.info("Generating PDF", {
        letterType: letterType,
        isPreview: isPreview === true
    });

    //Todo - improve this.
    const template = supportedSchema[String(letterType).toLowerCase()];
    const letterSchema = template.sections[template.routes.initial];

    const previewData = {
        id: letterId,
        type: 'pdf',
        schema: letterSchema,
        isPreview: isPreview === true,
        letterData
    };

    return letterBuilder(previewData);
};
