import test from "node:test";
import assert from "node:assert/strict";

import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import esmock from "esmock";

import { ValidationError } from "../../src/utils/index.js";

const SPEC_PATH = "./openapi/openapi.yaml";

function makeAjv() {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv;
}

function getJsonResponseSchema(derefSpec, path, method, status) {
    const op = derefSpec.paths?.[path]?.[method];
    assert(op, `Missing operation for ${method.toUpperCase()} ${path}`);

    const resp = op.responses?.[status];
    assert(resp, `Missing response ${status} for ${method.toUpperCase()} ${path}`);

    const schema = resp.content?.["application/json"]?.schema;
    assert(schema, `Missing application/json schema for ${method.toUpperCase()} ${path} ${status}`);

    return schema;
}

function getComponentSchema(derefSpec, name) {
    const schema = derefSpec.components?.schemas?.[name];
    assert(schema, `Missing components.schemas.${name}`);
    return schema;
}

function makeEvent({ method, resource, path, pathParameters, body }) {
    return {
        httpMethod: method,
        resource,
        path,
        pathParameters,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : null,
        isBase64Encoded: false,
        requestContext: { requestId: "contract-test" },
    };
}

async function loadHandlerWithMockedRoute(routeHandler) {
    const mod = await esmock("../../src/handler.js", {
        "../../services/logger/index.js": {
            logger: {
                info: () => {},
                warn: () => {},
                error: () => {},
            },
        },
        "../../src/routes/index.js": {
            resolveRoute: () => routeHandler,
        },
    });

    return mod.handler;
}

function assertValid(ajv, schema, value, contextLabel) {
    const validate = ajv.compile(schema);
    const ok = validate(value);
    assert.equal(
        ok,
        true,
        `${contextLabel} did not match schema:\n${JSON.stringify(validate.errors, null, 2)}\nValue:\n${JSON.stringify(value, null, 2)}`,
    );
}

let derefSpec;
let ajv;

test("OpenAPI validates and dereferences", async () => {
    // Validate spec is proper OpenAPI
    await SwaggerParser.validate(SPEC_PATH);

    // Dereference so $refs are resolved for AJV validation
    derefSpec = await SwaggerParser.dereference(SPEC_PATH);

    ajv = makeAjv();

    assert(derefSpec.paths["/letters/{userId}"]);
    assert(derefSpec.paths["/letters/{userId}/{caseReferenceNumber}/{letterId}/pdf"]);
    assert(derefSpec.components?.schemas?.ErrorResponse);
});

test("POST /letters/.../pdf returns 201 body matching GenerateLetterResponse", async () => {
    assert(derefSpec && ajv, "Spec not initialised");

    const schema201 = getJsonResponseSchema(
        derefSpec,
        "/letters/{userId}/{caseReferenceNumber}/{letterId}/pdf",
        "post",
        "201",
    );

    const handler = await loadHandlerWithMockedRoute(async () => {
        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                letterId: "letter-123",
                uri: "s3://preview-bucket/preview/u/c/letter-123-1699900000000.pdf",
            }),
        };
    });

    const event = makeEvent({
        method: "POST",
        resource: "/letters/{userId}/{caseReferenceNumber}/{letterId}/pdf",
        path: "/letters/u/c/letter-123/pdf",
        pathParameters: { userId: "u", caseReferenceNumber: "c", letterId: "letter-123" },
        body: { any: "thing" }
    });

    const res = await handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 201);
    const json = JSON.parse(res.body);

    assertValid(ajv, schema201, json, "201 GenerateLetterResponse");
});

test("POST /letters/.../send returns 200 body matching SendLetterResponse", async () => {
    assert(derefSpec && ajv, "Spec not initialised");

    const schema200 = getJsonResponseSchema(
        derefSpec,
        "/letters/{userId}/{caseReferenceNumber}/{letterId}/send",
        "post",
        "200",
    );

    const handler = await loadHandlerWithMockedRoute(async () => {
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ letterId: "letter-456" }),
        };
    });

    const event = makeEvent({
        method: "POST",
        resource: "/letters/{userId}/{caseReferenceNumber}/{letterId}/send",
        path: "/letters/u/c/letter-456/send",
        pathParameters: { userId: "u", caseReferenceNumber: "c", letterId: "letter-456" },
        body: { any: "thing" },
    });

    const res = await handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);

    assertValid(ajv, schema200, json, "200 SendLetterResponse");
});

test("DELETE /letters/{userId} returns 204 with no body", async () => {
    const handler = await loadHandlerWithMockedRoute(async () => {
        return { statusCode: 204 };
    });

    const event = makeEvent({
        method: "DELETE",
        resource: "/letters/{userId}",
        path: "/letters/u",
        pathParameters: { userId: "u" },
    });

    const res = await handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 204);
});

test("DELETE /letters/{userId}/{caseReferenceNumber} returns 204 with no body", async () => {
    const handler = await loadHandlerWithMockedRoute(async () => {
        return { statusCode: 204 };
    });

    const event = makeEvent({
        method: "DELETE",
        resource: "/letters/{userId}/{caseReferenceNumber}",
        path: "/letters/u/c",
        pathParameters: { userId: "u", caseReferenceNumber: "c" },
    });

    const res = await handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 204);
});

test("DELETE /letters/{userId}/{caseReferenceNumber}/{letterId} returns 204 with no body", async () => {
    const handler = await loadHandlerWithMockedRoute(async () => {
        return { statusCode: 204 };
    });

    const event = makeEvent({
        method: "DELETE",
        resource: "/letters/{userId}/{caseReferenceNumber}/{letterId}",
        path: "/letters/u/c/l",
        pathParameters: { userId: "u", caseReferenceNumber: "c", letterId: "l" },
    });

    const res = await handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 204);
});

test("ValidationError becomes 400 matching ErrorResponse schema (for POST endpoints)", async () => {
    assert(derefSpec && ajv, "Spec not initialised");

    const errorSchema = getComponentSchema(derefSpec, "ErrorResponse");

    const handler = await loadHandlerWithMockedRoute(async () => {
        throw new ValidationError("Invalid request body", { field: "letterType" });
    });

    const event = makeEvent({
        method: "POST",
        resource: "/letters/{userId}/{caseReferenceNumber}/{letterId}/pdf",
        path: "/letters/u/c/l/pdf",
        pathParameters: { userId: "u", caseReferenceNumber: "c", letterId: "l" },
        body: { junk: true },
    });

    const res = await handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 400);

    const json = JSON.parse(res.body);
    assertValid(ajv, errorSchema, json, "400 ErrorResponse");
});

test("Unexpected errors become 500 matching ErrorResponse schema", async () => {
    assert(derefSpec && ajv, "Spec not initialised");

    const errorSchema = getComponentSchema(derefSpec, "ErrorResponse");

    const handler = await loadHandlerWithMockedRoute(async () => {
        throw new Error("Boom");
    });

    const event = makeEvent({
        method: "POST",
        resource: "/letters/{userId}/{caseReferenceNumber}/{letterId}/send",
        path: "/letters/u/c/l/send",
        pathParameters: { userId: "u", caseReferenceNumber: "c", letterId: "l" },
        body: { junk: true },
    });

    const res = await handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 500);

    const json = JSON.parse(res.body);
    assertValid(ajv, errorSchema, json, "500 ErrorResponse");
});

test("No matching route becomes 404 matching ErrorResponse schema", async () => {
    assert(derefSpec && ajv, "Spec not initialised");

    const errorSchema = getComponentSchema(derefSpec, "ErrorResponse");

    const mod = await esmock("../../src/handler.js", {
        "../../services/logger/index.js": {
            logger: { info: () => {}, warn: () => {}, error: () => {} },
        },
        "../../src/routes/index.js": {
            resolveRoute: () => null,
        },
    });

    const event = makeEvent({
        method: "GET",
        resource: "/nope",
        path: "/nope",
    });

    const res = await mod.handler(event, { awsRequestId: "contract-test" });

    assert.equal(res.statusCode, 404);

    const json = JSON.parse(res.body);
    assertValid(ajv, errorSchema, json, "404 ErrorResponse");
});
