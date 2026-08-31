# Cluster Autoscaler, PVC Binding and Backup Workload Timing

**Classification:** Production incident + internal reproduction - sanitized

## Symptoms

During backup activity, an additional worker node could appear and then disappear again shortly afterward. The behavior looked like an unnecessary scale-out / scale-in cycle.

## Investigation path

The timeline was correlated across:

- Pod Pending / unschedulable state
- PVC state transition
- Cluster Autoscaler logs
- backup workload resource consumption
- worker-node creation and later scale-down

An internal VKS + NFS + backup lab was also used to reproduce related scheduler/autoscaler log behavior.

## Findings

The investigation surfaced two closely related contributors over time:

### 1. Very short PVC scheduling transition

A newly created PVC could move through an Unbound -> Bound transition within a very short interval. If the autoscaler evaluated the Pod in that scheduling window, the system could briefly reason about the Pod differently from the state visible moments later.

A scale-out decision could therefore become obsolete almost immediately after the storage state converged.

### 2. Real backup resource pressure

Later observations also showed backup jobs consuming enough resources to trigger a legitimate node add. After backup completion, the additional node remained underutilized and became a normal scale-down candidate.

## Mitigations tested / applied

- collected backup-namespace Pod resource usage with a scheduled script
- added explicit requests/limits to the heavy backup/export workload
- monitored Pod and PVC state together
- introduced `--new-pod-scale-up-delay` to avoid reacting too aggressively to newly created Pods while storage state was still converging
- tuned the delay after observation rather than assuming a value once

## Validation

After the autoscaler delay was introduced and monitored, the previously observed unnecessary scale activity stopped occurring in the monitored environments.

## Engineering lesson

Autoscaling incidents are not only CPU/memory problems. Scheduler state, PVC binding, workload resource requests and autoscaler loop timing can all change the decision in the same few seconds. The investigation became much clearer after those signals were collected on one timeline.
