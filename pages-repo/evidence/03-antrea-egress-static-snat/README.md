# Antrea Egress - Stable Outbound Source IP

**Evidence label:** SANITIZED PRODUCTION EXAMPLE

## Problem

When external systems allow traffic by source IP, directly exposing changing Kubernetes node IPs creates an operational dependency between node lifecycle and firewall policy.

The design uses Antrea `ExternalIPPool` + `Egress` to assign a stable outbound source IP to selected Pods.

## Selection model

- `nodeSelector` chooses nodes capable of hosting the Egress interface.
- `podSelector` chooses workloads to which the SNAT policy applies.
- the Egress object draws an address from the external pool.

## Validation

The supplied work plan validated the behavior from both sides:

1. send traffic from a labeled test Pod to a remote host
2. capture the packet on the remote host
3. confirm that the observed source address is the configured Egress IP, not a node IP

See `docs/validation.md`.

## Public sanitization

The original material contained an internal RFC1918 address. This public example uses the documentation range `192.0.2.0/24` instead.
