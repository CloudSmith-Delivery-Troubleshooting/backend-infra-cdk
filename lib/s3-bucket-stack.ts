import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3BucketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CloudFormation parameter with no default - will fail deployment if not provided
    const bucketNameParam = new cdk.CfnParameter(this, 'BucketName', {
      type: 'String',
      description: 'Name for the S3 bucket',
    });

    new s3.Bucket(this, 'DemoBucket', {
      bucketName: bucketNameParam.valueAsString,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}