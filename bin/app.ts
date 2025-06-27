#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendInfraStack } from '../lib/backend-infra-stack';
import { Ec2TestStack } from '../lib/ec2-test-stack';

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
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-west-2',
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

// Create EC2 test stack to reproduce us-west-2d availability error
new Ec2TestStack(app, `${prefix}-Ec2TestStack`, {
  env,
  description: 'EC2 test stack to reproduce t2.micro availability error in us-west-2d',
});

app.synth();
