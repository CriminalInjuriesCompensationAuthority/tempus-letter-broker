import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const MODULE_PATH = "./index.js";

async function importFreshLoggerModule() {
    return import(`${MODULE_PATH}?t=${Date.now()}-${Math.random()}`);
}

function captureWrites(writeMock) {
    return writeMock.mock.calls.map((c) => {
        const chunk = c.arguments[0];
        return Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    });
}

function parseJsonLines(texts) {
    const lines = texts
        .flatMap((t) => t.split("\n"))
        .map((l) => l.trim())
        .filter(Boolean);

    return lines.map((line) => JSON.parse(line));
}

function getAllLogEntries(stdoutWriteMock, stderrWriteMock) {
    const out = parseJsonLines(captureWrites(stdoutWriteMock));
    const err = parseJsonLines(captureWrites(stderrWriteMock));
    return [...out, ...err];
}

test("Logger Service (pino)", async (t) => {
    const originalEnv = process.env.LOG_LEVEL;

    let stdoutWriteMock;
    let stderrWriteMock;

    t.beforeEach(() => {
        stdoutWriteMock = mock.method(process.stdout, "write", () => true);
        stderrWriteMock = mock.method(process.stderr, "write", () => true);
    });

    t.afterEach(() => {
        stdoutWriteMock.mock.restore();
        stderrWriteMock.mock.restore();
        process.env.LOG_LEVEL = originalEnv;
    });

    await t.test("with LOG_LEVEL=INFO", async (t2) => {
        process.env.LOG_LEVEL = "info";
        const { logger } = await importFreshLoggerModule();

        await t2.test("should NOT log debug messages", () => {
            logger.debug("debug message", { foo: "bar" });

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            assert.equal(all.length, 0);
        });

        await t2.test("should log info messages", () => {
            logger.info("info message", { foo: "bar" });

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            const entry = all.find((e) => e.msg === "info message");

            assert.ok(entry, "Expected an info log entry");
            assert.equal(entry.level, 30);
            assert.equal(entry.foo, "bar");
            assert.ok(typeof entry.time === "number");
        });

        await t2.test("should log warn messages", () => {
            logger.warn("warning message");

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            const entry = all.find((e) => e.msg === "warning message");

            assert.ok(entry, "Expected a warn log entry");
            assert.equal(entry.level, 40);
        });

        await t2.test("should log error messages", () => {
            logger.error("error message", { errorCode: 500 });

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            const entry = all.find((e) => e.msg === "error message");

            assert.ok(entry, "Expected an error log entry");
            assert.equal(entry.level, 50);
            assert.equal(entry.errorCode, 500);
        });
    });

    await t.test("with LOG_LEVEL=DEBUG", async (t2) => {
        process.env.LOG_LEVEL = "debug";
        const { logger } = await importFreshLoggerModule();

        await t2.test("should log debug messages", () => {
            logger.debug("debug message", { detail: "value" });

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            const entry = all.find((e) => e.msg === "debug message");

            assert.ok(entry, "Expected a debug log entry");
            assert.equal(entry.level, 20);
            assert.equal(entry.detail, "value");
        });

        await t2.test("should also log info, warn, and error messages", () => {
            logger.info("info");
            logger.warn("warn");
            logger.error("error");

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);

            assert.ok(all.some((e) => e.msg === "info" && e.level === 30));
            assert.ok(all.some((e) => e.msg === "warn" && e.level === 40));
            assert.ok(all.some((e) => e.msg === "error" && e.level === 50));
        });
    });

    await t.test("with LOG_LEVEL=ERROR", async (t2) => {
        process.env.LOG_LEVEL = "error";
        const { logger } = await importFreshLoggerModule();

        await t2.test("should NOT log debug, info, or warn messages", () => {
            logger.debug("debug");
            logger.info("info");
            logger.warn("warn");

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            assert.equal(all.length, 0);
        });

        await t2.test("should log error messages", () => {
            logger.error("error message");

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            const entry = all.find((e) => e.msg === "error message");

            assert.ok(entry);
            assert.equal(entry.level, 50);
        });
    });

    await t.test("JSON output format", async (t2) => {
        process.env.LOG_LEVEL = "debug";
        const { logger } = await importFreshLoggerModule();

        await t2.test("should output valid JSON with required fields", () => {
            logger.info("test message", { customField: "value" });

            const all = getAllLogEntries(stdoutWriteMock, stderrWriteMock);
            const entry = all.find((e) => e.msg === "test message");

            assert.ok(entry);
            assert.ok("level" in entry);
            assert.ok("msg" in entry);
            assert.ok("time" in entry);
            assert.equal(entry.customField, "value");
        });
    });
});
