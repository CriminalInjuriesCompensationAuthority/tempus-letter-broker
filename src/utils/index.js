import { logger as defaultLogger } from "../../services/logger/index.js";
import defaultAjv from "../../services/schemaValidation/index.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const nilDecisionTemplate = require("q-templates-review");
const defaultLetterBuilder = require('q-letter-transformer');

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

export const parseAndValidateBodyWithDeps = (
    bodyString,
    { templates = supportedSchema, ajv = defaultAjv } = {}
) => {
    if (!bodyString) {
        throw new ValidationError("Request body is required");
    }

    let body;
    try {
        body = JSON.parse(bodyString);
    } catch {
        throw new ValidationError("Invalid JSON in request body");
    }

    const { letterType, letterData, contactPreference, userEmail, userPhone, isPreview } = body;

    if (typeof letterType !== "string" || !letterType.trim()) {
        throw new ValidationError("letterType is required");
    }

    if (letterData === undefined || typeof letterData !== "object" || letterData === null) {
        throw new ValidationError("letterData is required");
    }

    if (!isPreview) {
        if (contactPreference !== "E" && contactPreference !== "T" && !isPreview) {
            throw new ValidationError(
                "contactPreference must be 'E' (email) or 'T' (text)"
            );
        }

        if (contactPreference === "E" && !userEmail) {
            throw new ValidationError(
                "userEmail is required when contactPreference is 'E'"
            );
        }

        if (contactPreference === "T" && !userPhone) {
            throw new ValidationError(
                "userPhone is required when contactPreference is 'T'"
            );
        }
    }

    const key = String(letterType).toLowerCase();
    const template = templates[key];

    if (!template) {
        throw new ValidationError(`Unsupported letterType: ${letterType}`, {
            supportedTypes: Object.keys(templates),
        });
    }

    //ToDo: Compile schemas once, not ad hoc - better performance
    const schema = template?.inputSchema;
    if (!schema) {
        throw new ValidationError(`Template error. No input schema found for template: ${key}`);
    }

    const validate = ajv.compile(schema);
    if (!validate(letterData)) {
        throw new ValidationError("Letter validation failed", validate.errors);
    }

    const templateInstance = structuredClone(template);

    return { body, template: templateInstance };
};

/* c8 ignore next 5 */
export const parseAndValidateBody = (bodyString) =>
    parseAndValidateBodyWithDeps(bodyString, {
        templates: supportedSchema,
        ajv: defaultAjv,
    });

export const generatePdfWithDeps = async (
    body,
    template,
    letterId,
    {
        logger = defaultLogger,
        letterBuilder = defaultLetterBuilder
    } = {}
) => {
    const { letterType, letterData, isPreview } = body;

    if (typeof letterType !== "string" || !letterType.trim()) {
        throw new ValidationError("letterType is required");
    }

    if (letterData === undefined || typeof letterData !== "object" || letterData === null) {
        throw new ValidationError("letterData is required");
    }

    logger.info("Generating PDF", {
        letterType,
        isPreview: isPreview === true,
    });

    const letterSchema = template.sections?.[template.routes?.initial]?.schema;
    if (!letterSchema) {
        throw new ValidationError(`Template misconfigured for letterType: ${letterType}`);
    }

    const previewData = {
        id: letterId,
        template: letterSchema,
        isPreview: isPreview === true,
        letterData
    };

    return letterBuilder.getLetter(previewData);
};

/* c8 ignore next 6 */
export const generatePdf = async (body, template, letterId) =>
    generatePdfWithDeps(body, template, letterId, {
        logger: defaultLogger,
        letterBuilder: defaultLetterBuilder()
    });
