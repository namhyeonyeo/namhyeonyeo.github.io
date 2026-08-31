# Evidence to Collect Before Publishing This as a Full Implementation Repository

Please collect sanitized copies of:

- AKO values before / after
- AviInfraSetting
- IngressClass
- representative Ingress for default VIP network
- representative Ingress for alternate VIP network
- HostRule / HTTPRule if actually used
- LoadBalancer Service using `loadBalancerClass`
- ArgoCD Application/path for AKO or Ingress resources
- curl / DNS validation result
- `kubectl describe ingress` and selected AVI-side status output

Do not fabricate these files from memory. If the originals cannot be published, recreate the behavior in a lab and mark it `REPRODUCED EXAMPLE`.
