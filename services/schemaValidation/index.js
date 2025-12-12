import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import addFormats from "ajv-formats";

const ajv = new Ajv({
    allErrors: true,
    coerceTypes: true,
    strict: false,
});

addFormats(ajv);
ajvErrors(ajv);

export default ajv;
