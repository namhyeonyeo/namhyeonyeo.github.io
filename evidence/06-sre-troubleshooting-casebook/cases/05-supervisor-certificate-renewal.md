# Supervisor Certificate-Renewal Incident and Control-Plane Recovery

**Classification:** Production incident - sanitized  
**Caution:** Recovery actions were environment-specific; this document is a case study, not a universal runbook.

## Symptoms

A supervisor/control-plane certificate renewal problem coincided with control-plane instability and failures in a managed guest cluster. One recreated guest control-plane VM did not register correctly and expected Kubernetes admin configuration was missing.

## Investigation / recovery sequence

The operational recovery crossed several layers:

1. confirm the supervisor certificate-renewal errors
2. perform the supported certificate renewal procedure
3. inspect Kubernetes core component health on supervisor control-plane VMs
4. restart affected control-plane containers where required
5. investigate a supervisor VM whose kubelet did not return healthy
6. verify etcd endpoint health and control-plane component state
7. replace a guest control-plane VM that still failed registration and allow the platform to recreate it

## Validation

- kube-apiserver / scheduler / controller-manager / etcd returned healthy on the recovered supervisor
- etcd endpoint health was normal
- the guest control-plane replacement registered successfully
- cluster node state normalized

## Important conclusion from escalation

The vendor investigation separated the supervisor certificate-renewal known issue from the guest-cluster symptom chain rather than assuming that every downstream event shared one root cause.

## Engineering lesson

Large incidents often contain more than one fault. A useful RCA must distinguish correlation from causation and validate each dependency independently.
