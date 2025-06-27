#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendInfraStack } from '../lib/backend-infra-stack';
import { S3BucketStack } from '../lib/s3-bucket-stack';
import { AsyncWorkerStack } from '../lib/async-worker-stack';

const app = new cdk.App();

// Get the PREFIX from environment variable or use default
const prefix = process.env.PREFIX || 'dev';

// Validate prefix format
if (!/^[a-zA-Z0-9-]+$/.test(prefix)) {
  throw new Error('PREFIX must only contain alphanumeric characters and hyphens');
}

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
};

// Create the stack with prefix
new BackendInfraStack(app, `${prefix}-BackendInfraStack`, {
  prefix,
  env,
  description: `Backend Infrastructure Stack with prefix: ${prefix}`,
  tags: {
    Environment: prefix,
    Project: 'backend-infra-cdk',
    ManagedBy: 'CDK',
  },
});

// Create stack with missing required CFN parameter - will fail deployment without parameter
new S3BucketStack(app, `${prefix}-S3BucketStack`, {
  env,
  description: 'Stack demonstrating missing required CloudFormation parameter error',
});

// Create stack for async worker
new AsyncWorkerStack(app, `${prefix}-AsyncWorkerStack`, {
  env,
  description: 'Stack adding multiple resources for async worker',
});

app.synth();
