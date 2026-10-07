'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import getSecret from './index.js';

test('Secret Manager service: should throw when no profile / not in test mode', async () => {
    const prevEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    try {
        await assert.rejects(
            () => getSecret('tempus-letter-broker-test'),
        );
    } finally {
        if (prevEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevEnv;
    }
});

test('Secret Manager service: should retrieve secrets from a given arn with profile', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const secretsMock = mockClient(SecretsManagerClient);
    secretsMock.reset();

    secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: 'test',
    });

    try {
        const param = await getSecret('tempus-letter-broker-test');
        assert.match(param, /test/);
    } finally {
        secretsMock.reset();
        if (prevEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevEnv;
    }
});
