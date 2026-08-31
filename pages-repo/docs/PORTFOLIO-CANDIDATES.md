# Portfolio Candidates Derived from the Supplied WBS

The weekly WBS shows a much broader engineering scope than the older resume. The strongest portfolio story is not "I installed Kubernetes products" but:

> **Build -> Operate -> Troubleshoot -> Improve -> Automate**

The ranking below prioritizes technical depth, ownership evidence, SRE relevance, and the availability of code/configuration artifacts.

## Tier 1 - Strong public portfolio material

### 1. Kubernetes Admission Guardrails
**Classification:** Production platform governance / policy engineering  
**Portfolio strength:** Very High

Evidence already supplied:
- ValidatingAdmissionPolicy YAML
- Deny / Warn design
- Namespace exclusion strategy
- validationActions operating model
- test/design document

What it demonstrates:
- Kubernetes admission lifecycle understanding
- CEL-based policy design
- separation of mutation vs validation
- gradual policy rollout (`Audit -> Warn -> Deny`)
- exception governance rather than one-off bypasses

Recommended location: `kubernetes-platform-lab/admission-policy` or a dedicated `kubernetes-policy-engineering` repo.

---

### 2. Cluster Autoscaler + HPA Validation Lab
**Classification:** Lab / production-oriented validation  
**Portfolio strength:** Very High

Evidence already supplied:
- ResourceQuota / LimitRange
- HPA target applications
- load-generation jobs
- CA Pending triggers
- overprovisioner
- PDB / `safe-to-evict` scale-down cases
- RBAC / monitoring
- multi-stage test runbook

What it demonstrates:
- understanding the difference between HPA and Cluster Autoscaler
- scheduler Pending state as the bridge between workload scaling and node scaling
- scale-down blockers and disruption controls
- explicit success criteria rather than "installed and tested"

Important: label this **LAB / VALIDATION**, not production autoscaling implementation.

---

### 3. Kubernetes Egress IP / Static SNAT with Antrea
**Classification:** Production networking  
**Portfolio strength:** High

Evidence already supplied:
- `ExternalIPPool`
- `Egress`
- nodeSelector and podSelector model
- server-side `tcpdump` validation

What it demonstrates:
- outbound packet-path understanding
- source IP stabilization for firewall allow-listing
- configuration + packet-level validation

---

### 4. AVI / AKO Ingress Architecture Migration
**Classification:** Production architecture / migration  
**Portfolio strength:** Very High

WBS and architecture deck show work across:
- current-state analysis
- Contour/HTTPProxy to AVI/AKO Ingress transition
- AKO upgrade and GitOps conversion
- AviInfraSetting / IngressClass based VIP-network separation
- DNS cutover planning
- rollback / service-impact planning
- troubleshooting an AviInfraSetting naming constraint
- AVI API behavior after version changes

What it demonstrates:
- translating a customer network-separation requirement into a platform architecture
- control-plane and data-plane reasoning
- staged migration and rollback design
- cross-layer work across Kubernetes, load balancer, DNS, GitOps, and application manifests

Current gap: actual sanitized AKO `values.yaml`, AviInfraSetting, IngressClass, HostRule/Ingress examples should be collected before calling this repository "evidence complete".

---

### 5. GitOps Migration of Infrastructure Components
**Classification:** Production platform modernization  
**Portfolio strength:** Very High

WBS indicates a long-running transition from manually deployed YAML/Helm on jumpboxes to GitLab + ArgoCD, including infrastructure components and Helm-based packages.

Strong talking points:
- inventory of manually managed resources
- environment/branch conventions
- ArgoCD Application / AppProject structure
- migration verification and stale-resource cleanup
- later consolidation from multiple ArgoCD instances to a shared ArgoCD
- Helm chart restructuring for the new Ingress model

Security note: the raw logs supplied for this work contain credentials and internal URLs. Publish only sanitized derivatives.

---

### 6. SRE Troubleshooting Casebook
**Classification:** Production incidents / root-cause analysis  
**Portfolio strength:** Very High

The WBS contains several interview-quality cases. Five sanitized drafts are included in this package:

1. Guest-cluster API outage caused by DHCP overlap -> etcd certificate SAN mismatch
2. Transient Cluster Autoscaler scale-out around PVC binding / backup workload
3. containerd startup before the node data filesystem was mounted
4. PV attachment problem blocking machine provisioning / rolling updates
5. Supervisor certificate-renewal incident and recovery

These cases show much more SRE depth than a list of installed products.

---

## Tier 2 - High value, collect the original code/config next

### Kubernetes operations health-check script refactor
WBS shows an existing script being redesigned to:
- move HTTPProxy checks to Ingress + AVI CR checks
- correlate Released PVs with old PVC information
- improve Ingress health accuracy by following actual paths / probe paths

**Collect:** current shell script, previous version, example output before/after.

### `cluster-ssh` CLI
WBS records a private-key-based node access workflow, environment-variable setup, CLI wrapper, and bash completion.

**Collect:** script, completion file, sanitized usage output.

### Resource monitoring / quota automation
WBS records:
- Python script based on `kubectl top`
- daily collection of namespace / pod usage
- ResourceQuota / LimitRange rollout

**Collect:** Python script, CSV/output sample, quota calculation logic.

### RBAC bulk automation
WBS records roughly 100 Role changes across multiple zones.

**Collect:** automation script/template and a sanitized before/after Role example.

### PV actual-usage monitoring
WBS records CSI volume-usage metric collection and Splunk integration.

**Collect:** Splunk config fragment, metric names, PromQL/SPL, sanitized dashboard screenshot if permitted.

### VKS / Kubernetes compatibility matrix
WBS records compatibility analysis across vCenter, Supervisor/VKS, Kubernetes releases, CSI and ecosystem components.

**Collect:** the compatibility workbook you created, then produce a generic public matrix without customer environment details.

### Storage migration: PowerStore generation migration
WBS records planning for new array integration, StorageClass changes, API/NFS connectivity and PV migration.

**Collect:** sanitized StorageClass, CSI secret schema with values removed, migration runbook, rollback plan.

---

## Tier 3 - Good supporting material

- TKG/Tanzu and Kubernetes version upgrades with dependency/compatibility management
- Dell CSI Operator -> CSM Operator migration
- TLS certificate extraction / TLS termination workflow
- Kasten backup/restore based workload migration
- offline troubleshooting container image for restricted networks
- Docker / Kubernetes security vulnerability remediation and scan-script adaptation
- LoadBalancer IP inventory via AVI API
- Prometheus package deployment and Splunk integration
- cluster recovery / sandbox rebuild comparison workflow

These are useful, but should support the stronger Tier 1 narrative instead of each becoming a separate repository.

## Suggested homepage highlights

Use only 4-5 cards initially:

1. Multi-Network Ingress Architecture Migration
2. Kubernetes Admission Guardrails
3. GitOps Platform Migration
4. SRE Troubleshooting Casebook
5. Kubernetes Operations Automation

Then keep Autoscaling and Egress under Labs / Engineering Notes with direct GitHub evidence links.
