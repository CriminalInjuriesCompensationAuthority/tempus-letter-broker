import pino from "pino";

const base = pino({
    level: process.env.LOG_LEVEL || "info",
});

export const logger = {
    debug: (msg, data) => base.debug(data || {}, msg),
    info:  (msg, data) => base.info(data || {}, msg),
    warn:  (msg, data) => base.warn(data || {}, msg),
    error: (msg, data) => base.error(data || {}, msg),
};