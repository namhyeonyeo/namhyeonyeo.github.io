# Migration Playbook

## 1. Inventory existing resources

Export only the resources that will be migrated. Strip runtime metadata before committing.

Example:

```bash
kubectl get egress sample-egress -o yaml \
  | yq 'del(.metadata.uid,
            .metadata.resourceVersion,
            .metadata.creationTimestamp,
            .metadata.generation,
            .metadata.managedFields,
            .status)'
```

## 2. Use explicit naming conventions

Example public convention:

```text
egress_<scope>_<environment>_<cluster>.yaml
rbac_<scope>_<environment>_<cluster>.yaml
vap_<scope>_<environment>_<cluster>.yaml
```

The exact customer naming convention should not be published.

## 3. Work on a local branch

```bash
git fetch origin
git switch <target-branch>
git switch -c migration/<component>

git add .
git status
git commit -m "migrate <component> to GitOps"
git push -u origin migration/<component>
```

Use the normal code-review / merge-request process rather than modifying the shared branch directly.

## 4. ArgoCD application migration

Validate at minimum:

- repository path
- target revision
- destination cluster/namespace
- sync status
- resource health
- resources already owned by another ArgoCD Application
- pruning behavior before enabling automated prune

## 5. Ownership cutover

Do not delete the legacy release just because the same YAML is now present in Git. First determine which objects the old manager can delete or mutate.

Recommended evidence for the portfolio:

```text
Before: Manual YAML / Helm on jumpbox
After : Git -> review -> ArgoCD -> Kubernetes
```

## 6. Post-migration cleanup

- confirm applications are Synced / Healthy
- compare live resources to desired manifests
- remove stale local deployment files only after successful verification
- document rollback and ownership boundaries
