// ./index.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import Ajv from "ajv";

import {
    respond,
    errorResponse,
    ValidationError,
    parseAndValidateBodyWithDeps,
    generatePdfWithDeps
} from "./index.js";

function makeFixtures() {
    const templates = {
        tx45: {
            inputSchema: {
                type: "object",
                additionalProperties: false,
                required: ["foo"],
                properties: {
                    foo: { type: "string" },
                },
            },
            routes: { initial: "start" },
            sections: {
                start: { sectionName: "StartSection" },
            },
        },
    };

    const logger = {
        info: mock.fn(),
    };

    const letterBuilder = mock.fn(async (previewData) => ({
        ok: true,
        previewData,
    }));

    const ajv = new Ajv({ allErrors: true });

    return { templates, logger, letterBuilder, ajv };
}

test("respond(): sets JSON headers, request id, and stringifies object body", () => {
    global.requestId = "req-123";
    const res = respond(200, { ok: true });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Type"], "application/json");
    assert.equal(res.headers["X-Request-Id"], "req-123");
    assert.equal(res.body, JSON.stringify({ ok: true }));

    delete global.requestId;
});

test("respond(): uses 'unknown' request id when not set", () => {
    delete global.requestId;
    const res = respond(200, { ok: true });
    assert.equal(res.headers["X-Request-Id"], "unknown");
});

test("respond(): passes through string body unchanged", () => {
    const res = respond(400, "bad");
    assert.equal(res.body, "bad");
});

test("respond(): merges additional headers (override allowed)", () => {
    global.requestId = "req-abc";
    const res = respond(200, { ok: true }, { "X-Foo": "bar", "X-Request-Id": "override" });

    assert.equal(res.headers["X-Foo"], "bar");
    assert.equal(res.headers["X-Request-Id"], "override");

    delete global.requestId;
});

test("errorResponse(): message only", () => {
    const res = errorResponse(400, "Nope");
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { message: "Nope" });
});

test("errorResponse(): includes code and details", () => {
    const res = errorResponse(422, "Validation failed", "BAD_INPUT", [{ field: "foo" }]);
    assert.deepEqual(JSON.parse(res.body), {
        message: "Validation failed",
        code: "BAD_INPUT",
        details: [{ field: "foo" }],
    });
});

test("ValidationError: sets name and details", () => {
    const err = new ValidationError("Boom", { a: 1 });
    assert.equal(err.name, "ValidationError");
    assert.equal(err.message, "Boom");
    assert.deepEqual(err.details, { a: 1 });
});

test("parseAndValidateBodyWithDeps(): throws when body missing", () => {
    const { templates, ajv } = makeFixtures();

    assert.throws(
        () => parseAndValidateBodyWithDeps("", { templates, ajv }),
        (e) => {
            assert.ok(e instanceof ValidationError);
            assert.equal(e.message, "Request body is required");
            return true;
        }
    );
});

test("parseAndValidateBodyWithDeps(): throws when JSON invalid", () => {
    const { templates, ajv } = makeFixtures();

    assert.throws(
        () => parseAndValidateBodyWithDeps("{", { templates, ajv }),
        (e) => {
            assert.ok(e instanceof ValidationError);
            assert.equal(e.message, "Invalid JSON in request body");
            return true;
        }
    );
});

test("parseAndValidateBodyWithDeps(): throws when letterType missing/blank", () => {
    const { templates, ajv } = makeFixtures();

    const payloadMissing = JSON.stringify({
        letterData: { foo: "x" },
        contactPreference: "E",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(payloadMissing, { templates, ajv }),
        /letterType is required/
    );

    const payloadBlank = JSON.stringify({
        letterType: "   ",
        letterData: { foo: "x" },
        contactPreference: "E",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(payloadBlank, { templates, ajv }),
        /letterType is required/
    );
});

test("parseAndValidateBodyWithDeps(): throws when letterData missing/not object/null", () => {
    const { templates, ajv } = makeFixtures();

    const missing = JSON.stringify({
        letterType: "tx45",
        contactPreference: "E",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(missing, { templates, ajv }),
        /letterData is required/
    );

    const notObject = JSON.stringify({
        letterType: "tx45",
        letterData: "nope",
        contactPreference: "E",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(notObject, { templates, ajv }),
        /letterData is required/
    );

    const isNull = JSON.stringify({
        letterType: "tx45",
        letterData: null,
        contactPreference: "E",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(isNull, { templates, ajv }),
        /letterData is required/
    );
});

test("parseAndValidateBodyWithDeps(): throws when contactPreference invalid", () => {
    const { templates, ajv } = makeFixtures();

    const payload = JSON.stringify({
        letterType: "tx45",
        letterData: { foo: "x" },
        contactPreference: "X",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(payload, { templates, ajv }),
        /contactPreference must be 'E' \(email\) or 'T' \(text\)/
    );
});

test("parseAndValidateBodyWithDeps(): requires userEmail for 'E'", () => {
    const { templates, ajv } = makeFixtures();

    const payload = JSON.stringify({
        letterType: "tx45",
        letterData: { foo: "x" },
        contactPreference: "E",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(payload, { templates, ajv }),
        /userEmail is required when contactPreference is 'E'/
    );
});

test("parseAndValidateBodyWithDeps(): requires userPhone for 'T'", () => {
    const { templates, ajv } = makeFixtures();

    const payload = JSON.stringify({
        letterType: "tx45",
        letterData: { foo: "x" },
        contactPreference: "T",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(payload, { templates, ajv }),
        /userPhone is required when contactPreference is 'T'/
    );
});

test("parseAndValidateBodyWithDeps(): throws ValidationError when AJV validation fails", () => {
    const { templates, ajv } = makeFixtures();

    const payload = JSON.stringify({
        letterType: "tx45",
        letterData: {}, // missing foo
        contactPreference: "E",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(payload, { templates, ajv }),
        (e) => {
            assert.ok(e instanceof ValidationError);
            assert.equal(e.message, "Letter validation failed");
            assert.ok(Array.isArray(e.details));
            return true;
        }
    );
});

test("parseAndValidateBodyWithDeps(): happy path returns parsed body", () => {
    const { templates, ajv } = makeFixtures();

    const valid = {
        letterType: "tx45",
        letterData: { foo: "hello" },
        contactPreference: "E",
        userEmail: "a@b.com",
    };

    const parsed = parseAndValidateBodyWithDeps(JSON.stringify(valid), { templates, ajv });
    assert.deepEqual(parsed, valid);
});

test("parseAndValidateBodyWithDeps(): unsupported letterType throws ValidationError with supportedTypes", () => {
    const { templates, ajv } = makeFixtures();

    const payload = JSON.stringify({
        letterType: "nope",
        letterData: { foo: "x" },
        contactPreference: "E",
        userEmail: "a@b.com",
    });

    assert.throws(
        () => parseAndValidateBodyWithDeps(payload, { templates, ajv }),
        (e) => {
            assert.ok(e instanceof ValidationError);
            assert.match(e.message, /Unsupported letterType: nope/);
            assert.deepEqual(e.details, { supportedTypes: ["tx45"] });
            return true;
        }
    );
});

test("generatePdfWithDeps(): invalid JSON throws ValidationError", async () => {
    const { templates, logger, letterBuilder } = makeFixtures();

    await assert.rejects(
        () => generatePdfWithDeps("{", "L-1", { templates, logger, letterBuilder }),
        (e) => {
            assert.ok(e instanceof ValidationError);
            assert.equal(e.message, "Invalid JSON in request body");
            return true;
        }
    );
});

test("generatePdfWithDeps(): missing letterType/letterData throws ValidationError", async () => {
    const { templates, logger, letterBuilder } = makeFixtures();

    const noType = JSON.stringify({ letterData: { foo: "x" } });
    await assert.rejects(
        () => generatePdfWithDeps(noType, "L-1", { templates, logger, letterBuilder }),
        /letterType is required/
    );

    const noData = JSON.stringify({ letterType: "tx45" });
    await assert.rejects(
        () => generatePdfWithDeps(noData, "L-1", { templates, logger, letterBuilder }),
        /letterData is required/
    );
});

test("generatePdfWithDeps(): logs and calls letterBuilder with expected previewData", async () => {
    const { templates, logger, letterBuilder } = makeFixtures();

    const payload = JSON.stringify({
        letterType: "tx45",
        letterData: { foo: "hello" },
        isPreview: true,
    });

    const result = await generatePdfWithDeps(payload, "LETTER-123", {
        templates,
        logger,
        letterBuilder,
    });

    assert.equal(logger.info.mock.calls.length, 1);
    assert.deepEqual(logger.info.mock.calls[0].arguments, [
        "Generating PDF",
        { letterType: "tx45", isPreview: true },
    ]);

    assert.equal(letterBuilder.mock.calls.length, 1);
    const calledWith = letterBuilder.mock.calls[0].arguments[0];

    assert.deepEqual(calledWith, {
        id: "LETTER-123",
        type: "pdf",
        schema: templates.tx45.sections[templates.tx45.routes.initial],
        isPreview: true,
        letterData: { foo: "hello" },
    });

    assert.deepEqual(result, { ok: true, previewData: calledWith });
});

test("generatePdfWithDeps(): unsupported letterType throws ValidationError with supportedTypes", async () => {
    const { templates, logger, letterBuilder } = makeFixtures();

    const payload = JSON.stringify({
        letterType: "nope",
        letterData: { foo: "x" },
    });

    await assert.rejects(
        () => generatePdfWithDeps(payload, "L-1", { templates, logger, letterBuilder }),
        (e) => {
            assert.ok(e instanceof ValidationError);
            assert.match(e.message, /Unsupported letterType: nope/);
            assert.deepEqual(e.details, { supportedTypes: ["tx45"] });
            return true;
        }
    );
});

test("generatePdfWithDeps(): template misconfigured throws ValidationError", async () => {
    const logger = { info: mock.fn() };
    const letterBuilder = mock.fn(async () => ({ ok: true }));

    const templates = {
        tx45: {
            inputSchema: { type: "object" },
            routes: { initial: "missing" },
            sections: { start: { sectionName: "StartSection" } },
        },
    };

    const payload = JSON.stringify({
        letterType: "tx45",
        letterData: { foo: "x" },
        isPreview: false,
    });

    await assert.rejects(
        () => generatePdfWithDeps(payload, "L-1", { templates, logger, letterBuilder }),
        /Template misconfigured/
    );
});
