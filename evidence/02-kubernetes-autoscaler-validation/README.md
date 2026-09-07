# HPA + Cluster Autoscaler / 운영 적용 전 기능 검증과 설치

**Evidence label:** PRODUCTION ROLLOUT · PRE-PRODUCTION VALIDATION

Cluster Autoscaler를 운영 환경에 바로 적용하지 않고, 사전에 주요 scheduling/scale 동작을 시나리오별로 검증한 뒤 실제 고객사 Kubernetes 환경에 설치했습니다.

## Validation flow

```text
HTTP load
  -> HPA replica 증가
  -> scheduling pressure / Pending Pod
  -> Cluster Autoscaler scale-out 판단
  -> 신규 Node Ready
  -> Pending Pod scheduling
  -> 부하 제거
  -> HPA scale-down
  -> CA node scale-down
```

## 검증한 조건

- HPA 기본 scale-out / scale-down
- Pending Pod를 통한 CA scale-out trigger
- HPA → CA 연계 흐름
- spike / load pattern
- PDB와 eviction 조건
- `safe-to-evict` / local storage scale-down blocker
- overprovisioning placeholder

## Production rollout

기능 검증 후 실제 운영 환경에 Cluster Autoscaler를 설치했고, 이후 발생한 예상치 못한 scale-out 사례도 CA log, Pod scheduling event, PVC 상태를 함께 분석해 RCA했습니다.

관련 RCA: `Cluster Autoscaler Unexpected Scale-out / 백업 작업 중 불필요한 노드 확장 RCA`

## Evidence boundary

이 디렉터리의 YAML과 runbook은 공개를 위해 sanitize한 검증 자료입니다. 실제 운영 환경 식별자와 내부 설정값은 포함하지 않습니다.
