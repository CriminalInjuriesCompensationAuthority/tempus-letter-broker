# 📬 tempus-letter-broker

[![CI](https://github.com/CriminalInjuriesCompensationAuthority/tempus-letter-broker/actions/workflows/pipeline.yaml/badge.svg)](https://github.com/CriminalInjuriesCompensationAuthority/tempus-letter-broker/actions/workflows/pipeline.yaml)
[![Node.js 22](https://img.shields.io/badge/node-22-brightgreen?logo=node.js)](https://nodejs.org)
[![JavaScript](https://img.shields.io/badge/language-JavaScript-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

A thin AWS Lambda API layer that provides **letter management capabilities** to the Tempus case-management platform. It handles synchronous PDF preview generation and asynchronously delegates send and delete operations to the CICA letter service via SQS.

---

## ✨ Features

- 📄 **PDF preview generation** — renders a letter template to a PDF and stores it in S3
- 📤 **Letter send** — stores letter JSON in S3 and enqueues a `SEND` command for the downstream CICA letter service
- 🗑️ **Letter deletion** — enqueues `DELETE` commands scoped to a user, a case, or a specific letter
- ✅ **Schema validation** — AJV-powered request body validation with per-template JSON schemas
- 🪵 **Structured logging** — Pino-based structured logs with request ID propagation

---

## 🏗️ Architecture

```
Tempus (caller)
      │
      ▼
AWS API Gateway  ──►  Lambda (tempus-letter-broker)
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
               Amazon S3             Amazon SQS
          ┌────────────────┐      ┌────────────────┐
          │  Letters bucket │      │  Letter queue  │
          │  Preview bucket │      │ (SEND/DELETE)  │
          └────────────────┘      └────────┬───────┘
                                           ▼
                                   CICA Letter Service
```

---

## 🛣️ API Endpoints

Full OpenAPI 3.0 specification: [`openapi/openapi.yaml`](openapi/openapi.yaml)

| Method   | Path                                                            | Description                            |
|----------|-----------------------------------------------------------------|----------------------------------------|
| `POST`   | `/letters/{userId}/{caseReferenceNumber}/{letterId}/send`       | Store letter JSON and queue a SEND     |
| `POST`   | `/letters/{userId}/{caseReferenceNumber}/{letterId}/pdf`        | Generate and store a preview PDF       |
| `DELETE` | `/letters/{userId}/{caseReferenceNumber}/{letterId}`            | Queue deletion of a specific letter    |
| `DELETE` | `/letters/{userId}/{caseReferenceNumber}`                       | Queue deletion of all letters for a case |
| `DELETE` | `/letters/{userId}`                                             | Queue deletion of all letters for a user |

### Example — Send a letter

```http
POST /letters/user123/X%2F25%2F700123-TM2A/letter-abc/send
Content-Type: application/json

{
  "letterType": "TX45",
  "letterData": {
    "recipientName": "Jane Doe",
    "recipientAddress": {
      "street": "10 Clyde Place",
      "town": "Glasgow",
      "postcode": "G5 8AQ"
    }
  },
  "contactPreference": "E",
  "userEmail": "jane.doe@example.com"
}
```

**Response `200 OK`**
```json
{ "letterId": "letter-abc" }
```

### Example — Generate a preview PDF

```http
POST /letters/user123/X%2F25%2F700123-TM2A/letter-abc/pdf
Content-Type: application/json

{
  "letterType": "TX45",
  "letterData": { ... },
  "isPreview": true
}
```

**Response `201 Created`**
```json
{
  "letterId": "letter-abc",
  "uri": "s3://preview-bucket/25-700123/preview/letter-abc.pdf"
}
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js 22+](https://nodejs.org)
- AWS credentials configured (or a local mock such as [LocalStack](https://localstack.cloud))

### Install

```bash
npm install
```

### Environment variables

| Variable           | Description                                          |
|--------------------|------------------------------------------------------|
| `LETTER_QUEUE_URL` | SQS queue URL for letter commands                    |
| `LETTERS_BUCKET`   | S3 bucket name for letter JSON storage               |
| `KTA_DOCS_BUCKET`  | S3 bucket name for preview PDF storage               |
| `CICA_KMS_KEY`     | KMS key ID for encrypting letters bucket objects     |
| `DOCS_KMS_KEY`     | KMS key ID for encrypting preview bucket objects     |

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage
```

Tests use Node's built-in `node:test` runner with [esmock](https://github.com/iambumblehead/esmock) for ES module mocking.

---

## 🔍 Linting

```bash
npm run lint
```

[ESLint](https://eslint.org) is configured via `eslint.config.js`.

---

## 📁 Project Structure

```
tempus-letter-broker/
├── openapi/
│   └── openapi.yaml          # OpenAPI 3.0 specification
├── services/
│   ├── logger/               # Pino structured logger
│   ├── s3/                   # S3 put helpers (letters & preview PDFs)
│   ├── schemaValidation/     # AJV instance setup
│   └── sqs/                  # SQS send helpers (SEND & DELETE messages)
└── src/
    ├── handler.js             # Lambda entrypoint — routing & error handling
    ├── handlers/              # Route handler functions
    ├── routes/                # Route resolution table
    └── utils/                 # Body parsing, validation, PDF generation, responses
```

---

## 🔒 Security

All objects written to S3 are encrypted at rest using **AWS KMS** (`aws:kms`). Each S3 bucket uses a dedicated KMS key configured via environment variables.

---

## 📜 License

[ISC](https://opensource.org/licenses/ISC) © Criminal Injuries Compensation Authority
