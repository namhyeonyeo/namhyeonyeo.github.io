# CA / HPA 오토스케일링 테스트 시나리오 런북

> 대상 파일: 03 ~ 07번 YAML  
> 목적: HPA 반응 → CA 스케일업 → 극한 부하 → 스케일다운 전 구간 검증  
> 소요 시간: 약 2~3시간 (전 단계 순차 진행 기준)

---

## 워크로드 구성 요약

| 파일 | 워크로드 | 역할 |
|------|----------|------|
| 03 | Job: load-light | busybox wget 루프, 2개 병렬, 5분 지속 |
| 03 | Job: load-heavy | wrk, 5개 병렬, 스레드4/커넥션100, 10분 지속 |
| 03 | Job: load-extreme (→ k6로 교체) | wrk 10개 병렬 또는 k6 단계적 ramping |
| 03 | Job: load-spike | busybox, 고부하 90초 + 휴지 120초 × 5회 반복 |
| 04 | Deployment: ca-trigger-cpu | pause 컨테이너 10 replica, 노드 슬롯 강제 점유 |
| 04 | Deployment: ca-trigger-nodegroup | nodeSelector로 특정 노드그룹 지정, Pending 유도 |
| 04 | Pod: ca-oversize-pod | 단일 대용량 Pod, 즉시 Pending → CA 즉시 트리거 |
| 04 | PodDisruptionBudget: php-apache-pdb | 스케일다운 시 minAvailable 50% 보장 |
| 05 | Deployment: cluster-overprovisioner | 낮은 우선순위 placeholder, 여유 슬롯 선점유 |
| 05 | PriorityClass: overprovisioning-priority | value: -1, 실제 Pod에게 자리 양보 |
| 07 | Pod: ca-block-pod | safe-to-evict: false, CA 스케일다운 차단 검증 |
| 07 | Pod: ca-evictable-pod | safe-to-evict: true, CA 정상 드레인 검증 |
| 07 | Pod: ca-localdata-pod | emptyDir 사용, CA 스케일다운 기본 차단 검증 |

---

## 시나리오 1: HPA 기본 반응 확인

**목적**: 부하 증가 시 HPA가 replica를 자동으로 늘리는지 확인  
**사용 파일**: `03_load_generator.yaml` (load-light Job)  
**예상 소요**: 10~15분

```bash
# 부하 생성 (light만 단독 적용)
kubectl apply -f 03_load_generator.yaml --field-selector metadata.name=load-light

# 또는 전체 적용 후 light만 실행
kubectl apply -f 03_load_generator.yaml
kubectl delete job load-heavy load-extreme load-spike -n autoscale-test
```

**관찰**
```bash
watch -n 5 kubectl get hpa -n autoscale-test
```

**성공 기준**
- TARGETS 현재값이 50% 초과
- REPLICAS가 1에서 자동 증가
- 증가 후 Pod이 모두 Running 상태

---

## 시나리오 2: CA 스케일업 검증 (직접 Pending 유도)

**목적**: Pending Pod 발생 시 CA가 노드를 추가하는지 확인  
**사용 파일**: `04_ca_trigger_pod.yaml` (ca-trigger-cpu, ca-oversize-pod)  
**예상 소요**: 10~20분 (클라우드 노드 프로비저닝 시간 포함)

```bash
# 현재 노드 수 기록
kubectl get nodes --no-headers | wc -l

# CA 트리거 Pod 배포
kubectl apply -f 04_ca_trigger_pod.yaml

# Pending 발생 확인
kubectl get pods -n autoscale-test | grep Pending
```

**CA 로그 실시간 관찰 (별도 터미널)**
```bash
kubectl logs -n kube-system \
  $(kubectl get pod -n kube-system -l app=cluster-autoscaler \
    -o jsonpath='{.items[0].metadata.name}') \
  -f | grep -E "scale|Scale|pending|Pending|node|Node"
```

**노드 추가 확인**
```bash
kubectl get nodes -w
kubectl get events -n kube-system | grep -E "TriggeredScaleUp|ScaledUpGroup"
```

**성공 기준**
- Pending Pod 발생 후 30~60초 내 CA 로그에 스케일업 결정 메시지 출력
- 5~10분 내 새 노드가 Ready 상태 전환
- Pending Pod이 새 노드에 Running으로 전환

**CA 동작 타임라인**
| 경과 시간 | 이벤트 |
|-----------|--------|
| T+0 | Pod Pending |
| T+30~60s | CA 스케일업 결정 |
| T+2~5m | 클라우드 노드 생성 요청 |
| T+5~10m | 노드 Ready |
| T+7~12m | Pod Running |

---

## 시나리오 3: 중부하 → CA 연계 스케일업

**목적**: HPA replica 증가 → 노드 부족 → CA 자동 노드 추가 연계 흐름 검증  
**사용 파일**: `03_load_generator.yaml` (load-heavy Job)  
**예상 소요**: 20~30분

```bash
# 기존 CA 트리거 Pod 정리 후 진행 권장
kubectl delete -f 04_ca_trigger_pod.yaml

# 중부하 적용
kubectl apply -f 03_load_generator.yaml
kubectl delete job load-light load-extreme load-spike -n autoscale-test 2>/dev/null
```

**동시 관찰 (터미널 3개 권장)**
```bash
# 터미널 1: HPA
watch -n 5 kubectl get hpa -n autoscale-test

# 터미널 2: Pod 수
watch -n 5 kubectl get pods -n autoscale-test --no-headers | wc -l

# 터미널 3: 노드
watch -n 10 kubectl get nodes
```

**성공 기준**
- HPA가 replica 증가 → 기존 노드 포화 → Pending 발생 → CA 노드 추가 순서 확인

---

## 시나리오 4: 극한 부하 (k6 Ramping)

**목적**: 단계적 부하 증가로 HPA/CA 각 구간별 반응 임계점 확인  
**사용 파일**: `03_load_phase3_k6.yaml`  
**예상 소요**: 12분 (stages 합계) + 노드 프로비저닝 시간

```bash
kubectl apply -f 03_load_phase3_k6.yaml
```

**k6 stages 구간별 관찰 포인트**

| 구간 | VU 수 | 관찰 포인트 |
|------|-------|-------------|
| 0~2분 | 0→50 | HPA 반응 시작 시점 |
| 2~5분 | 50→100 | HPA replica 증가, 기존 노드 내 처리 여부 |
| 5~8분 | 100→200 | Pending 발생 시점, CA 트리거 시점 |
| 8~10분 | 200 유지 | CA 노드 추가 완료, Pod 안정화 |
| 10~12분 | 200→0 | HPA scaledown 시작 시점 |

**k6 로그 확인**
```bash
kubectl logs -n autoscale-test -l phase=extreme -f
```

---

## 시나리오 5: Spike 패턴 (현실 트래픽 재현)

**목적**: 급증/급감 반복 패턴에서 HPA/CA 안정성 검증  
**사용 파일**: `03_load_generator.yaml` (load-spike Job)  
**예상 소요**: 약 35분 (90초 × 5 + 120초 × 5)

```bash
kubectl apply -f 03_load_generator.yaml
kubectl delete job load-light load-heavy load-extreme -n autoscale-test 2>/dev/null
```

**Spike 사이클 구조**
```
부하(90초) → 휴지(120초) → 부하(90초) → 휴지(120초) × 5회 반복
```

**관찰 포인트**
- 휴지기 120초 동안 HPA가 scaledown을 시도하는지
- HPA scaledown stabilizationWindow(300초) 때문에 실제로는 scaledown 안 되는지 확인
- CA는 HPA scaledown이 먼저 완료되어야 노드 제거 시도

```bash
# Spike 로그 실시간 확인
kubectl logs -n autoscale-test -l phase=spike -f
```

---

## 시나리오 6: 오버프로비저너 효과 검증

**목적**: placeholder Pod이 실제 Pod 배치 지연을 줄이는지 확인  
**사용 파일**: `05_overprovisioner.yaml`  
**예상 소요**: 15~20분

```bash
# Step 1: 오버프로비저너 배포
kubectl apply -f 05_overprovisioner.yaml

# Step 2: placeholder가 노드에 배치되었는지 확인
kubectl get pods -n kube-system -l app=cluster-overprovisioner -o wide

# Step 3: 대규모 Deployment 즉시 배포 → 배치 시간 측정
time kubectl apply -f 02_target_deployment_hpa.yaml
time kubectl rollout status deployment/php-apache -n autoscale-test
```

**비교 기준**
- 오버프로비저너 없을 때: 새 Pod → Pending → CA 노드 추가 → Running (5~10분)
- 오버프로비저너 있을 때: placeholder Evict → 즉시 Running (30초 이내)

```bash
# placeholder Eviction 후 Pending 전환 확인 (CA 재트리거)
kubectl get pods -n kube-system -l app=cluster-overprovisioner -w
```

---

## 시나리오 7: CA 스케일다운 검증

**목적**: 부하 제거 후 CA가 불필요 노드를 정상 제거하는지, 방해 요소는 무엇인지 확인  
**사용 파일**: `07_scaledown_test.yaml`  
**예상 소요**: 20~30분 (CA 기본 대기 시간 10분 포함)

```bash
# Step 1: 모든 부하 제거
kubectl delete job --all -n autoscale-test

# Step 2: 스케일다운 테스트 Pod 배포
kubectl apply -f 07_scaledown_test.yaml

# Step 3: HPA scaledown 관찰 (stabilizationWindow 5분)
watch -n 10 kubectl get hpa,pods -n autoscale-test

# Step 4: CA 스케일다운 대기 및 관찰 (기본 10분)
watch -n 30 kubectl get nodes
```

**스케일다운 블로커 검증**
```bash
# ca-block-pod(safe-to-evict: false)가 있는 노드는 CA가 제거 못 함
kubectl get pods -n autoscale-test -o wide | grep ca-block

# emptyDir Pod이 있는 노드도 기본적으로 제거 안 됨
kubectl get pods -n autoscale-test -o wide | grep ca-localdata

# CA 스케일다운 로그
kubectl logs -n kube-system \
  $(kubectl get pod -n kube-system -l app=cluster-autoscaler \
    -o jsonpath='{.items[0].metadata.name}') \
  | grep -E "scaleDown|unneeded|removing|blockScaleDown" | tail -30
```

**성공 기준**
- ca-evictable-pod이 있는 노드: 정상 드레인 후 노드 제거
- ca-block-pod이 있는 노드: 제거되지 않음 (CA 로그에 block 메시지)
- ca-localdata-pod이 있는 노드: 제거되지 않음 (local storage 감지)

---

## 전체 진행 순서 요약

```
[시나리오 1] load-light          → HPA 기본 반응 확인          (15분)
      ↓
[시나리오 2] ca-trigger-pod      → CA 직접 트리거 확인          (20분)
      ↓
[시나리오 3] load-heavy          → HPA→CA 연계 흐름 확인        (30분)
      ↓
[시나리오 4] k6 ramping          → 단계별 임계점 확인           (15분)
      ↓
[시나리오 5] load-spike          → Spike 패턴 안정성 확인       (35분)
      ↓
[시나리오 6] overprovisioner     → 배치 지연 개선 효과 확인     (20분)
      ↓
[시나리오 7] scaledown test      → 노드 제거 및 블로커 확인     (30분)
```

---

## 테스트 종료 및 정리

```bash
# 부하 전체 중지
kubectl delete job --all -n autoscale-test

# 테스트 리소스 전체 제거
kubectl delete -f 07_scaledown_test.yaml
kubectl delete -f 05_overprovisioner.yaml
kubectl delete -f 04_ca_trigger_pod.yaml
kubectl delete -f 03_load_phase3_k6.yaml
kubectl delete -f 02_target_deployment_hpa.yaml
kubectl delete -f 06_monitoring_rbac.yaml
kubectl delete -f 00_namespace_and_quota.yaml

# CA가 빈 노드 자동 제거할 때까지 대기
watch kubectl get nodes
```
