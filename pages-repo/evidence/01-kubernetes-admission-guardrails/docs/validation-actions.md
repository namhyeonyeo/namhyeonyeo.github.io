# ValidatingAdmissionPolicy - validationActions 정리

## 개요

`ValidatingAdmissionPolicy`는 Kubernetes API 요청을 CEL 표현식으로 검증하는 기능이다.

정책 자체는 `ValidatingAdmissionPolicy`에 정의하고, 실제 적용 방식은 `ValidatingAdmissionPolicyBinding`에서 지정한다.

여기서 중요한 값이 `validationActions`이다.

쉽게 말하면, 정책에 걸렸을 때 API 서버가 어떻게 처리할지를 정하는 옵션이다.

```yaml
spec:
  validationActions:
    - Deny
```

지원하는 action은 3가지다.

- `Deny`
- `Warn`
- `Audit`

---

## 1. Deny

`Deny`는 정책 위반 시 요청을 차단한다.

예를 들어 특정 라벨이 없는 리소스를 막는 정책이 있고, 해당 라벨 없이 Pod를 생성하면 API 서버에서 생성 요청을 거부한다.

```yaml
validationActions:
  - Deny
```

결과적으로 리소스는 생성되지 않는다.

예상 동작은 다음과 같다.

```text
kubectl apply -f pod.yaml

Error from server: admission webhook ... denied the request
```

운영 환경에서 실제로 정책을 강제할 때 사용한다.

사용 예시는 다음과 같다.

- 필수 라벨 강제
- `latest` 이미지 태그 금지
- privileged container 금지
- hostPath 사용 제한
- resource request/limit 필수화

단, 처음부터 `Deny`로 적용하면 기존 배포 파이프라인이나 Helm chart가 실패할 수 있다.

그래서 운영에서는 보통 `Audit` 또는 `Warn`으로 먼저 확인한 뒤 `Deny`로 전환하는 편이 안전하다.

---

## 2. Warn

`Warn`은 정책 위반 시 경고만 출력하고 요청은 허용한다.

```yaml
validationActions:
  - Warn
```

예를 들어 정책에 맞지 않는 Pod를 생성하더라도 리소스는 생성된다.

대신 `kubectl` 화면에 warning 메시지가 출력될 수 있다.

```text
Warning: env label is required
pod/test-pod created
```

중요한 점은 요청이 실패하지 않는다는 것이다.

운영 적용 전에 사용자나 배포 담당자에게 정책 위반 내용을 알려주는 용도로 적합하다.

주로 다음 단계에서 사용한다.

- 정책 도입 전 사전 안내
- 기존 리소스 영향도 확인
- CI/CD 배포 실패 없이 경고만 노출
- 정책 메시지가 적절한지 확인

`Warn`은 개발팀이나 운영팀에게 “앞으로 이 정책이 강제될 수 있다”는 신호를 주는 용도로 괜찮다.

---

## 3. Audit

`Audit`은 정책 위반 시 요청은 허용하고, API 서버 audit log에 기록한다.

```yaml
validationActions:
  - Audit
```

사용자 입장에서는 별도 에러나 경고를 못 볼 수 있다.

하지만 API 서버 audit log에는 정책 위반 내용이 남는다.

운영 관점에서는 조용히 데이터를 수집하는 방식이다.

사용 예시는 다음과 같다.

- 정책 적용 전 영향도 조사
- 어떤 네임스페이스에서 위반이 많은지 확인
- 보안 정책 위반 이력 수집
- Splunk, ELK, SIEM 연동을 통한 분석

운영 클러스터에 바로 차단 정책을 넣기 부담스러울 때 먼저 쓰기 좋다.

---

## Action 조합

`validationActions`는 배열이라서 여러 개를 같이 사용할 수 있다.

예를 들어 아래처럼 사용할 수 있다.

```yaml
validationActions:
  - Warn
  - Audit
```

이 경우 정책 위반 시 동작은 다음과 같다.

- 요청은 허용된다.
- 사용자에게 warning이 보인다.
- audit log에도 기록된다.

운영 적용 전 점검 단계에서 가장 무난한 조합이다.

또 다른 예시는 다음과 같다.

```yaml
validationActions:
  - Deny
  - Audit
```

이 경우 정책 위반 요청은 차단되고, audit log에도 기록된다.

운영에서 정책을 강제하면서 이력까지 남기고 싶을 때 사용할 수 있다.

단, `Deny`와 `Warn`은 같이 쓰지 않는 것이 맞다.

```yaml
validationActions:
  - Deny
  - Warn
```

이 조합은 적절하지 않다.

`Deny`를 사용하면 어차피 요청이 실패하면서 에러가 반환되기 때문에, `Warn`까지 같이 줄 필요가 없다.

---

## 운영 적용 순서

운영 클러스터에서는 보통 아래 순서가 안전하다.

### 1단계: Audit

```yaml
validationActions:
  - Audit
```

먼저 정책 위반 현황만 수집한다.

이 단계에서는 사용자나 배포 파이프라인에 영향이 거의 없다.

---

### 2단계: Warn + Audit

```yaml
validationActions:
  - Warn
  - Audit
```

사용자에게 경고를 보여주고, audit log에도 남긴다.

정책을 강제하기 전에 개발팀이나 운영팀에 사전 안내하는 단계로 볼 수 있다.

---

### 3단계: Deny + Audit

```yaml
validationActions:
  - Deny
  - Audit
```

정책을 실제로 강제한다.

위반 요청은 차단되고, 이력도 audit log에 남는다.

운영 정책이 충분히 검증된 뒤 적용하는 것이 좋다.

---

## 간단 비교

| Action | 요청 차단 | 사용자 경고 | Audit 기록 | 용도 |
|---|---:|---:|---:|---|
| `Deny` | O | O | 설정에 따라 가능 | 정책 강제 |
| `Warn` | X | O | X | 사전 경고 |
| `Audit` | X | X | O | 조용한 점검 |
| `Warn + Audit` | X | O | O | 운영 적용 전 검증 |
| `Deny + Audit` | O | O | O | 운영 강제 적용 |

---

## 정리

`validationActions`는 정책 조건 자체가 아니라, 정책 위반 시 처리 방식을 정하는 값이다.

간단히 정리하면 다음과 같다.

```text
Deny  = 막는다
Warn  = 허용하지만 경고한다
Audit = 허용하지만 로그에 남긴다
```

운영에서는 바로 `Deny`로 시작하기보다 `Audit` → `Warn + Audit` → `Deny + Audit` 순서로 적용하는 것이 안전하다.
