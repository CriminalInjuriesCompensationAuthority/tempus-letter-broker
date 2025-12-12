import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

let logger, LOG_LEVELS;

describe("Logger Service", () => {
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;
    const originalEnv = process.env.LOG_LEVEL;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        process.env.LOG_LEVEL = originalEnv;
        jest.resetModules()
    });

    describe("with LOG_LEVEL=INFO (default)", () => {
        beforeEach(async () => {
            process.env.LOG_LEVEL = "INFO";
            jest.resetModules();
            const module = await import("./index.js");
            logger = module.logger;
            LOG_LEVELS = module.LOG_LEVELS;
        });

        it("should NOT log debug messages", () => {
            logger.debug("debug message", { foo: "bar" });
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it("should log info messages", () => {
            logger.info("info message", { foo: "bar" });
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);

            const loggedJson = JSON.parse(consoleLogSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe("INFO");
            expect(loggedJson.message).toBe("info message");
            expect(loggedJson.foo).toBe("bar");
            expect(loggedJson.timestamp).toBeDefined()
        });

        it("should log warn messages using console.warn", () => {
            logger.warn("warning message");
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

            const loggedJson = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe("WARN");
            expect(loggedJson.message).toBe("warning message")
        });

        it("should log error messages using console.error", () => {
            logger.error("error message", { errorCode: 500 });
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

            const loggedJson = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe("ERROR");
            expect(loggedJson.message).toBe("error message");
            expect(loggedJson.errorCode).toBe(500)
        })
    });

    describe("with LOG_LEVEL=DEBUG", () => {
        beforeEach(async () => {
            process.env.LOG_LEVEL = "DEBUG";
            jest.resetModules();
            const module = await import("./index.js");
            logger = module.logger
        });

        it("should log debug messages", () => {
            logger.debug("debug message", { detail: "value" });
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);

            const loggedJson = JSON.parse(consoleLogSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe("DEBUG");
            expect(loggedJson.message).toBe("debug message");
            expect(loggedJson.detail).toBe("value");
        });

        it("should also log info, warn, and error messages", () => {
            logger.info("info");
            logger.warn("warn");
            logger.error("error");

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        })
    });

    describe("with LOG_LEVEL=ERROR", () => {
        beforeEach(async () => {
            process.env.LOG_LEVEL = "ERROR";
            jest.resetModules();
            const module = await import("./index.js");
            logger = module.logger
        });

        it("should NOT log debug, info, or warn messages", () => {
            logger.debug("debug");
            logger.info("info");
            logger.warn("warn");

            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should log error messages", () => {
            logger.error("error message");
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("JSON output format", () => {
        beforeEach(async () => {
            process.env.LOG_LEVEL = "DEBUG";
            jest.resetModules();
            const module = await import("./index.js");
            logger = module.logger;
        });

        it("should output valid JSON with required fields", () => {
            logger.info("test message", { customField: "value" });

            const output = consoleLogSpy.mock.calls[0][0];
            expect(() => JSON.parse(output)).not.toThrow();

            const parsed = JSON.parse(output);
            expect(parsed).toHaveProperty("level");
            expect(parsed).toHaveProperty("message");
            expect(parsed).toHaveProperty("timestamp");
            expect(parsed).toHaveProperty("customField");
        });
    });
});
