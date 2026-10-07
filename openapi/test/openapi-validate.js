import SwaggerParser from "@apidevtools/swagger-parser";

const SPEC_PATH = process.env.OPENAPI_SPEC_PATH || "openapi/openapi.yaml";

async function main() {
    try {
        await SwaggerParser.validate(SPEC_PATH);
        console.log(`OpenAPI valid: ${SPEC_PATH}`);
    } catch (err) {
        console.error(`OpenAPI invalid: ${SPEC_PATH}`);
        console.error(err?.message ?? err);
        process.exitCode = 1;
    }
}

await main();
