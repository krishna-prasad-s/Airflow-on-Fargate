import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import cdk = require('@aws-cdk/core');
import {RDSConstruct} from "./constructs/rds";
import {AirflowConstruct} from "./constructs/airflow-construct";
import { DagTasks } from './constructs/dag-tasks';

class FarFlow extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC and Fargate Cluster
    // NOTE: Limit AZs to avoid reaching resource quotas
    //let vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });
    let vpc = ec2.Vpc.fromLookup(this, 'ImportVPC',{
                      vpcId: "vpc-000b16d0e5d305464",
                      vpcName: "daas-poc--daas-dev"
                    });
    cdk.Tags.of(scope).add("Stack", "FarFlow");

    let cluster = new ecs.Cluster(this, 'ECSCluster', { vpc: vpc });

    const asg = cluster.addCapacity('MyCapacity', {
      instanceType: new ec2.InstanceType('t3.xlarge'),
      minCapacity: 2,
      maxCapacity: 4,
    });
    
    asg.scaleOnCpuUtilization('MyCpuScaling', {
      targetUtilizationPercent: 50,
    });

    // Setting default SecurityGroup to use across all the resources
    let defaultVpcSecurityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {vpc: vpc});

    // Create RDS instance for Airflow backend
    const rds = new RDSConstruct(this, "RDS-Postgres", {
      defaultVpcSecurityGroup: defaultVpcSecurityGroup,
      vpc: vpc
    });

    // Create Airflow service: Webserver, Scheduler and minimal Worker
    new AirflowConstruct(this, "AirflowService", {
      cluster: cluster,
      vpc: vpc,
      dbConnection: rds.dbConnection,
      defaultVpcSecurityGroup: defaultVpcSecurityGroup,
      privateSubnets: vpc.privateSubnets
    });

    // Create TaskDefinitions for on-demand Fargate tasks, invoked from DAG
    new DagTasks(this, "DagTasks", {
      vpc: vpc,
      defaultVpcSecurityGroup: defaultVpcSecurityGroup
    });
  }
}

const app = new cdk.App();

new FarFlow(app, 'FarFlow', {
  env: {
    account: '330461522662',
    region: 'cn-northwest-1' 
  },
});

app.synth();
