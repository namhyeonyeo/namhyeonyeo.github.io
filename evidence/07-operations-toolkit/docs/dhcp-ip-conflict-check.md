# DHCP lease / IP 충돌 점검 절차

**Evidence label:** SANITIZED OPERATIONAL RUNBOOK

노드 롤링 업데이트를 하려는데 DHCP lease가 부족해서 새 노드가 IP를 못 받는 상황이 있었습니다. lease 파일에는 `free`로 보이는 IP가 있는데, 그렇다고 그 IP를 바로 pool에 넣거나 재사용할 수는 없었습니다. lease가 만료됐어도 그 주소를 아직 들고 있는 장비가 있으면 IP 충돌이 됩니다.

그래서 lease 상태만 믿지 않고, 실제 응답과 Kubernetes Node 목록을 같이 보고 판단하도록 순서를 고정했습니다.

## 1. lease 파일을 먼저 백업한다

작업 중 lease 파일을 건드릴 수 있으므로 먼저 복사본을 남깁니다.

```bash
cp -a /var/lib/dhcpd/dhcpd.leases \
  /var/backup/dhcpd.leases.$(date +%Y%m%d-%H%M%S)
```

## 2. active binding 수를 센다

pool이 실제로 얼마나 찼는지부터 확인합니다.

```bash
awk '/binding state active/ {count++} END {print count}' /var/lib/dhcpd/dhcpd.leases
```

## 3. active / free를 분리한다

lease 파일을 IP 기준으로 정렬해서 `binding state active`와 `binding state free`를 나눠 봅니다. 여기서 나온 free 목록은 "후보"일 뿐입니다.

## 4. free로 보이는 IP에 실제로 응답이 오는지 본다

ping만으로는 부족합니다. ICMP를 막아둔 장비도 ARP에는 응답합니다.

```bash
for i in $(seq 10 30); do
  ip=192.0.2.$i
  ping -c1 -W1 "$ip" >/dev/null 2>&1 && continue
  arping -I <interface> -c 2 -w 2 "$ip" >/dev/null 2>&1 && continue

  echo "$ip AVAILABLE"
done
```

`ping`과 `arping` 둘 다 무응답인 주소만 `AVAILABLE`로 출력합니다. 둘 중 하나라도 응답하면 lease 상태와 무관하게 사용 중으로 봅니다.

단일 IP만 확인할 때는 이렇게 씁니다.

```bash
arping -I <interface> -c 2 -w 2 192.0.2.25
```

## 5. Kubernetes Node IP와 대조한다

lease와 ARP만 보면 "지금 이 IP를 클러스터가 쓰고 있는지"를 알 수 없습니다. Node 목록의 InternalIP와 맞춰봅니다.

```bash
kubectl get nodes -o wide
```

여기서 세 가지가 갈립니다.

| lease | ARP 응답 | Node InternalIP | 해석 |
|---|---|---|---|
| active | 있음 | 있음 | 정상 사용 중 |
| free | 있음 | 없음 | lease만 만료. 다른 장비가 점유 중일 수 있어 재사용 금지 |
| free | 없음 | 없음 | 회수 후보 |
| active | 없음 | 없음 | lease만 남은 잔여 항목. 회수 검토 대상 |

## 6. 같은 IP에 MAC이 여러 개 응답하면 멈춘다

`arping` 응답에 MAC이 둘 이상 보이면 IP 충돌을 의심합니다. 이 경우 IP를 재사용하지 않고 응답 MAC을 vCenter / 스위치 MAC table에서 역추적합니다.

같은 판정을 노드 Egress IP 쪽에서도 쓰고 있습니다. `cluster-ssh egress-check`가 복수 MAC 응답을 `[CRITICAL]`로 올리는 것이 같은 이유입니다.

## 7. pool이 실제로 부족하면 lease pool을 늘린다

회수 가능한 IP가 없고 롤링 업데이트가 lease 부족으로 막힌 경우에는, `dhcpd.conf`에 worker node용 IP pool을 추가해서 할당 여지를 만들었습니다.

## 공개본 주의

- 예시 IP는 RFC 5737 문서용 대역(`192.0.2.0/24`)입니다.
- interface 이름과 실제 pool 대역은 placeholder로 두었습니다.
