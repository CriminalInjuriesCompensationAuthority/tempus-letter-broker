import { handleSend, handlePreview, handleDeleteUser, handleDeleteCase, handleDeleteLetter } from "../handlers/index.js";

const routes = {
    "DELETE:/letters/{userId}": handleDeleteUser,
    "DELETE:/letters/{userId}/{caseReferenceNumber}": handleDeleteCase,
    "DELETE:/letters/{userId}/{caseReferenceNumber}/{letterId}": handleDeleteLetter,
    "POST:/letters/{userId}/{caseReferenceNumber}/{letterId}/send": handleSend,
    "POST:/letters/{userId}/{caseReferenceNumber}/{letterId}/pdf": handlePreview,
};

export function resolveRoute(method, resourceOrPath) {
    const routeKey = `${method}:${resourceOrPath}`;
    return routes[routeKey] || null;
}
