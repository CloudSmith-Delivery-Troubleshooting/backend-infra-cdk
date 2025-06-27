import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BackendInfraStack } from './backend-infra-stack';

describe('BackendInfraStack', () => {
  let app: cdk.App;
  let stack: BackendInfraStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new BackendInfraStack(app, 'TestStack', {
      prefix: 'test',
    });
    template = Template.fromStack(stack);
  });

  test('VPC is created', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
    });
  });

  test('ECR Repository is created', () => {
    template.hasResourceProperties('AWS::ECR::Repository', {
      RepositoryName: 'test-backend-app',
      ImageScanningConfiguration: {
        ScanOnPush: true,
      },
    });
  });

  test('ECS Cluster is created', () => {
    template.hasResourceProperties('AWS::ECS::Cluster', {
      ClusterName: 'test-backend-cluster',
      ClusterSettings: [
        {
          Name: 'containerInsights',
          Value: 'enabled',
        },
      ],
    });
  });

  test('Application Load Balancer is created', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Name: 'test-ALB',
      Scheme: 'internet-facing',
      Type: 'application',
    });
  });

  test('CloudWatch Log Group is created', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/ecs/test-backend-app',
      RetentionInDays: 30,
    });
  });

  test('ECS Service is created with correct configuration', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      ServiceName: 'test-backend-service',
      DesiredCount: 2,
      LaunchType: 'FARGATE',
    });
  });

  test('CloudWatch Alarms are created', () => {
    // Test for CPU alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'test-HighCPUUtilization',
      MetricName: 'CPUUtilization',
      Threshold: 80,
    });

    // Test for Memory alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'test-HighMemoryUtilization',
      MetricName: 'MemoryUtilization',
      Threshold: 85,
    });
  });

  test('SNS Topic for alarms is created', () => {
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'test-backend-alarms',
      DisplayName: 'test Backend Infrastructure Alarms',
    });
  });

  test('Auto Scaling policies are created', () => {
    template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
      PolicyType: 'TargetTrackingScaling',
    });
  });

  test('Stack outputs are defined', () => {
    template.hasOutput('LoadBalancerDNS', {});
    template.hasOutput('ECRRepositoryURI', {});
    template.hasOutput('ClusterName', {});
    template.hasOutput('ServiceName', {});
    template.hasOutput('LogGroupName', {});
    template.hasOutput('SNSTopicArn', {});
  });

  test('Resources are properly tagged', () => {
    // Test that stack has proper tags
    expect(stack.tags.tagValues()).toMatchObject({
      Environment: 'test',
      Project: 'backend-infra-cdk',
      ManagedBy: 'CDK',
    });
  });

  test('Resource names are properly prefixed', () => {
    // Verify that resources follow the naming convention
    const resources = template.findResources('AWS::ECR::Repository');
    const resourceKeys = Object.keys(resources);
    expect(resourceKeys.some(key => key.includes('test'))).toBe(true);
  });
});
