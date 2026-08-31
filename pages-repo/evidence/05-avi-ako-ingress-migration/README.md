# AVI / AKO Ingress Architecture Migration

**Evidence label:** SANITIZED DESIGN ARTIFACT

## Context

A multi-environment Kubernetes platform was operating Contour/HTTPProxy-based ingress with AVI load balancing. A later project moved ingress control toward AKO / native Ingress and AVI CRDs while also consolidating load-balancer control and preserving multiple VIP networks.

The supplied architecture material covers current-state analysis, staged migration, service-impact handling, DNS cutover, rollback, and removal of legacy components.

## Ownership wording recommended for the portfolio

> A customer-driven network-separation and platform-standardization requirement was translated into a Kubernetes ingress migration design. I analyzed the existing Contour/AKO/AVI dependencies, implemented and validated the transition steps, and supported environment-by-environment cutover and troubleshooting.

Use stronger wording such as "I proposed the architecture" only if you can personally defend that level of ownership in an interview.

## Engineering themes

- multiple VIP/network domains in one Kubernetes environment
- Contour / HTTPProxy to Ingress + AVI CR transition
- AviInfraSetting / IngressClass driven network selection
- Helm and GitOps changes around AKO
- DNS cutover and rollback
- naming constraints surfaced by the load-balancer API
- API behavior changes after controller upgrades

## Architecture diagrams

See `architecture/control-data-plane.md`.

## Evidence still needed

See `EVIDENCE-TO-COLLECT.md`. The uploaded material included an internal architecture deck but not the original AKO values / AviInfraSetting / Ingress YAML. Those files are intentionally not fabricated.
