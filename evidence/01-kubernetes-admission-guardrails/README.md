# Kubernetes Admission Guardrails

**Evidence label:** SANITIZED PRODUCTION-ORIENTED EXAMPLE

This project shows how Kubernetes admission controls were designed to enforce workload and namespace standards at API admission time rather than relying only on post-deployment checks.

## Problem

Platform standards needed to be enforced consistently across application namespaces and workloads. Some rules should block deployment, some should only warn, and one namespace label needed mutation rather than validation.

## Design

The supplied design separates the responsibilities:

- `ValidatingAdmissionPolicy` + CEL for deny/warn checks
- `ValidatingAdmissionPolicyBinding.validationActions` for enforcement mode
- Mutating admission webhook for an automatically injected Pod Security label
- label-based policy exclusions so exceptions remain visible and auditable

## Guardrail examples

- regular containers must define CPU/memory requests and limits
- initContainer resource omissions can be surfaced as warnings
- service-account-token mounting can be explicitly controlled
- namespace labels can be required or warned on
- selected namespaces can be excluded with a visible label instead of hard-coded policy edits

## Why this is useful portfolio evidence

This is not just a YAML example. It demonstrates:

1. understanding of Kubernetes API admission order
2. CEL expression design
3. difference between mutation and validation
4. rollout strategy (`Audit -> Warn -> Deny`)
5. exception governance

## Files

- `manifests/workload-guardrails.yaml` - sanitized VAP/VAPBinding implementation supplied in the working material
- `docs/policy-design.md` - public summary of the design document
- `docs/validation-actions.md` - Deny/Warn/Audit operational model
- `docs/exclusion-strategy.md` - exception-handling design

## Evidence gap

The design document refers to namespace-policy YAML and a mutating webhook implementation. Those source files were not part of the supplied code bundle, so they are intentionally not fabricated here.
