# Operations Toolkit

**Evidence label:** SANITIZED OPERATIONAL TOOLING

운영하면서 같은 확인을 반복하게 될 때마다 만든 스크립트를 모았습니다. 공개본은 내부 경로, 클러스터 이름, IP를 지운 것이고 판정 로직과 명령 구조는 실제로 쓰던 것과 같습니다.

## 여기 있는 것

| 도구 | 무엇을 하는가 | 공개 범위 |
|---|---|---|
| `cluster-ssh` v3 | 클러스터·노드 조회, 노드 SSH, 노드 상태 수집, Egress datapath 판정 | 사용법과 판정 기준 문서 |
| `pv-rollback-backup.sh` | 스토리지 전환 전에 PVC/PV 매핑과 롤백용 YAML을 만들어 둠 | 스크립트 전문 |
| DHCP / IP 충돌 점검 | lease 상태와 ARP 응답, Kubernetes Node IP를 교차 확인 | 명령 절차 |
| HTTPProxy FQDN Exporter | HTTPProxy CR을 Prometheus metric으로 변환 | 재현 예제 |

## 공개 기준

- 실제 IP는 RFC 5737 문서용 대역(`192.0.2.0/24`, `198.51.100.0/24`)으로 바꿨습니다.
- 내부 kubeconfig / private key 경로는 placeholder로 바꿨습니다.
- 고객사 클러스터 이름, 스토리지 어레이 모델, 계정 정보는 넣지 않았습니다.
- 원본이 공개하기 어려운 도구는 "재현 예제"로 표시했고, 원본 스크립트는 올리지 않았습니다.
