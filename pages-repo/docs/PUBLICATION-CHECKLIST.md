# GitHub Publication Checklist

Run this checklist before every public push.

## Never publish

- Customer/company-specific internal hostnames or domains
- Internal IP addresses or CIDRs unless converted to documentation ranges
- Usernames, passwords, API tokens, kubeconfig tokens, cookies, Authorization headers
- TLS private keys, SSH private keys, registry credentials
- Case/SR numbers tied to a customer incident
- Exact internal cluster, namespace, vCenter, ESXi, storage-array, or AVI names
- Proprietary security guidelines or customer vulnerability reports
- Raw WBS / weekly reports

## Sanitize metadata

For Kubernetes YAML exported with `kubectl get -o yaml`, normally remove:

```text
metadata.creationTimestamp
metadata.resourceVersion
metadata.uid
metadata.generation
metadata.managedFields
metadata.annotations.kubectl.kubernetes.io/last-applied-configuration
status
```

Do not remove fields that are part of the engineering point you want to demonstrate.

## Public test values

Prefer documentation values:

- Domain: `example.com`
- IPv4: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
- Cluster: `prod-cluster-01`, `staging-cluster-01`
- Namespace: `sample-app-ns`
- Registry: `registry.example.com`

## Evidence labels

Use one of these labels in each README:

- `SANITIZED PRODUCTION EXAMPLE`
- `LAB / SELF STUDY`
- `REPRODUCED EXAMPLE`
- `DESIGN ARTIFACT`

This prevents a recruiter from confusing a lab reproduction with production implementation.
