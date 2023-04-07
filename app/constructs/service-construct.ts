import {CfnOutput, Construct, Duration} from "@aws-cdk/core";
import {IVpc} from "@aws-cdk/aws-ec2";
import {Ec2TaskDefinition} from '@aws-cdk/aws-ecs';

import {PolicyConstruct} from "../policies";
import {workerAutoScalingConfig} from "../config";
import ecs = require('@aws-cdk/aws-ecs');
import ec2 = require("@aws-cdk/aws-ec2");
import elbv2 = require("@aws-cdk/aws-elasticloadbalancingv2");


export interface ServiceConstructProps {
  readonly vpc: IVpc;
  readonly cluster: ecs.ICluster;
  readonly defaultVpcSecurityGroup: ec2.ISecurityGroup;
  readonly taskDefinition: Ec2TaskDefinition;
  readonly isWorkerService?: boolean;
}

export class ServiceConstruct extends Construct {
  private readonly ec2Service: ecs.Ec2Service;
  public readonly loadBalancerDnsName?: CfnOutput;

  constructor(parent: Construct, name: string, props: ServiceConstructProps) {
    super(parent, name);

    // Attach required policies to Task Role
    let policies = new PolicyConstruct(this, "AIrflowTaskPolicies");
    if (policies.managedPolicies) {
      policies.managedPolicies.forEach(managedPolicy => props.taskDefinition.taskRole.addManagedPolicy(managedPolicy));
    }
    if (policies.policyStatements) {
      policies.policyStatements.forEach(policyStatement => props.taskDefinition.taskRole.addToPolicy(policyStatement));
    }

    this.ec2Service = new ecs.Ec2Service(this, name, {
      cluster: props.cluster,
      taskDefinition: props.taskDefinition,
      securityGroup: props.defaultVpcSecurityGroup,
      serviceName: "ArflowEC2Service"
    });
    const allowedEc2Ports = new ec2.Port({
      protocol: ec2.Protocol.TCP,
      fromPort: 0,
      toPort: 65535,
      stringRepresentation: "All"
    });
    this.ec2Service.connections.allowFromAnyIpv4(allowedEc2Ports);

    if (props.isWorkerService) {
      this.configureAutoScaling();
    }
    else {
      // Export Load Balancer DNS Name, which will be used to access Airflow UI
      this.loadBalancerDnsName = new CfnOutput(this, 'LoadBalanceDNSName', {
        value: this.attachLoadBalancer(props.vpc),
      });
    }
  }

  private attachLoadBalancer(vpc: IVpc): string {
    let loadBalancer = new elbv2.NetworkLoadBalancer(
      this,
      "NetworkLoadBalancer",
      {
        vpc: vpc,
        internetFacing: true,
        crossZoneEnabled: true
      }
    );

    const listener = loadBalancer.addListener("Listener", {
      port: 80
    });

    const targetGroup = listener.addTargets(
      "AirflowEC2TargetGroup",
      {
        healthCheck: {
          port: "traffic-port",
          protocol: elbv2.Protocol.HTTP,
          path: "/health"
        },
        port: 80,
        targets: [this.ec2Service]
      }
    );
    targetGroup.setAttribute("deregistration_delay.timeout_seconds", "60");

    return loadBalancer.loadBalancerDnsName;
  }

  private configureAutoScaling(): void {
    const scaling = this.ec2Service.autoScaleTaskCount({
      maxCapacity: workerAutoScalingConfig.maxTaskCount,
      minCapacity: workerAutoScalingConfig.minTaskCount
    });

    if (workerAutoScalingConfig.cpuUsagePercent) {
      scaling.scaleOnCpuUtilization("CpuScaling", {
        targetUtilizationPercent: workerAutoScalingConfig.cpuUsagePercent,
        scaleInCooldown: Duration.seconds(60),
        scaleOutCooldown: Duration.seconds(60)
      });
    }

    if (workerAutoScalingConfig.memUsagePercent) {
      scaling.scaleOnMemoryUtilization("MemoryScaling", {
        targetUtilizationPercent: workerAutoScalingConfig.memUsagePercent,
        scaleInCooldown: Duration.seconds(60),
        scaleOutCooldown: Duration.seconds(60)
      });
    }
  }
}
