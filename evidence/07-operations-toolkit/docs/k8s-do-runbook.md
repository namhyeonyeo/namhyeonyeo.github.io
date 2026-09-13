# k8s-do v3.2 — 노드 작업 CLI 사용 기록

**Evidence label:** SANITIZED OPERATIONAL TOOLING · v3.2.0

노드에 붙어서 뭔가 확인할 때마다 순서가 같았습니다. 어느 클러스터인지 고르고, kubeconfig를 찾고, `kubectl get nodes -o wide`로 Internal IP를 보고, 그 IP를 복사해서 ssh를 치고, 키 경로를 기억해내는 순서입니다. 환경이 일곱 개라 클러스터마다 kubeconfig와 private key가 따로 있어서 이 과정이 매번 반복됐습니다.

그래서 클러스터 이름과 노드 이름만 주면 나머지를 CLI가 처리하도록 만들었습니다.

## 명령

```text
k8s-do list
k8s-do nodes <cluster>
k8s-do <cluster>
k8s-do <cluster> <node-name|node-ip|index>
k8s-do check <cluster> <node-name|node-ip|index>
k8s-do exec <cluster> <node-name|node-ip|index> -- '<remote command>'
k8s-do doctor <cluster> <node-name|node-ip|index> [--output <file>]
k8s-do egress-check <cluster> <node-name|node-ip|index> \
    --egress-ip <ip> --dst <ip> --port <port> \
    [--namespace <ns>] [--pod-prefix <prefix>] [--pod <name>] \
    [--container <name>] [--iface <interface>] [--timeout <seconds>] \
    [--output <file>]
k8s-do refresh [cluster]
k8s-do version
```

노드는 이름, InternalIP, 목록 index 중 아무거나로 지정할 수 있습니다. 클러스터 이름만 주면 노드 목록을 띄우고 거기서 골라 접속합니다.

## 클러스터를 찾는 방법

`CLUSTER_DISCOVERY_MODE`가 `static`, `supervisor`, `hybrid` 중 하나입니다.

- `static` — kubeconfig 디렉터리에 있는 파일을 그대로 클러스터 목록으로 씁니다. 클러스터 이름은 파일 이름에서 만들고 `.conf`, `.kubeconfig`, `.yaml`, `.yml` 확장자는 떼어냅니다. private key는 같은 이름으로 확장자 없음 / `.pem` / `.key` 순으로 찾습니다. 클러스터를 추가할 때 설정 파일을 고치지 않고 kubeconfig만 넣으면 되도록 한 부분입니다.
- `supervisor` — Supervisor Kubernetes API를 조회하고, 워크로드 클러스터의 kubeconfig와 SSH private key를 Kubernetes Secret에서 가져옵니다. 클러스터 이름은 `namespace/cluster-name` 형식을 씁니다.
- `hybrid` — 위 두 방식을 같이 씁니다.

공개본에서는 kubeconfig / private key 디렉터리를 실제 경로 대신 `Kubeconfig Directory`, `Private Key Directory`로만 적습니다.

## 노드를 고르는 방법

`nodes`는 Kubernetes API에서 노드 이름, InternalIP, Ready 상태, `spec.unschedulable`, kubelet 버전을 읽어 표로 보여줍니다.

```text
INDEX  NODE              INTERNAL-IP   STATUS  SCHEDULING  VERSION
1      worker-node-01    192.0.2.21    Ready   Enabled     v1.30.1
2      worker-node-02    192.0.2.22    Ready   Enabled     v1.30.1
```

대상 노드를 주지 않으면 이 표를 띄운 뒤, `fzf`가 설치돼 있으면 fzf로, 없으면 INDEX / NODE / IP 입력으로 고릅니다. 고른 노드가 그 클러스터에 실제로 속하는지 확인한 다음 접속합니다.

## Bash completion

명령 이름, 클러스터 이름, 노드 대상, `doctor`/`egress-check` 옵션을 채웁니다.

노드 completion은 이름만 삽입하되, Bash가 후보를 나열할 때는 읽을 수 있는 표를 같이 출력합니다.

```text
$ k8s-do prod-workload <TAB><TAB>
NODE              INTERNAL-IP   STATUS  SCHEDULING  VERSION
worker-node-01    192.0.2.21    Ready   Enabled     v1.30.1
worker-node-02    192.0.2.22    Ready   Enabled     v1.30.1
```

`Tab을 눌렀을 때 Node 이름과 IP를 같은 줄에서 보고 싶다`는 요구에서 나온 동작입니다. IP는 별도 후보로 삽입되지 않지만 직접 입력하면 그대로 대상이 됩니다.

## 캐시

노드 목록은 20초, 클러스터 목록은 30초, kubeconfig 같은 asset은 300초 캐시합니다. `refresh [cluster]`로 전체 또는 특정 클러스터 캐시를 비웁니다.

Kubernetes API 조회가 실패했는데 오래된 캐시가 남아 있으면, 경고를 찍고 그 캐시를 그대로 씁니다. 장애를 보러 들어가는 도구가 API 응답이 없다고 먼저 멈추면 곤란해서 둔 동작입니다.

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

비밀번호 인증을 끄고 지정한 키만 쓰도록 고정했습니다. known_hosts는 k8s-do 전용 파일을 따로 씁니다.

## doctor가 모으는 것

노드가 이상할 때 Kubernetes 쪽 상태와 노드 OS 쪽 상태를 각각 다른 창에서 보고 있었습니다. 두 관점을 한 리포트로 모읍니다.

Kubernetes 쪽:

```text
kubectl describe node <node>
그 노드에 올라간 Pod 목록
그 노드에 대한 Event
```

노드 OS 쪽(SSH):

```text
hostname -f / date -Is / uptime
ip -br addr
ip route
ip -6 route
ip neigh
ss -s
kubelet 등 주요 서비스 상태
최근 kubelet warning 로그
```

결과는 로그 파일로 저장합니다. `--output`으로 경로를 지정할 수 있습니다.

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
