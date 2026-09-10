#!/usr/bin/env bash
set -euo pipefail

# pv-rollback-backup.sh
#
# PowerStore PV Migration 전 Rollback 자료 수집
#
# 생성 항목:
#   - PVC/PV Mapping CSV
#   - Rollback 대상 PV 목록
#   - status/runtime metadata가 제거된 PVC/PV Reference YAML
#   - 기존 PV에 재바인딩하기 위한 Rollback PVC YAML
#   - 사용 중인 StorageClass YAML
#
# Rollback PVC YAML에는 기존 PV를 명시적으로 선택하기 위해
# spec.volumeName이 자동으로 포함됨.
#
# Requirements:
#   - kubectl
#   - jq
#
# Usage:
#   ./pv-rollback-backup.sh
#   ./pv-rollback-backup.sh -n <namespace>
#   ./pv-rollback-backup.sh -s <storageclass>
#   ./pv-rollback-backup.sh -n <namespace> -s <storageclass>
#   ./pv-rollback-backup.sh -d /backup/path
#
# NOTE:
#   본 스크립트는 조회/파일 생성만 수행하며 Kubernetes Resource를 변경하지 않음.

NAMESPACE=""
STORAGECLASS=""
BASE_DIR="."

usage() {
  cat <<'EOF'
Usage:
  pv-rollback-backup.sh [options]

Options:
  -n, --namespace <namespace>      특정 Namespace의 PVC만 대상
  -s, --storageclass <name>        특정 StorageClass PVC만 대상
  -d, --directory <path>           백업 Root Directory (default: current directory)
  -h, --help                       도움말

Examples:
  ./pv-rollback-backup.sh
  ./pv-rollback-backup.sh -n <namespace>
  ./pv-rollback-backup.sh -s <source-storageclass>
  ./pv-rollback-backup.sh -n <namespace> -s <source-storageclass>
  ./pv-rollback-backup.sh -d /backup/migration
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--namespace)
      [[ $# -ge 2 ]] || { echo "ERROR: namespace value required" >&2; exit 1; }
      NAMESPACE="$2"
      shift 2
      ;;
    -s|--storageclass)
      [[ $# -ge 2 ]] || { echo "ERROR: storageclass value required" >&2; exit 1; }
      STORAGECLASS="$2"
      shift 2
      ;;
    -d|--directory)
      [[ $# -ge 2 ]] || { echo "ERROR: directory value required" >&2; exit 1; }
      BASE_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

for cmd in kubectl jq; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "ERROR: '$cmd' command not found." >&2
    exit 1
  }
done

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BASE_DIR%/}/powerstore-rollback-backup_${TIMESTAMP}"

mkdir -p \
  "$OUT/00_inventory" \
  "$OUT/01_pvc_reference" \
  "$OUT/02_pv_reference" \
  "$OUT/03_storageclass" \
  "$OUT/04_rollback_pvc" \
  "$OUT/05_rollback"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

if [[ -n "$NAMESPACE" ]]; then
  kubectl get pvc -n "$NAMESPACE" -o json > "$tmpdir/pvcs.json"
else
  kubectl get pvc -A -o json > "$tmpdir/pvcs.json"
fi

kubectl get pv -o json > "$tmpdir/pvs.json"

# 대상 PVC 목록 추출
jq -r \
  --arg sc "$STORAGECLASS" '
    .items[]
    | select(($sc == "") or (.spec.storageClassName == $sc))
    | [
        .metadata.namespace,
        .metadata.name,
        (.metadata.uid // "-"),
        (.status.phase // "-"),
        (.spec.volumeName // ""),
        (.spec.storageClassName // "-"),
        (.spec.resources.requests.storage // "-"),
        ((.spec.accessModes // []) | join("|")),
        (.spec.volumeMode // "Filesystem")
      ]
    | @tsv
  ' "$tmpdir/pvcs.json" > "$tmpdir/targets.tsv"

if [[ ! -s "$tmpdir/targets.tsv" ]]; then
  echo "No matching PVCs found."
  exit 0
fi

# CSV Header
echo '"NAMESPACE","PVC","OLD_PVC_UID","PVC_STATUS","PV","PV_STATUS","STORAGECLASS","PVC_SIZE","PV_SIZE","ACCESS_MODES","VOLUME_MODE","RECLAIM_POLICY","CSI_DRIVER","VOLUME_HANDLE","OLD_CLAIMREF_UID"' \
  > "$OUT/00_inventory/rollback-mapping.csv"

: > "$OUT/05_rollback/rollback-pvs.txt"

sanitize_resource() {
  # stdin: Kubernetes JSON
  # stdout: rollback/reference용 YAML
  jq '
    del(
      .status,
      .metadata.uid,
      .metadata.resourceVersion,
      .metadata.generation,
      .metadata.creationTimestamp,
      .metadata.managedFields,
      .metadata.deletionTimestamp,
      .metadata.deletionGracePeriodSeconds,
      .metadata.ownerReferences
    )
    | if .metadata.annotations then
        del(
          .metadata.annotations["pv.kubernetes.io/bind-completed"],
          .metadata.annotations["pv.kubernetes.io/bound-by-controller"],
          .metadata.annotations["volume.beta.kubernetes.io/storage-provisioner"],
          .metadata.annotations["volume.kubernetes.io/storage-provisioner"],
          .metadata.annotations["volume.kubernetes.io/selected-node"],
          .metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"]
        )
      else .
      end
  ' | kubectl create --dry-run=client -f - -o yaml
}

while IFS=$'\t' read -r ns pvc pvc_uid pvc_status pv sc pvc_size access_modes volume_mode; do
  [[ -z "$pvc" ]] && continue

  safe_ns="${ns//\//_}"
  safe_pvc="${pvc//\//_}"

  # PVC Reference YAML: status 및 runtime metadata 제거
  kubectl get pvc "$pvc" -n "$ns" -o json \
    | sanitize_resource \
    > "$OUT/01_pvc_reference/${safe_ns}__${safe_pvc}.yaml"

  pv_status="-"
  pv_size="-"
  reclaim="-"
  csi_driver="-"
  volume_handle="-"
  claimref_uid="-"

  if [[ -n "$pv" ]]; then
    pv_json="$(jq -c --arg pv "$pv" '[.items[] | select(.metadata.name == $pv)][0] // empty' "$tmpdir/pvs.json")"

    if [[ -n "$pv_json" ]]; then
      pv_status="$(jq -r '.status.phase // "-"' <<<"$pv_json")"
      pv_size="$(jq -r '.spec.capacity.storage // "-"' <<<"$pv_json")"
      reclaim="$(jq -r '.spec.persistentVolumeReclaimPolicy // "-"' <<<"$pv_json")"
      csi_driver="$(jq -r '.spec.csi.driver // "-"' <<<"$pv_json")"
      volume_handle="$(jq -r '.spec.csi.volumeHandle // "-"' <<<"$pv_json")"
      claimref_uid="$(jq -r '.spec.claimRef.uid // "-"' <<<"$pv_json")"

      # PV Reference YAML: claimRef는 기존 Binding 증빙용으로 유지
      printf '%s\n' "$pv_json" \
        | sanitize_resource \
        > "$OUT/02_pv_reference/${pv}.yaml"

      echo "$pv" >> "$OUT/05_rollback/rollback-pvs.txt"
    fi
  fi

  # StorageClass 백업 (중복 방지)
  if [[ "$sc" != "-" && -n "$sc" && ! -f "$OUT/03_storageclass/${sc}.yaml" ]]; then
    kubectl get storageclass "$sc" -o json \
      | sanitize_resource \
      > "$OUT/03_storageclass/${sc}.yaml"
  fi

  # Rollback PVC YAML 생성
  # 기존 PV를 재사용하기 위한 최소 필드만 생성
  {
    echo "apiVersion: v1"
    echo "kind: PersistentVolumeClaim"
    echo "metadata:"
    echo "  name: ${pvc}"
    echo "  namespace: ${ns}"
    echo "spec:"
    echo "  accessModes:"
    IFS='|' read -ra modes <<< "$access_modes"
    for mode in "${modes[@]}"; do
      [[ -n "$mode" ]] && echo "    - ${mode}"
    done
    echo "  resources:"
    echo "    requests:"
    echo "      storage: ${pvc_size}"
    echo "  storageClassName: ${sc}"
    echo "  volumeMode: ${volume_mode}"
    if [[ -n "$pv" ]]; then
      echo "  volumeName: ${pv}"
    fi
  } > "$OUT/04_rollback_pvc/${safe_ns}__${safe_pvc}.yaml"

  # CSV row
  jq -nr \
    --arg ns "$ns" \
    --arg pvc "$pvc" \
    --arg pvcuid "$pvc_uid" \
    --arg pvcstatus "$pvc_status" \
    --arg pv "${pv:-<unbound>}" \
    --arg pvstatus "$pv_status" \
    --arg sc "$sc" \
    --arg pvcsize "$pvc_size" \
    --arg pvsize "$pv_size" \
    --arg am "$access_modes" \
    --arg vm "$volume_mode" \
    --arg reclaim "$reclaim" \
    --arg driver "$csi_driver" \
    --arg handle "$volume_handle" \
    --arg claimuid "$claimref_uid" \
    '[$ns,$pvc,$pvcuid,$pvcstatus,$pv,$pvstatus,$sc,$pvcsize,$pvsize,$am,$vm,$reclaim,$driver,$handle,$claimuid] | @csv' \
    >> "$OUT/00_inventory/rollback-mapping.csv"

done < "$tmpdir/targets.tsv"

sort -u "$OUT/05_rollback/rollback-pvs.txt" -o "$OUT/05_rollback/rollback-pvs.txt"

cat > "$OUT/05_rollback/README.txt" <<'EOF'
Rollback 사용 순서 예시

1. Backend Service / Workload Stop
2. Argo CD Auto-Sync OFF 유지
3. 신규 StorageClass로 만든 PVC 정리
4. 기존 StorageClass의 PV가 Released / Retain 상태인지 확인
5. released-pv-to-available.sh로 rollback-pvs.txt 대상 claimRef 제거
6. 기존 StorageClass의 PV Available 확인
7. 04_rollback_pvc의 PVC YAML 적용
8. PVC/PV Bound 및 기존 볼륨 데이터 확인
9. GitLab PVC StorageClass를 AS-IS 기준으로 원복
10. Argo CD Refresh / Diff 확인
11. 필요 시 Diff 처리 후 Sync
12. Backend Service / Workload 재기동

주의:
- OLD_PVC_UID는 재사용 대상이 아닌 Mapping/검증용 정보
- 04_rollback_pvc YAML에는 기존 PV 재바인딩을 위해 spec.volumeName 포함
- 01/02 Reference YAML은 상태 확인/증빙용이며 직접 apply 용도가 아님
EOF

echo
echo "Rollback backup completed."
echo "Output: $OUT"
echo
echo "Tree:"
find "$OUT" -maxdepth 2 -type f | sort | sed "s#^$OUT#.#"
