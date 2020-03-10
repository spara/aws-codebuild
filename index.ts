import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

const builderRole = new aws.iam.Role('builder-role', {
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'codebuild.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    },
  });
  
  // Create a policy for the role
const rolePolicy = new aws.iam.RolePolicy("builder-role-policy", {
    role: builderRole,
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: [
                "codebuild:CreateProject"
            ],
            Effect: "Allow",
            Resource: "*"
        },
        {
            Effect: "Allow",
            Action: "iam:PassRole",
            Resource: "*"
        }
    ]
    })
});

// Create policy for the user
const policy = new aws.iam.Policy("mypolicy", {
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: [
                "codebuild:CreateProject"
            ],
            Effect: "Allow",
            Resource: "*"
        }]
    })
});

// Attach user policy to the role
const rolePolicyAttachment = new aws.iam.RolePolicyAttachment("rolepolicyattachment", {
    role: builderRole,
    policyArn: policy.arn,
});

const user = new aws.iam.User("myuser");

const group = new aws.iam.Group("mygroup");

const policyAttachment = new aws.iam.PolicyAttachment("mypolicyattachment", {
    users: [user],
    groups: [group],
    roles: [builderRole],
    policyArn: policy.arn
});

// instance of configuration
const config = new pulumi.Config();

// retrieve the github token as a secret
new aws.codebuild.SourceCredential('github-token', {
  authType: 'PERSONAL_ACCESS_TOKEN',
  serverType: 'GITHUB',
  token: config.requireSecret('github-token'),
});

// Retrieve the Pulumi token as a secret
const pulumiAccessToken = new aws.ssm.Parameter('pulumi-access-token', {
  type: 'String',
  value: config.requireSecret('pulumi-access-token'),
});

const buildProject = new aws.codebuild.Project("aws-codebuild", {
  serviceRole: builderRole.arn,
  source: {
    type: "GITHUB",
    location: "https://github.com/spara/aws-codebuild.git"
  },
  environment: {
    type: "LINUX_CONTAINER",
    computeType: "BUILD_GENERAL1_SMALL",
    image: "aws/codebuild/standard:3.0",
    environmentVariables: [
      {
        type: 'PARAMETER_STORE',
        name: 'PULUMI_ACCESS_TOKEN',
        value: pulumiAccessToken.name,
      },
    ],
  },
  artifacts: { type: "NO_ARTIFACTS" }
});

new aws.codebuild.Webhook('aws-codebuild-webhook', {
    projectName: buildProject.name,
    filterGroups: [
      {
        filters: [
            {
                "type": "EVENT", 
                "pattern": "PULL_REQUEST_CREATED, PULL_REQUEST_UPDATED, PULL_REQUEST_REOPENED"
            },
            {
                "type": "HEAD_REF", 
                "pattern": "^refs/heads/myBranch$"
            },
            {
                "type": "BASE_REF", 
                "pattern": "^refs/heads/master$"
            }
        ],
      },
    ],
  });

// const name = "helloworld";

// // Create an EKS cluster with non-default configuration
// const vpc = new awsx.ec2.Vpc("vpc", { numberOfAvailabilityZones: 2 });

// const cluster = new eks.Cluster(name, {
//     vpcId: vpc.id,
//     subnetIds: vpc.publicSubnetIds,
//     desiredCapacity: 2,
//     minSize: 1,
//     maxSize: 2,
//     storageClasses: "gp2",
//     deployDashboard: false,
// });

// // Export the clusters' kubeconfig.
// export const kubeconfig = cluster.kubeconfig;

// // Create a Kubernetes Namespace
// const ns = new k8s.core.v1.Namespace(name, {}, { provider: cluster.provider });

// // Export the Namespace name
// export const namespaceName = ns.metadata.name;

// // Create a NGINX Deployment
// const appLabels = { appClass: name };
// const deployment = new k8s.apps.v1.Deployment(name,
//     {
//         metadata: {
//             namespace: namespaceName,
//             labels: appLabels,
//         },
//         spec: {
//             replicas: 1,
//             selector: { matchLabels: appLabels },
//             template: {
//                 metadata: {
//                     labels: appLabels,
//                 },
//                 spec: {
//                     containers: [
//                         {
//                             name: name,
//                             image: "nginx:latest",
//                             ports: [{ name: "http", containerPort: 80 }],
//                         },
//                     ],
//                 },
//             },
//         },
//     },
//     {
//         provider: cluster.provider,
//     },
// );

// // Export the Deployment name
// export const deploymentName = deployment.metadata.name;

// // Create a LoadBalancer Service for the NGINX Deployment
// const service = new k8s.core.v1.Service(name,
//     {
//         metadata: {
//             labels: appLabels,
//             namespace: namespaceName,
//         },
//         spec: {
//             type: "LoadBalancer",
//             ports: [{ port: 80, targetPort: "http" }],
//             selector: appLabels,
//         },
//     },
//     {
//         provider: cluster.provider,
//     },
// );

// // Export the Service name and public LoadBalancer Endpoint
// export const serviceName = service.metadata.name;
// export const serviceHostname = service.status.loadBalancer.ingress[0].hostname;