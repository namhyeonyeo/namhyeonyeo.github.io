# CA + HPA 오토스케일링 극한 테스트 런북 (Runbook)

> 버전: v1.0 | 대상: 실무 Kubernetes 운영자  
> 전제: CA(Cluster Autoscaler)가 클러스터에 설치되어 있어야 함  
> 테스트 소요 시간: 약 2~4시간 (전 단계 수행 기준)

---

## 0. 사전 확인 체크리스트

```bash
# 1) CA 설치 확인
kubectl get deployment -n kube-system | grep -i autoscaler
kubectl get pods -n kube-system -l app=cluster-autoscaler

# 2) CA 설정 확인 (주요 파라미터)
kubectl describe deployment cluster-autoscaler -n kube-system | grep -A30 "Args:"
# 확인 항목: --max-nodes-total, --scale-down-enabled, --balance-similar-node-groups

# 3) metrics-server 확인
kubectl top nodes
kubectl get apiservice v1beta1.metrics.k8s.io

# 4) 현재 클러스터 노드 현황
kubectl get nodes -o wide
kubectl describe nodes | grep -E "Allocatable:|Requests:" -A5

# 5) CA 로그 선 확인 (이상 없는지)
kubectl logs -n kube-system \
  $(kubectl get pod -n kube-system -l app=cluster-autoscaler \
    -o jsonpath='{.items[0].metadata.name}') \
  --tail=30
```

---

## 1. 테스트 환경 구성

```bash
# 순서대로 적용
kubectl apply -f 00_namespace_and_quota.yaml
kubectl apply -f 01_metrics_server_check.yaml   # 이미 있으면 skip
kubectl apply -f 02_target_deployment_hpa.yaml
kubectl apply -f 05_overprovisioner.yaml        # 선택사항
kubectl apply -f 06_monitoring_rbac.yaml

# 환경 확인
kubectl get all -n autoscale-test
kubectl get hpa -n autoscale-test
```

---

## 2. 테스트 단계별 시나리오

### Phase 1: HPA 기능 확인 (기존 노드 내)

```bash
# 목표: CPU 50% 초과 시 HPA가 replica 증가하는지 확인
kubectl apply -f 03_load_generator.yaml  # load-light Job만 적용 권장

# 관찰 (별도 터미널)
watch -n 5 kubectl get hpa -n autoscale-test

# 예상 결과:
# NAME             REFERENCE               TARGETS      MINPODS   MAXPODS   REPLICAS
# php-apache-hpa   Deployment/php-apache   80%/50%      1         30        3
```

**성공 기준**: TARGETS의 현재 값이 50% 초과 → REPLICAS 자동 증가

---

### Phase 2: CA 트리거 확인 (노드 추가)

```bash
# 목표: Pending Pod 발생 → CA가 노드 추가하는지 확인
kubectl apply -f 04_ca_trigger_pod.yaml

# CA 로그 실시간 모니터링 (별도 터미널)
kubectl logs -n kube-system \
  $(kubectl get pod -n kube-system -l app=cluster-autoscaler \
    -o jsonpath='{.items[0].metadata.name}') \
  -f | grep -E "scale|Scale|node|Node|pending|Pending"

# Pending Pod 확인
kubectl get pods -n autoscale-test | grep Pending

# 노드 추가 확인
kubectl get nodes -w
```

**CA 동작 타임라인** (일반적):
| 시간 | 이벤트 |
|------|--------|
| T+0 | Pod Pending 상태 진입 |
| T+30~60s | CA가 Pending 인지 및 스케일아웃 결정 |
| T+2~5m | 클라우드 프로바이더에 노드 요청 (EKS: EC2 생성) |
| T+3~7m | 노드 Ready 상태 전환 |
| T+7~10m | Pod Scheduled → Running |

---

### Phase 3: 극한 부하 테스트

```bash
# 중부하 + 극한부하 동시 적용
kubectl apply -f 03_load_generator.yaml

# 전체 Pod/노드 현황 실시간 확인
watch -n 10 '
echo "=== $(date) ==="
echo "--- Nodes ---"
kubectl get nodes --no-headers | wc -l
echo "--- Pods (by status) ---"
kubectl get pods -n autoscale-test --no-headers | awk "{print \$3}" | sort | uniq -c
echo "--- HPA ---"
kubectl get hpa -n autoscale-test
echo "--- Top Nodes ---"
kubectl top nodes 2>/dev/null
'

# ResourceQuota 소진 여부 확인
kubectl describe resourcequota -n autoscale-test
```

---

### Phase 4: Spike 패턴 테스트

```bash
# load-spike Job 단독 적용
kubectl apply -f - <<EOF
$(grep -A60 'name: load-spike' 03_load_generator.yaml | head -60)
EOF

# CA scaleup → scaledown 반복 관찰
kubectl get events -n kube-system --sort-by='.lastTimestamp' -w | \
  grep -E "ScaleUp|ScaleDown|Triggered"
```

---

### Phase 5: 스케일다운 검증

```bash
# 부하 완전 제거
kubectl delete job --all -n autoscale-test

# HPA scaledown 관찰 (기본 5분 stabilizationWindow)
watch -n 15 kubectl get hpa,pods -n autoscale-test

# CA scaledown 대기 (기본 10분)
# → 노드가 줄어드는지 확인
watch -n 30 kubectl get nodes

# CA 스케일다운 로그
kubectl logs -n kube-system \
  $(kubectl get pod -n kube-system -l app=cluster-autoscaler \
    -o jsonpath='{.items[0].metadata.name}') \
  | grep -E "scaleDown|scale_down|unneeded|removing" | tail -30
```

---

## 3. 트러블슈팅 가이드

### 문제 1: CA가 Pending Pod을 무시하는 경우

**원인 후보**:
1. CA max-nodes-total 한계 도달
2. 노드 그룹(ASG/MIG) max size 도달
3. 리소스 요청값이 모든 노드 타입 초과 (over-provisioned request)
4. 스케줄링 제약 (nodeSelector, affinity) 해결 불가

**확인**:
```bash
# CA 상태 CM
kubectl get cm -n kube-system cluster-autoscaler-status -o yaml

# CA 로그에서 스케일 실패 이유
kubectl logs -n kube-system -l app=cluster-autoscaler | \
  grep -E "cannot|Cannot|failed|Failed|skip|Skip" | tail -20

# 이벤트
kubectl get events -n kube-system | grep -E "NotTriggerScaleUp|FailedToScale"
```

---

### 문제 2: CA 스케일다운이 안 되는 경우

**원인 후보**:
1. `safe-to-evict: false` annotation Pod 존재
2. PDB(PodDisruptionBudget) 위반
3. emptyDir, local storage 사용 Pod
4. `--scale-down-enabled=false` 설정
5. 최근 스케일업 후 cool-down 기간 (기본 10분)

**확인**:
```bash
# safe-to-evict false Pod
kubectl get pods -A -o json | jq -r \
  '.items[] | select(.metadata.annotations["cluster-autoscaler.kubernetes.io/safe-to-evict"]=="false") | "\(.metadata.namespace)/\(.metadata.name)"'

# PDB 상태
kubectl get pdb -A

# CA 스케일다운 블로커 로그
kubectl logs -n kube-system -l app=cluster-autoscaler | \
  grep -E "scale_down|blockScaleDown|pod is not safe" | tail -20
```

---

### 문제 3: HPA 메트릭 수집 안 되는 경우 (TARGETS: unknown)

**확인**:
```bash
# HPA 상태 상세
kubectl describe hpa php-apache-hpa -n autoscale-test
# Conditions 섹션 확인: AbleToScale, ScalingActive

# metrics-server 확인
kubectl top pods -n autoscale-test
kubectl get apiservice v1beta1.metrics.k8s.io

# metrics-server 로그
kubectl logs -n kube-system -l k8s-app=metrics-server --tail=30
```

---

## 4. 테스트 종료 및 정리

```bash
# 부하 생성기 중지
kubectl delete job --all -n autoscale-test

# 테스트 리소스 전체 삭제
kubectl delete -f 04_ca_trigger_pod.yaml
kubectl delete -f 02_target_deployment_hpa.yaml
kubectl delete -f 06_monitoring_rbac.yaml
kubectl delete -f 05_overprovisioner.yaml
kubectl delete -f 00_namespace_and_quota.yaml  # namespace 포함 전체 삭제

# 또는 네임스페이스 통째로 삭제
kubectl delete namespace autoscale-test

# CA가 노드 자동 제거할 때까지 대기
watch kubectl get nodes
```

---

## 5. 체크포인트 요약

| 검증 항목 | 확인 명령어 | 성공 기준 |
|-----------|-------------|-----------|
| HPA 메트릭 수집 | `kubectl get hpa -n autoscale-test` | TARGETS에 실제 % 값 표시 |
| HPA 스케일아웃 | `kubectl get pods -n autoscale-test` | 부하 시 replica 자동 증가 |
| CA 트리거 | `kubectl get nodes -w` | Pending 발생 후 노드 추가 |
| CA 스케일업 시간 | 이벤트 타임스탬프 비교 | 5~10분 이내 노드 Ready |
| CA 스케일다운 | `kubectl get nodes -w` | 부하 제거 후 10~15분 내 노드 감소 |
| PDB 준수 | Drain 이벤트 확인 | minAvailable 위반 없이 드레인 |
| 오버프로비저너 | placeholder Evict 후 즉시 실 Pod 배치 | Pending 없이 바로 Running |

---

## 6. 주요 CA 파라미터 참조

```yaml
# CA Deployment args 예시 (환경에 따라 조정)
args:
- --cloud-provider=aws             # aws, gcp, azure 등
- --namespace=kube-system
- --nodes=1:10:eks-nodegroup       # min:max:nodegroup-name
- --scale-down-enabled=true
- --scale-down-delay-after-add=10m
- --scale-down-unneeded-time=10m
- --scale-down-utilization-threshold=0.5
- --scale-down-non-empty-candidates-count=30
- --max-node-provision-time=15m
- --scan-interval=10s              # CA 스캔 주기 (기본 10s)
- --max-nodes-total=50             # 클러스터 전체 최대 노드
- --skip-nodes-with-local-storage=true   # emptyDir Pod 있는 노드 skip
- --skip-nodes-with-system-pods=true     # kube-system Pod 있는 노드 skip
- --balance-similar-node-groups=true     # 유사 노드 그룹 간 균등 분배
- --expander=least-waste           # 노드 선택 전략: least-waste, random, most-pods, price
```
