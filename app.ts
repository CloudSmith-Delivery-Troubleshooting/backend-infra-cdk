#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendInfraStack } from './backend-infra-stack';

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

app.synth();
