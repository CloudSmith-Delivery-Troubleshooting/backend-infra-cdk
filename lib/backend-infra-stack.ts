import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface BackendInfraStackProps extends cdk.StackProps {
  readonly prefix: string;
}

export class BackendInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BackendInfraStackProps) {
    super(scope, id, props);

    const { prefix } = props;

    // Create VPC
    const vpc = new ec2.Vpc(this, `${prefix}-VPC`, {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${prefix}-Public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `${prefix}-Private`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create ECR Repository
    const ecrRepository = new ecr.Repository(this, `${prefix}-ECR-Repository`, {
      repositoryName: `${prefix}-backend-app`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      imageScanOnPush: true,
    });

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, `${prefix}-ECS-Cluster`, {
      clusterName: `${prefix}-backend-cluster`,
      vpc,
      containerInsights: true,
    });

    // Create CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, `${prefix}-Log-Group`, {
      logGroupName: `/aws/ecs/${prefix}-backend-app`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Fargate Service with Application Load Balancer
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      `${prefix}-Fargate-Service`,
      {
        serviceName: `${prefix}-backend-service`,
        cluster,
        cpu: 512,
        memoryLimitMiB: 1024,
        desiredCount: 1,
        listenerPort: 80,
        publicLoadBalancer: true,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('myproject/web.server'),
          containerName: `${prefix}-backend-container`,
          containerPort: 3000,
          logDriver: ecs.LogDriver.awsLogs({
            streamPrefix: 'ecs',
            logGroup: logGroup,
          }),
          entryPoint: ['python', '-m', 'http.server', '3000'],
        },
        loadBalancerName: `${prefix}-ALB`,
      }
    );

    // Configure health check
    fargateService.targetGroup.configureHealthCheck({
      path: '/',
      port: '3000',
      protocol: cdk.aws_elasticloadbalancingv2.Protocol.HTTP,
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Auto Scaling
    const scalableTarget = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scalableTarget.scaleOnCpuUtilization(`${prefix}-CPU-Scaling`, {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(300),
    });

    scalableTarget.scaleOnMemoryUtilization(`${prefix}-Memory-Scaling`, {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(300),
    });

    // Grant ECR permissions to task role
    ecrRepository.grantPull(fargateService.taskDefinition.taskRole);

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: `${prefix}-LoadBalancerDNS`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: ecrRepository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${prefix}-ECRRepositoryURI`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `${prefix}-ClusterName`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: fargateService.service.serviceName,
      description: 'ECS Service Name',
      exportName: `${prefix}-ServiceName`,
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: logGroup.logGroupName,
      description: 'CloudWatch Log Group Name',
      exportName: `${prefix}-LogGroupName`,
    });


  }
}
