# cluster-ssh v3 — 노드 작업 CLI 사용 기록

**Evidence label:** SANITIZED OPERATIONAL TOOLING · v3.0.0

노드에 붙어서 뭔가 확인할 때마다 순서가 같았습니다. 어느 클러스터인지 고르고, kubeconfig를 찾고, `kubectl get nodes -o wide`로 Internal IP를 보고, 그 IP를 복사해서 ssh를 치고, 키 경로를 기억해내는 순서입니다. 환경이 일곱 개라 클러스터마다 kubeconfig와 private key가 따로 있어서 이 과정이 매번 반복됐습니다.

그래서 클러스터 이름과 노드 이름만 주면 나머지를 CLI가 처리하도록 만들었습니다.

## 명령

```text
cluster-ssh list
cluster-ssh nodes <cluster>
cluster-ssh <cluster>
cluster-ssh <cluster> <node-name|node-ip|index>
cluster-ssh check <cluster> <node-name|node-ip|index>
cluster-ssh exec <cluster> <node-name|node-ip|index> -- '<remote command>'
cluster-ssh doctor <cluster> <node-name|node-ip|index> [--output <file>]
cluster-ssh egress-check <cluster> <node-name|node-ip|index> \
    --egress-ip <ip> --dst <ip> --port <port> \
    [--namespace <ns>] [--pod-prefix <prefix>] [--pod <name>] \
    [--container <name>] [--iface <interface>] [--timeout <seconds>] \
    [--output <file>]
cluster-ssh refresh [cluster]
cluster-ssh version
```

노드는 이름, Internal IP, 목록 index 중 아무거나로 지정할 수 있습니다. 클러스터 이름만 주면 노드 목록에서 골라서 접속합니다.

## 클러스터를 찾는 방법

`CLUSTER_DISCOVERY_MODE`가 `static`, `supervisor`, `hybrid` 중 하나입니다.

- `static` — config에 선언한 클러스터의 kubeconfig / private key 경로를 사용합니다.
- `supervisor` — Supervisor kubeconfig로 `clusters.cluster.x-k8s.io`를 조회하고, 게스트 클러스터 kubeconfig는 `<cluster>-kubeconfig` Secret의 `value` 키에서, SSH key는 `<cluster>-ssh` Secret의 `ssh-privatekey` 키에서 꺼냅니다.

노드 목록은 20초, 클러스터 목록은 30초, kubeconfig 같은 asset은 300초 동안 캐시합니다. 캐시를 지우려면 `refresh`를 씁니다.

Bash completion은 `__complete clusters`, `__complete nodes <cluster>` 를 통해 클러스터 이름, 노드 이름, 노드 IP를 채웁니다.

## SSH 옵션

```text
-o IdentitiesOnly=yes
-o PreferredAuthentications=publickey
-o PasswordAuthentication=no
-o StrictHostKeyChecking=accept-new
-o ConnectTimeout=5
-o ServerAliveInterval=15
-o ServerAliveCountMax=2
```

비밀번호 인증을 끄고 지정한 키만 쓰도록 고정했습니다. known_hosts는 사용자 홈의 별도 state 경로를 씁니다.

## egress-check가 하는 일

Antrea Egress를 적용한 뒤 "이 Pod가 정말 이 Egress IP로 나가는가"를 확인해야 했는데, 원래는 Pod를 찾고 노드에 붙어서 tcpdump를 걸고 별도 터미널에서 접속을 만들어야 했습니다. 이걸 한 명령으로 묶었습니다.

```text
1. 클러스터 kubeconfig 해석
2. 지정한 Namespace에서 prefix가 일치하는 Running Pod 탐색
3. Pod 이름 / Pod IP / Pod가 올라간 Node 조회
4. 지정한 Egress Node로 SSH
5. Egress IP가 그 노드에 실제로 있는지, 외부로 나가는 route interface가 무엇인지 확인
6. route interface에서 ARP 응답 MAC 수집
7. tcpdump / conntrack 감시 시작
8. Pod 안에서 목적지로 TCP 연결 시도
9. Pod 트래픽 · SNAT source · return traffic을 근거로 판정
10. 전체 로그를 파일로 저장
```

Pod 선택 규칙은 애매하면 실패하도록 뒀습니다. prefix가 맞는 Running Pod가 정확히 하나면 자동 선택, 0개면 실패, 2개 이상이면 임의로 고르지 않고 `--pod`를 요구합니다.

Pod 안에서 TCP 테스트는 `nc` → `curl telnet://` → `timeout` + bash `/dev/tcp` 순으로 사용 가능한 것을 씁니다.

## 판정 출력

```text
[PASS] Egress IP is present on the selected Egress Node.
[PASS] TCP connectivity from fix-tool/... succeeded.
[PASS] Outbound traffic with source Egress IP 192.0.2.92 was observed.
[PASS] Return traffic to Egress IP 192.0.2.92 was observed.
```

SNAT 증거가 안 잡히면 이렇게 나옵니다.

```text
[FAIL] Expected SNAT source 192.0.2.92 was not observed on the external interface.
```

이때 의심할 것을 문서에 같이 적어뒀습니다. Egress Node를 잘못 지정했는지, Egress 정책의 Namespace/Pod selector가 안 맞는지, CNI가 Egress IP를 다른 노드에 배치했는지, route interface 자동 탐지가 틀렸는지, tcpdump 권한이 없는지입니다.

같은 Egress IP에 MAC이 여러 개 응답하면 IP 충돌을 강하게 의심합니다.

```text
[CRITICAL] Multiple MAC addresses responded for the Egress IP.
```

다만 proxy ARP나 네트워크 가상화 구현에 따라 ARP 결과만으로 확정하지 않고, 응답 MAC을 vCenter / NSX / 물리 스위치 MAC table에서 역추적하도록 적어뒀습니다.

## Exit code

| Code | 의미 |
|---:|---|
| 0 | Egress IP 존재, Pod 테스트 성공, SNAT 증거 확인 |
| 1 | 입력 / 설정 / Pod 탐색 / SSH / capture 준비 오류 |
| 2 | Pod 연결 실패, Egress IP 미소유, 또는 SNAT 증거 미확인 |
| 3 | 복수 ARP MAC 감지 |

## 안 하는 것

`egress-check`는 상태를 읽고 TCP 연결만 만듭니다. 아래는 하지 않습니다.

```text
Egress IP 해제
conntrack 삭제
iptables / nftables 변경
interface 변경
node cordon / drain
service restart
```

장애 상황에서 쓰는 도구라서, 확인하려다 상태를 바꿔버리는 경로를 아예 만들지 않았습니다.

## 공개본 주의

- 예시 IP는 RFC 5737 문서용 대역입니다.
- kubeconfig / private key 경로, 클러스터 alias는 실제 값 대신 placeholder를 씁니다.
