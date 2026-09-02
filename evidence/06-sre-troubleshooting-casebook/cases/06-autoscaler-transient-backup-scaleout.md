# Cluster Autoscaler Unexpected Scale-out / 백업 작업 중 불필요한 노드 확장 RCA

**Artifact type:** SANITIZED PRODUCTION RCA

## 현상

정기 백업 시간대에 눈에 띄는 서비스 부하 증가가 없었는데 Worker Node가 추가됐고, 잠시 뒤 다시 scale-in 됐습니다.

## 조사 접근

단순히 CPU/Memory 부족이라고 가정하지 않고 아래 타임라인을 맞췄습니다.

```text
Backup schedule
     |
     +--> backup workload created
              |
              +--> PVC Unbound -> Bound
                        |
                        +--> Pod temporarily Unschedulable
                                  |
                                  +--> Cluster Autoscaler scale-out
```

확인 항목:

- Cluster Autoscaler log의 scale-up decision 시점
- Pending/Unschedulable Pod event
- PVC phase 변화와 binding 시점
- Node 생성/Ready 시점
- 백업 workload lifecycle

## RCA

CA 자체의 오동작이라기보다, 백업 workload 생성 직후 PVC/scheduling 조건이 잠깐 해결되지 않은 상태를 scheduler가 Unschedulable로 판단했고, Cluster Autoscaler가 그 신호에 정상 반응하면서 transient scale-out이 발생한 것으로 정리했습니다.

신규 Node가 준비될 시점에는 원래의 PVC/scheduling 조건이 이미 해소되어 추가 capacity가 오래 필요하지 않았고 이후 scale-down 됐습니다.

## 개선 검토

- 백업 workload의 StorageClass binding timing 확인
- `WaitForFirstConsumer` 방식 적용 가능성 검토
- 짧은 Pending 상태가 즉시 scale-out으로 이어지는 환경에서는 scale-up delay tuning 검토
- Autoscaler RCA에서 resource utilization뿐 아니라 Pending reason / PVC / affinity / PDB를 함께 확인

## 배운 점

`Node가 늘었다 = 자원이 부족했다`로 단정하면 RCA가 틀릴 수 있습니다. Cluster Autoscaler가 어떤 scheduler signal을 근거로 Node를 요청했는지 확인하는 것이 먼저였습니다.
