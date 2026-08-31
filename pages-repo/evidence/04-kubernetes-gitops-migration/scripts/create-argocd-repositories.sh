#!/usr/bin/env bash
set -euo pipefail

# Sanitized refactor of an operational helper.
# Do not hard-code credentials in a Git repository.

: "${GITLAB_URL:?Set GITLAB_URL, e.g. https://git.example.com}"
: "${GITLAB_USERNAME:?Set GITLAB_USERNAME}"
: "${GITLAB_PASSWORD:?Set GITLAB_PASSWORD}"
: "${ARGOCD_NAMESPACE:=argocd}"
: "${ARGOCD_PROJECT:=platform-infra}"

projects_file="${1:-project_name.txt}"

while IFS= read -r project; do
  [[ -z "$project" ]] && continue
  project_upper=$(printf '%s' "$project" | tr '[:lower:]' '[:upper:]')

  kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: repo-${project}
  namespace: ${ARGOCD_NAMESPACE}
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  name: ${project}
  project: ${ARGOCD_PROJECT}
  url: ${GITLAB_URL}/${project_upper}/infra.git
  username: ${GITLAB_USERNAME}
  password: ${GITLAB_PASSWORD}
EOF

done < "$projects_file"
