# PV Attachment Failure Blocking Node Provisioning and Rolling Update

**Classification:** Production/platform incident - sanitized

## Symptoms

During an autoscaler validation, a new worker node could not complete provisioning. A similar failure could also block rolling replacement of nodes.

The node design mounted persistent storage into paths used by node/runtime components, so volume attachment was on the critical path for machine readiness.

## Investigation

The issue was reproduced in a sandbox environment and escalated with platform logs. The investigation focused on the relationship between:

```text
Machine provisioning
 -> CSI attach
 -> volume becomes usable
 -> node/runtime initialization
 -> node Ready
```

## Finding

The platform vendor identified a known vCenter 8.0.3-series issue in which attach operations could fail with an already-attached/resource-in-use condition even for the intended VM workflow.

A newer vCenter update contained the vendor fix; restarting the CSI controller was identified as the practical workaround on the affected version.

## Validation

- upgraded the sandbox vCenter to the fixed update line
- repeated autoscaling/provisioning tests
- gathered fresh logs when behavior remained uncertain
- later repeated stress tests multiple times without reproducing the original failure

## Engineering lesson

When storage is part of node bootstrap, a CSI/vCenter attach defect can present as an autoscaler or machine-provisioning failure. Troubleshooting needs to follow the provisioning dependency graph rather than stopping at the Cluster Autoscaler event.
