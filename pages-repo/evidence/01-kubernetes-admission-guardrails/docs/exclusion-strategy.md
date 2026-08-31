# VAP Exclusion Strategy

**Artifact type:** SANITIZED DESIGN GUIDE

A platform policy eventually needs exceptions: platform-managed namespaces, migration windows, external solutions, or pilot exclusions. The key requirement is that an exception should be **visible and reviewable**, not hidden in a long CEL expression.

## Compared approaches

| Approach | Namespace policy | Workload policy | Operational cost | Recommendation |
|---|---:|---:|---|---|
| Hard-code namespace names in `matchConditions` | Yes | Yes | policy edit for every exception | short-lived testing only |
| Binding `namespaceSelector` | No for Namespace objects | Yes | label-only | workload-only cases |
| `matchConditions` + namespace exclusion label | Yes | Yes | label-only | preferred general pattern |

## Preferred public pattern

Example exclusion labels:

```text
policy.platform/exclude=true
policy.platform/exclude-reason=migration
```

### Namespace policy

```yaml
matchConditions:
- name: not-excluded
  expression: >
    !has(object.metadata.labels) ||
    !('policy.platform/exclude' in object.metadata.labels)
```

### Workload policy

```yaml
matchConditions:
- name: not-excluded
  expression: >
    namespaceObject == null ||
    !has(namespaceObject.metadata.labels) ||
    !('policy.platform/exclude' in namespaceObject.metadata.labels)
```

`namespaceObject` allows a namespaced workload policy to inspect labels on the owning Namespace. A Binding `namespaceSelector` is useful for namespaced resources, but it cannot by itself exclude a Namespace object from a policy targeting Namespace CREATE/UPDATE because Namespace is cluster-scoped.

## Operations

```bash
kubectl label ns sample-app-ns policy.platform/exclude=true
kubectl label ns sample-app-ns policy.platform/exclude-reason=migration
kubectl get ns -l policy.platform/exclude=true --show-labels

# remove exception
kubectl label ns sample-app-ns policy.platform/exclude-
kubectl label ns sample-app-ns policy.platform/exclude-reason-
```

Recommended practice: review exclusions periodically and remove temporary exceptions after the original reason no longer applies.
