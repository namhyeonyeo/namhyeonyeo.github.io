# Evidence to Collect Next

The current pack is enough to begin publishing, but the following original artifacts would make the portfolio materially stronger.

## P0 - collect first

### AVI / AKO migration
- AKO `values.yaml` before/after
- AviInfraSetting YAML
- IngressClass YAML
- representative Ingress YAML for each VIP/network path
- HostRule / HTTPRule if used
- sanitized `kubectl get ingress,hostrule,aviinfrasetting -A` output
- before/after traffic validation commands

### Kubernetes operations toolkit
- latest cluster health-check shell script
- previous version if available (useful for a refactoring case study)
- sample stdout showing OK/WARN/FAIL summaries
- PV/PVC mapping script
- mounted-PV workload discovery script

### Observability
- HTTPProxy / Ingress exporter script
- CronJob YAML
- RBAC YAML
- Prometheus additional scrape config
- real PromQL used for Contour/Envoy/custom metrics
- sanitized metric output sample

### GitOps
- repository directory layout
- one sanitized ArgoCD Application
- one sanitized AppProject
- Kustomize base/overlay sample
- one Helm values migration example
- scripts used to inventory resources or generate GitOps objects

## P1 - next

### Node access automation
- `cluster-ssh` script
- bash completion script
- sanitized command examples

### Resource governance
- namespace/pod resource collection Python script
- collected output sample
- ResourceQuota and LimitRange YAML actually used

### RBAC
- bulk Role update script
- before/after Role YAML
- `kubectl auth can-i` validation output

### Storage
- CSI/CSM custom resource (credentials removed)
- StorageClass
- VolumeSnapshotClass
- PowerStore migration plan / rollback steps

### Upgrade / compatibility
- compatibility workbook
- version matrix
- pre/post upgrade validation checklist

## P2 - screenshots only if allowed

Screenshots can help but are weaker than code and config. If you use them:

- crop customer branding and names
- remove domains/IPs
- remove case IDs
- prefer terminal output recreated in a lab
- never upload screenshots of proprietary security reports
