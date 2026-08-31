# Kubernetes Infrastructure GitOps Migration

**Evidence label:** SANITIZED PRODUCTION WORKFLOW

This project documents a migration from resources manually applied from bastion/jumpbox hosts to a GitLab + ArgoCD operating model.

## Scope observed in the supplied work history

- inventory manually deployed YAML and Helm components
- define repository and naming conventions
- move environment-specific configuration into Git branches / structured paths
- create ArgoCD Projects and Applications
- migrate infrastructure components incrementally by environment
- verify sync state and Kubernetes resources after migration
- identify and clean old resources after ownership moved to GitOps
- later consolidate multiple ArgoCD deployments into a shared ArgoCD
- restructure Helm values as Ingress architecture changed

## Why this is strong portfolio evidence

The engineering challenge is ownership migration, not installing ArgoCD. The risk is that the same Kubernetes object may temporarily have two management paths or that deleting an old release removes resources already adopted by GitOps.

A useful case study should therefore show:

```text
Inventory
 -> define desired Git structure
 -> import sanitized manifests
 -> create Application/AppProject
 -> sync and compare
 -> remove old ownership carefully
 -> validate service behavior
 -> clean jumpbox-only artifacts
```

## Security

The original operational logs contained internal domains and plaintext credentials. None of them are included here. The example script requires credentials through environment variables and uses example domains.
