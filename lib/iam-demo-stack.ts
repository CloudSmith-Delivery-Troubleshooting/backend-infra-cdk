import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface IamDemoStackProps extends cdk.StackProps {
  prefix: string;
}

export class IamDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IamDemoStackProps) {
    super(scope, id, props);

    // This will fail during deployment due to insufficient IAM permissions
    // Most deployment roles don't have permissions to create roles with AdministratorAccess
    new iam.Role(this, 'AdminRole', {
      roleName: `${props.prefix}-demo-admin-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
      ],
    });

    // This will also likely fail - creating a role that can assume any role
    new iam.Role(this, 'CrossAccountRole', {
      roleName: `${props.prefix}-cross-account-role`,
      assumedBy: new iam.ArnPrincipal('*'),
      inlinePolicies: {
        AssumeAnyRole: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sts:AssumeRole'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });
  }
}