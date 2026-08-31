# Migration Checklist

This is a sanitized summary of the staged transition plan from the supplied design material.

## Preparation

- inventory existing LoadBalancer and HTTPProxy/Ingress services
- capture current VIP/DNS mappings
- back up AKO Helm values
- define IngressClass and network-selection policy
- prepare new Ingress manifests before cutover
- define rollback point for every step

## Controller / AKO work

- upgrade load-balancer controller / service engines as required
- upgrade AKO in a sequence that minimizes impact
- verify Helm release and Pod health after each step
- change AKO controller connection only after a rollback copy of values is retained
- verify Virtual Service synchronization

## L4 / L7 transition

- recreate L4 Services with the intended `loadBalancerClass`
- use AviInfraSetting for services that require a non-default VIP network
- deploy native Ingress resources that replace HTTPProxy behavior
- verify FQDN, TLS, path routing, backend service and health behavior

## DNS cutover

1. deploy and validate the new Ingress/VIP
2. lower TTL in advance when permitted
3. change DNS A record
4. validate both direct VIP and FQDN access
5. retain legacy path until the rollback window closes

## Cleanup

Only after successful service validation:

- remove old HTTPProxy resources
- remove legacy Contour/Envoy deployment if no longer used
- remove secondary/obsolete AKO instance
- remove obsolete service-controller components
- confirm no remaining applications depend on the old path
