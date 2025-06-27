# Backend Infrastructure CDK

A comprehensive AWS CDK (Cloud Development Kit) application written in TypeScript that deploys a production-ready backend infrastructure using ECS Fargate, Application Load Balancer, CloudWatch monitoring, and ECR image repository.

## 🏗️ Architecture

This CDK app deploys the following AWS resources:

- **VPC** with public and private subnets across 2 AZs
- **ECR Repository** for storing container images
- **ECS Fargate Cluster** for container orchestration
- **Application Load Balancer (ALB)** for traffic distribution
- **CloudWatch Log Group** for centralized logging
- **CloudWatch Alarms** for monitoring and alerting
- **SNS Topic** for alarm notifications
- **Auto Scaling** based on CPU and memory utilization

## 📁 Project Structure

```
backend-infra-cdk/
├── bin/
│   └── app.ts                 # CDK app entry point
├── lib/
│   └── backend-infra-stack.ts # Main infrastructure stack
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions workflow
├── package.json               # Node.js dependencies
├── cdk.json                   # CDK configuration
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed globally: `npm install -g aws-cdk`
- Docker (for building container images)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd backend-infra-cdk
   npm install
   ```

2. **Set environment variables:**
   ```bash
   export PREFIX=dev                    # Resource prefix
   export AWS_ACCOUNT_ID=123456789012   # Your AWS account ID
   export AWS_REGION=us-east-1          # Your preferred region
   ```

3. **Bootstrap CDK (first time only):**
   ```bash
   npm run bootstrap
   ```

4. **Build and synthesize:**
   ```bash
   npm run build
   npm run synth
   ```

5. **Deploy the stack:**
   ```bash
   npm run deploy
   ```

### Environment Variables

The `PREFIX` environment variable is used to prefix all resource names, allowing multiple deployments of the same stack without conflicts:

- **PREFIX**: Resource prefix (e.g., "dev", "staging", "prod")
- **AWS_ACCOUNT_ID**: Your AWS account ID
- **AWS_REGION**: Target AWS region

## 🔄 GitHub Actions CI/CD

### Setup GitHub Secrets

Configure the following secrets in your GitHub repository:

- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key  
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: Target AWS region (e.g., us-east-1)

### Workflow Triggers

The workflow is triggered by:

1. **Push to main branch** → Deploys to production (`PREFIX=prod`)
2. **Push to develop branch** → Deploys to staging (`PREFIX=staging`)
3. **Pull Request** → Shows CDK diff (`PREFIX=pr-{number}`)
4. **Manual dispatch** → Deploy with custom prefix

### Workflow Jobs

1. **lint-and-test**: Runs on all triggers
   - Installs dependencies
   - Builds TypeScript
   - Runs tests

2. **cdk-diff**: Runs on pull requests
   - Shows infrastructure changes
   - Helps with code review

3. **deploy**: Runs on push to main/develop or manual trigger
   - Bootstraps CDK if needed
   - Deploys infrastructure
   - Uploads deployment outputs

4. **cleanup-pr**: Runs when PR is closed (optional)
   - Destroys PR-specific resources
   - Prevents resource accumulation

## 📊 Monitoring and Alarms

The stack includes comprehensive CloudWatch alarms:

- **High CPU Utilization** (>80%)
- **High Memory Utilization** (>85%)
- **Unhealthy Load Balancer Targets**
- **HTTP 5xx Error Rate**
- **High Response Time** (>2 seconds)
- **Low Task Count** (service down)

All alarms publish to an SNS topic for notifications.

## 🐳 Container Application

Your containerized application should:

1. **Listen on port 3000** (configurable via environment)
2. **Provide a health check endpoint** at `/health`
3. **Be built and pushed to the ECR repository**

Example Dockerfile:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["npm", "start"]
```

## 🔧 Stack Outputs

After deployment, the stack provides these outputs:

- **LoadBalancerDNS**: URL to access your application
- **ECRRepositoryURI**: URI for pushing container images
- **ClusterName**: ECS cluster name
- **ServiceName**: ECS service name
- **LogGroupName**: CloudWatch log group name
- **SNSTopicArn**: SNS topic for alarm notifications

## 📝 Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run watch` | Watch for changes |
| `npm test` | Run tests |
| `npm run synth` | Synthesize CloudFormation |
| `npm run deploy` | Deploy the stack |
| `npm run destroy` | Destroy the stack |
| `npm run diff` | Show differences |

## 🔐 Security Best Practices

- ECR image scanning enabled
- VPC with private subnets for ECS tasks
- Security groups with minimal required access
- CloudWatch logs with retention policy
- IAM roles with least privilege principle

## 💰 Cost Optimization

- Fargate Spot instances for non-critical workloads
- CloudWatch log retention set to 1 month
- Auto-scaling based on metrics
- ALB with deletion protection disabled for dev environments

## 🧪 Testing

Run tests with:
```bash
npm test
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [ECS Patterns](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns-readme.html)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
