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
    const vpc = new ec2.Vpc(scope, `${prefix}-VPC`, {
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
    const ecrRepository = new ecr.Repository(scope, `${prefix}-ECR-Repository`, {
      repositoryName: `${prefix}-backend-app`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      imageScanOnPush: true,
    });

    // Create ECS Cluster
    const cluster = new ecs.Cluster(scope, `${prefix}-ECS-Cluster`, {
      clusterName: `${prefix}-backend-cluster`,
      vpc,
      containerInsights: true,
    });

    // Create CloudWatch Log Group
    const logGroup = new logs.LogGroup(scope, `${prefix}-Log-Group`, {
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
        desiredCount: 2,
        listenerPort: 80,
        publicLoadBalancer: true,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest'),
          containerName: `${prefix}-backend-container`,
          containerPort: 3000,
          logDriver: ecs.LogDriver.awsLogs({
            streamPrefix: 'ecs',
            logGroup: logGroup,
          }),
          environment: {
            NODE_ENV: 'production',
            PORT: '3000',
          },
        },
        loadBalancerName: `${prefix}-ALB`,
        cloudMapOptions: {
          name: `${prefix}-backend`,
        },
      }
    );

    // Configure health check
    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
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

    // Create SNS Topic for Alarms
    const alarmTopic = new sns.Topic(scope, `${prefix}-Alarm-Topic`, {
      topicName: `${prefix}-backend-alarms`,
      displayName: `${prefix} Backend Infrastructure Alarms`,
    });

    // CloudWatch Alarms

    // High CPU Utilization Alarm
    const highCpuAlarm = new cloudwatch.Alarm(scope, `${prefix}-High-CPU-Alarm`, {
      alarmName: `${prefix}-HighCPUUtilization`,
      alarmDescription: 'Alarm when CPU exceeds 80%',
      metric: fargateService.service.metricCpuUtilization({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    highCpuAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // High Memory Utilization Alarm
    const highMemoryAlarm = new cloudwatch.Alarm(scope, `${prefix}-High-Memory-Alarm`, {
      alarmName: `${prefix}-HighMemoryUtilization`,
      alarmDescription: 'Alarm when Memory exceeds 85%',
      metric: fargateService.service.metricMemoryUtilization({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 85,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    highMemoryAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Application Load Balancer Target Unhealthy Alarm
    const unhealthyTargetsAlarm = new cloudwatch.Alarm(scope, `${prefix}-Unhealthy-Targets-Alarm`, {
      alarmName: `${prefix}-UnhealthyTargets`,
      alarmDescription: 'Alarm when there are unhealthy targets behind the load balancer',
      metric: fargateService.targetGroup.metricUnhealthyHostCount({
        period: cdk.Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 1, 
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    unhealthyTargetsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // HTTP 5xx Error Rate Alarm
    const http5xxAlarm = new cloudwatch.Alarm(scope, `${prefix}-HTTP-5xx-Alarm`, {
      alarmName: `${prefix}-HTTP5xxErrors`,
      alarmDescription: 'Alarm when HTTP 5xx error rate is high',
      metric: fargateService.loadBalancer.metricHttpCodeTarget(
        cdk.aws_elasticloadbalancingv2.HttpCodeTarget.TARGET_5XX_COUNT,
        {
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }
      ),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    http5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Response Time Alarm
    const responseTimeAlarm = new cloudwatch.Alarm(scope, `${prefix}-Response-Time-Alarm`, {
      alarmName: `${prefix}-HighResponseTime`,
      alarmDescription: 'Alarm when response time exceeds 2 seconds',
      metric: fargateService.loadBalancer.metricTargetResponseTime({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 2,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    responseTimeAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Task Count Alarm (for when service is down)
    const taskCountAlarm = new cloudwatch.Alarm(scope, `${prefix}-Task-Count-Alarm`, {
      alarmName: `${prefix}-LowTaskCount`,
      alarmDescription: 'Alarm when running task count is below desired',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ServiceName: fargateService.service.serviceName,
          ClusterName: cluster.clusterName,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    taskCountAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Outputs
    new cdk.CfnOutput(scope, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: `${prefix}-LoadBalancerDNS`,
    });

    new cdk.CfnOutput(scope, 'ECRRepositoryURI', {
      value: ecrRepository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${prefix}-ECRRepositoryURI`,
    });

    new cdk.CfnOutput(scope, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `${prefix}-ClusterName`,
    });

    new cdk.CfnOutput(scope, 'ServiceName', {
      value: fargateService.service.serviceName,
      description: 'ECS Service Name',
      exportName: `${prefix}-ServiceName`,
    });

    new cdk.CfnOutput(scope, 'LogGroupName', {
      value: logGroup.logGroupName,
      description: 'CloudWatch Log Group Name',
      exportName: `${prefix}-LogGroupName`,
    });

    new cdk.CfnOutput(scope, 'SNSTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS Topic ARN for Alarms',
      exportName: `${prefix}-SNSTopicArn`,
    });
  }
}
