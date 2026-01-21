import { logger } from "../services/logger/index.js";
import { resolveRoute } from "./routes/index.js";
import { errorResponse, ValidationError } from "./utils/index.js";

export const handler = async (event, context) => {
    global.requestId =
        context?.awsRequestId ||
        event?.requestContext?.requestId ||
        "unknown";

    const { httpMethod, resource, path } = event;

    logger.info("Request received", { httpMethod, resource, path, requestId: global.requestId });

    try {
        const routeHandler = resolveRoute(httpMethod, resource || path);

        if (!routeHandler) {
            logger.warn("No matching route", { httpMethod, resource, path });
            return errorResponse(404, "Not Found", "NOT_FOUND");
        }

        return await routeHandler(event);
    } catch (err) {
        if (err instanceof ValidationError) {
            logger.warn("Validation error", { message: err.message, details: err.details });
            return errorResponse(400, err.message, "VALIDATION_ERROR", err.details);
        }

        console.error("MASSIVE ERROR", {
            requestId: context?.awsRequestId,
            errName: err?.name,
            errMessage: err?.message,
            stack: err?.stack
        });

        logger.error("Unexpected error", { error: err.message, stack: err.stack });
        return errorResponse(500, "Internal server error", "INTERNAL_ERROR");
    }
};
