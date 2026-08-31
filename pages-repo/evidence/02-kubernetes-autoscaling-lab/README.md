# Kubernetes HPA + Cluster Autoscaler Validation Lab

**Evidence label:** LAB / PRODUCTION-ORIENTED VALIDATION

This repository section validates the full chain from application load to Pod scaling, Pending scheduling pressure, node scale-out, and eventual scale-down.

## What is tested

```text
HTTP load
  -> HPA raises replicas
  -> existing nodes become insufficient
  -> Pod becomes Pending / unschedulable
  -> Cluster Autoscaler evaluates the Pod
  -> node is provisioned
  -> Pod schedules and runs
  -> load is removed
  -> HPA scales down
  -> CA evaluates removable nodes and blockers
```

## Included scenarios

- Namespace isolation with ResourceQuota / LimitRange
- CPU and memory based HPA
- light / heavy / spike load generators
- explicit Pending Pod triggers
- node-group scheduling constraints
- PodDisruptionBudget
- overprovisioning placeholders with negative PriorityClass
- `safe-to-evict` scale-down blocker
- local-storage scale-down blocker
- monitoring RBAC and runbooks

## Why this is portfolio-worthy

The important part is not "I enabled HPA." The manifests encode the edge conditions that make autoscaling difficult to operate: resource requests, scheduling constraints, PDBs, local storage, Pending reasons, stabilization windows, and CA scale-down rules.

## Runbooks

- `docs/08_test_runbook.md` - broad validation / troubleshooting flow
- `docs/09_test_scenario_runbook.md` - seven sequential scenarios with success criteria

## Evidence gap

The supplied `09_test_scenario_runbook.md` references `03_load_phase3_k6.yaml`, but that file was not present in the uploaded bundle. Do not claim the k6 manifest is included until the original file is collected.
