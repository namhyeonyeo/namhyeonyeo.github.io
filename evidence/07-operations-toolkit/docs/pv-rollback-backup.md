# pv-rollback-backup.sh — 스토리지 전환 전 롤백 자료 수집

**Evidence label:** SANITIZED OPERATIONAL TOOLING

스토리지 어레이를 바꾸는 작업에서 PVC 하나를 새 StorageClass로 다시 만드는 것 자체는 어렵지 않았습니다. 문제는 되돌릴 때였습니다. 기존 PV의 reclaim policy가 무엇이었는지, claimRef에 어떤 PVC UID가 박혀 있었는지, 어떤 워크로드가 어디에 마운트하고 있었는지를 전환 후에 다시 알아내려면 이미 늦습니다.

그래서 전환 전에 되돌리는 데 필요한 것만 한 번에 받아두는 스크립트를 만들었습니다.

## 실행

```bash
./pv-rollback-backup.sh
./pv-rollback-backup.sh -n <namespace>
./pv-rollback-backup.sh -s <storageclass>
./pv-rollback-backup.sh -n <namespace> -s <storageclass>
./pv-rollback-backup.sh -d /backup/migration
```

| 옵션 | 의미 |
|---|---|
| `-n, --namespace` | 특정 Namespace의 PVC만 대상 |
| `-s, --storageclass` | 특정 StorageClass의 PVC만 대상 |
| `-d, --directory` | 백업 root 디렉터리 (기본값: 현재 경로) |

`kubectl`과 `jq`가 없으면 시작하지 않고 종료합니다.

## 만들어지는 것

```text
pv-rollback-backup_<timestamp>/
├── 00_inventory/rollback-mapping.csv
├── 01_pvc_reference/<namespace>__<pvc>.yaml
├── 02_pv_reference/<pv>.yaml
├── 03_storageclass/<storageclass>.yaml
├── 04_rollback_pvc/<namespace>__<pvc>.yaml
└── 05_rollback/
    ├── rollback-pvs.txt
    └── README.txt
```

`rollback-mapping.csv`에는 되돌릴 때 대조할 값을 한 줄로 모읍니다.

```text
NAMESPACE, PVC, OLD_PVC_UID, PVC_STATUS, PV, PV_STATUS, STORAGECLASS,
PVC_SIZE, PV_SIZE, ACCESS_MODES, VOLUME_MODE, RECLAIM_POLICY,
CSI_DRIVER, VOLUME_HANDLE, OLD_CLAIMREF_UID
```

`OLD_PVC_UID`와 `OLD_CLAIMREF_UID`는 다시 쓰라고 뽑는 값이 아닙니다. 롤백할 때 "이 PV에 붙어 있던 PVC가 정말 이것이었나"를 확인하는 용도입니다.

## status를 지우는 이유

reference YAML은 그대로 다시 apply할 수 있어야 의미가 있습니다. 그래서 클러스터가 채운 값을 걷어냅니다.

```text
status
metadata.uid / resourceVersion / generation / creationTimestamp
metadata.managedFields / ownerReferences
metadata.deletionTimestamp / deletionGracePeriodSeconds
pv.kubernetes.io/bind-completed
pv.kubernetes.io/bound-by-controller
volume.kubernetes.io/storage-provisioner
volume.kubernetes.io/selected-node
kubectl.kubernetes.io/last-applied-configuration
```

정리한 JSON은 `kubectl create --dry-run=client -o yaml`로 한 번 통과시켜서, 적용 시점에 문법이 깨지지 않는지 미리 확인합니다.

PV reference YAML에서는 `claimRef`를 일부러 남깁니다. 어떤 PVC에 묶여 있었는지가 롤백 판단의 근거이기 때문입니다.

## 롤백 PVC YAML

`04_rollback_pvc/`에는 기존 PV를 다시 잡기 위한 최소 필드만 생성합니다.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: <pvc>
  namespace: <namespace>
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: <size>
  storageClassName: <storageclass>
  volumeMode: Filesystem
  volumeName: <pv>
```

`volumeName`을 명시하는 것이 핵심입니다. 이게 없으면 롤백 PVC가 기존 PV가 아니라 새 볼륨을 프로비저닝할 수 있습니다.

## 롤백 순서

`05_rollback/README.txt`에 같이 넣어두는 순서입니다.

```text
1. 백엔드 서비스 / 워크로드 정지
2. Argo CD Auto-Sync OFF 유지
3. 새 StorageClass로 만든 PVC 정리
4. 기존 PV가 Released / Retain 상태인지 확인
5. rollback-pvs.txt 대상 PV의 claimRef 제거 (released-pv-to-available.sh)
6. 기존 PV가 Available로 바뀌었는지 확인
7. 04_rollback_pvc의 PVC YAML 적용
8. PVC/PV Bound 및 기존 볼륨 데이터 확인
9. Git 저장소의 PVC StorageClass를 AS-IS 기준으로 원복
10. Argo CD Refresh / Diff 확인
11. 필요 시 Diff 처리 후 Sync
12. 백엔드 서비스 / 워크로드 재기동
```

Argo CD Auto-Sync를 끄는 단계가 앞에 있는 이유는, 롤백 도중에 Git의 desired state가 다시 새 StorageClass를 밀어넣으면 작업이 원점으로 돌아가기 때문입니다.

## 안 하는 것

이 스크립트는 조회와 파일 생성만 합니다. Kubernetes 리소스를 만들거나 바꾸거나 지우지 않습니다. 전환 직전에 돌리는 도구라서, 자료를 모으다가 대상 리소스를 건드리는 일이 없어야 했습니다.
