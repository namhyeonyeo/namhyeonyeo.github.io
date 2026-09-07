# Review Notes Before Publishing / Running

These notes intentionally distinguish the supplied source material from inferred corrections. The original YAML/runbooks were preserved in this pack instead of silently rewriting them.

## 1. `03_load_phase3_k6.yaml` is missing

`09_test_scenario_runbook.md` references this file, but it was not in the supplied bundle. Collect the original or remove that scenario before claiming the repository is fully runnable.

## 2. `kubectl apply --field-selector ...` should be rechecked

The runbook uses an example similar to:

```bash
kubectl apply -f 03_load_generator.yaml --field-selector metadata.name=load-light
```

This should be verified against the `kubectl` version you intend to document. A safer portfolio approach is to split individual Jobs into separate manifests or select them through Kustomize/templating rather than presenting an unverified CLI filter as executable procedure.

## 3. `01_metrics_server_check.yaml` is not obviously a complete standalone install

The supplied file contains the metrics-server Deployment but does not include the complete set of ServiceAccount/RBAC/Service/APIService resources normally required for a fresh installation. Treat it as an environment-specific check/example unless you add the original complete installation manifests.

## 4. Timings are expected/illustrative unless you captured them

Values such as "30-60 seconds" or "5-10 minutes" in the runbook should not be presented as measured results unless you retain an actual timestamped test result. Keep them under **Expected behavior** and add real evidence separately.
