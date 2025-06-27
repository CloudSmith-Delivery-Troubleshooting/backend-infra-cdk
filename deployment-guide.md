# 🚀 Backend Infrastructure CDK - Deployment Guide

## Quick Setup Checklist

### ✅ Prerequisites
- [ ] Node.js 18+ installed
- [ ] AWS CLI configured
- [ ] AWS CDK CLI installed: `npm install -g aws-cdk`
- [ ] Docker installed (for container images)
- [ ] GitHub repository with Actions enabled

### ✅ Repository Setup
1. **Clone/Download the CDK project files**
2. **Install dependencies**: `npm install`
3. **Configure GitHub Secrets**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_ACCOUNT_ID`
   - `AWS_REGION`

### ✅ Local Development
```bash
# Set environment variables
export PREFIX=dev
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1

# Bootstrap CDK (first time only)
npm run bootstrap

# Deploy locally
npm run deploy
```

## 🌍 Environment Strategy

| Branch | Environment | PREFIX | Purpose |
|--------|-------------|--------|---------|
| `main` | Production | `prod` | Live production environment |
| `develop` | Staging | `staging` | Pre-production testing |
| Feature branches | Development | `dev` | Development work |
| Pull Requests | Preview | `pr-{number}` | Code review environments |

## 📋 Deployment Workflow

### Automatic Deployments
- **Push to `main`** → Deploy to production (`prod` prefix)
- **Push to `develop`** → Deploy to staging (`staging` prefix)
- **Pull Request** → Show infrastructure diff
- **Manual Trigger** → Deploy with custom prefix

### Manual Deployment
```bash
# Using GitHub Actions UI
# 1. Go to Actions tab
# 2. Select "Deploy Backend Infrastructure CDK"
# 3. Click "Run workflow"
# 4. Choose environment and optional custom prefix
```

## 🏗️ Infrastructure Components

### Core Resources (per environment)
- **VPC**: `{PREFIX}-VPC`
- **ECS Cluster**: `{PREFIX}-backend-cluster`
- **ALB**: `{PREFIX}-ALB`
- **ECR Repository**: `{PREFIX}-backend-app`
- **Log Group**: `/aws/ecs/{PREFIX}-backend-app`
- **SNS Topic**: `{PREFIX}-backend-alarms`

### Monitoring & Alarms
- CPU Utilization > 80%
- Memory Utilization > 85%
- HTTP 5xx Error Rate
- Response Time > 2 seconds
- Unhealthy Load Balancer Targets
- Low Task Count (service down)

## 🐳 Container Application Requirements

Your containerized application must:

1. **Listen on port 3000** (configurable)
2. **Provide health check at `/health`**
3. **Be pushed to the ECR repository**

### Example Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["npm", "start"]
```

### Example Health Check Endpoint
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## 📊 Stack Outputs

After deployment, access these values:

```bash
# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name ${PREFIX}-BackendInfraStack \
  --query 'Stacks[0].Outputs'
```

Key outputs:
- **LoadBalancerDNS**: Application URL
- **ECRRepositoryURI**: For pushing images
- **ClusterName**: ECS cluster identifier
- **ServiceName**: ECS service identifier
- **LogGroupName**: CloudWatch logs location
- **SNSTopicArn**: Alarm notifications

## 🔧 Common Commands

```bash
# Build and test locally
npm run build
npm test

# View infrastructure diff
npm run diff

# Deploy to specific environment
PREFIX=staging npm run deploy

# Destroy environment
PREFIX=dev npm run destroy

# Push container image to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

docker build -t $ECR_URI:latest .
docker push $ECR_URI:latest
```

## 🔍 Troubleshooting

### Common Issues

**Issue**: CDK bootstrap error
```bash
# Solution: Bootstrap with specific profile/region
cdk bootstrap aws://ACCOUNT-ID/REGION
```

**Issue**: ECR push permission denied
```bash
# Solution: Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI
```

**Issue**: Health check failing
- Verify `/health` endpoint returns 200 status
- Check container logs in CloudWatch
- Ensure application listens on port 3000

**Issue**: Auto-scaling not working
- Check CloudWatch metrics are publishing
- Verify scaling policies in ECS console
- Review alarm states in CloudWatch

### Debugging Steps

1. **Check GitHub Actions logs**
2. **Review CloudFormation events**
3. **Examine ECS service events**
4. **Monitor CloudWatch logs**
5. **Verify security group rules**

## 🔐 Security Best Practices

- ✅ ECR image scanning enabled
- ✅ VPC with private subnets for tasks
- ✅ Security groups with minimal access
- ✅ IAM roles with least privilege
- ✅ CloudWatch logs with retention
- ✅ No hardcoded secrets in code

## 💰 Cost Optimization

- Use Fargate Spot for dev environments
- Set appropriate log retention periods
- Configure auto-scaling policies
- Monitor and adjust resource allocation
- Clean up unused environments regularly

## 📈 Monitoring Dashboard

Key metrics to monitor:
- **Application**: Response time, error rate, throughput
- **Infrastructure**: CPU, memory, network utilization
- **ECS**: Task count, service health, deployment status
- **ALB**: Request count, target health, latency

## 🆘 Emergency Procedures

### Rollback Deployment
```bash
# Revert to previous image tag
aws ecs update-service \
  --cluster ${PREFIX}-backend-cluster \
  --service ${PREFIX}-backend-service \
  --task-definition PREVIOUS_TASK_DEFINITION
```

### Scale Service Manually
```bash
# Increase task count
aws ecs update-service \
  --cluster ${PREFIX}-backend-cluster \
  --service ${PREFIX}-backend-service \
  --desired-count 5
```

### Stop All Tasks
```bash
# For emergency shutdown
aws ecs update-service \
  --cluster ${PREFIX}-backend-cluster \
  --service ${PREFIX}-backend-service \
  --desired-count 0
```

---

## 📞 Support

For issues and questions:
1. Check GitHub Actions logs
2. Review AWS CloudFormation events
3. Examine CloudWatch logs and metrics
4. Contact your DevOps team