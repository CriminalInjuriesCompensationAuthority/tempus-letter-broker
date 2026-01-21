'use strict';

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Gets a secret given an arn
export default async function getSecret(arn) {
    const client = new SecretsManagerClient({
        region: 'eu-west-2',
    });

    const command = new GetSecretValueCommand({ SecretId: arn });
    const response = await client.send(command);

    return response.SecretString;
}
