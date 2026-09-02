# Kubernetes Admission Guardrails / 운영 정책 가드레일

**Evidence label:** SANITIZED PRODUCTION CASE

## 운영 적용 범위

운영 환경에는 `ValidatingAdmissionPolicy` + CEL 기반 정책을 적용했습니다. 별도의 Mutating Webhook은 운영 환경에 적용하지 않았습니다. Mutation은 테스트/설계 단계에서 검토한 내용으로만 분리합니다.

## Production policy

- Deployment / StatefulSet / DaemonSet의 CPU·Memory requests/limits 검증
- VAP + VAPBinding으로 Deny/Warn 동작 관리
- `policy-exclude=true`가 부여된 Namespace는 guardrail 영향에서 제외
- `--dry-run=server`로 실제 API admission 경로를 통과시키며 CEL 정책 동작 검증

## ResourceQuota와의 관계

Admission Policy와 ResourceQuota는 별도 제어 계층입니다. `--dry-run=server`에서 VAP 검증이 정상이어도 실제 리소스 생성 시 ResourceQuota가 부족하면 배포는 거부될 수 있습니다. 운영 테스트에서 두 동작을 분리해 확인했습니다.

## 테스트/설계 범위

Pod Security label 자동 주입을 위한 Mutating Webhook 설계도 검토했지만 고객 운영 환경에는 적용하지 않았습니다. 공개 문서에서는 Production 적용 내용과 테스트 설계를 명확히 구분합니다.

## Files

- `manifests/workload-guardrails.yaml` — sanitized VAP/VAPBinding example
- `docs/exclusion-strategy.md` — Namespace exception strategy
- `docs/validation-actions.md` — Deny/Warn/Audit 운영 모델
- `docs/policy-design.md` — Production과 test design의 경계
