# HTTPProxy FQDN Exporter — 재현 예제

**Evidence label:** REPRODUCED EXAMPLE · 원본 운영 스크립트 미공개

Contour와 Envoy가 내보내는 기본 지표로는 "지금 이 FQDN을 어떤 HTTPProxy가 받고 있는가"를 바로 못 봅니다. 도메인 단위로 문제를 추적할 때마다 `kubectl get httpproxy -A`를 다시 치고 있어서, 이 정보를 Prometheus에서 조회할 수 있게 만들었습니다.

아래는 운영에 넣었던 구조를 공개용으로 다시 쓴 예제입니다. 원본 스크립트는 내부 endpoint가 섞여 있어 올리지 않았고, 여기서는 같은 흐름만 재현했습니다.

## 흐름

```text
HTTPProxy CR  →  CronJob (kubectl + jq)  →  Pushgateway  →  Prometheus  →  PromQL
```

수집 주체를 exporter Pod로 상주시키지 않고 CronJob으로 둔 이유는, 이 데이터가 초 단위로 바뀌는 값이 아니고 패키지로 관리되는 Prometheus 구성을 건드리지 않는 쪽이 안전했기 때문입니다.

## 수집

```bash
#!/usr/bin/env bash
set -euo pipefail

PUSHGATEWAY="${PUSHGATEWAY:-http://pushgateway.monitoring.svc:9091}"
JOB="httpproxy-exporter"

kubectl get httpproxy -A -o json \
| jq -r '
    .items[]
    | select(.spec.virtualhost.fqdn != null)
    | [
        .metadata.namespace,
        .metadata.name,
        .spec.virtualhost.fqdn,
        (.status.currentStatus // "unknown")
      ]
    | @tsv
  ' \
| while IFS=$'\t' read -r ns name fqdn status; do
    printf 'contour_httpproxy_info{namespace="%s",httpproxy="%s",fqdn="%s",status="%s"} 1\n' \
      "$ns" "$name" "$fqdn" "$status"
  done \
| curl -s --data-binary @- "${PUSHGATEWAY}/metrics/job/${JOB}"
```

metric 값 자체는 `1`이고, 의미는 label에 있습니다. `contour_httpproxy_info`는 "이 Namespace의 이 HTTPProxy가 이 FQDN을 이 상태로 들고 있다"는 사실 하나를 담습니다.

## RBAC

CronJob은 HTTPProxy를 읽기만 하면 되므로 권한을 거기까지만 줍니다.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: httpproxy-exporter-read
rules:
  - apiGroups: ["projectcontour.io"]
    resources: ["httpproxies"]
    verbs: ["get", "list"]
```

ServiceAccount와 ClusterRoleBinding을 붙여 CronJob에 연결합니다.

## CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: httpproxy-exporter
  namespace: monitoring
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: httpproxy-exporter
          restartPolicy: OnFailure
          containers:
            - name: exporter
              image: <kubectl-jq-curl-image>
              command: ["/bin/bash", "/scripts/export-httpproxy.sh"]
              env:
                - name: PUSHGATEWAY
                  value: http://pushgateway.monitoring.svc:9091
```

## 조회

```promql
contour_httpproxy_info{fqdn="app.example.com"}

count by (namespace) (contour_httpproxy_info)

contour_httpproxy_info{status!="valid"}
```

마지막 쿼리가 실제로 쓰던 형태입니다. 상태가 `valid`가 아닌 HTTPProxy를 도메인과 함께 바로 볼 수 있습니다.

## 검증할 때 본 것

- Prometheus Targets에서 Pushgateway scrape 상태
- `contour_httpproxy_info` label에 FQDN / Namespace / HTTPProxy 이름이 들어오는지
- HTTPProxy를 지웠을 때 Pushgateway에 남는 stale metric 처리

## 공개본 주의

- FQDN은 `example.com`으로 대체했습니다.
- 실제 Pushgateway 주소, 이미지 레지스트리 경로, Namespace 이름은 placeholder입니다.
