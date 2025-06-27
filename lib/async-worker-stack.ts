import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class AsyncWorkerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // User uploads bucket
    new s3.Bucket(this, 'UserUploadsBucket', {
      bucketName: 'My-Company-User-Uploads-BUCKET',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Application data storage bucket
    new s3.Bucket(this, 'AppDataBucket', {
      bucketName: 'application-data-storage-bucket-for-our-microservices-architecture-system',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Image processing function
    new lambda.Function(this, 'ImageProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => {};'),
      memorySize: 64, // Lightweight processing
    });

    // Session data table
    new dynamodb.Table(this, 'SessionTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.KEYS_ONLY,
      timeToLiveAttribute: 'expires-at!',
    });
  }
}