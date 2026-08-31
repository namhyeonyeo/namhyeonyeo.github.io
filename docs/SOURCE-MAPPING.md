# Source Mapping and Publication Decision

| Supplied material | Used for | Public decision |
|---|---|---|
| Egress work plan / `egress IP 설정.ini` | Antrea Egress example and validation | Sanitized derivative only |
| Autoscaling YAML bundle + runbooks | CA/HPA lab | Suitable for public repo after review |
| Kubernetes Admission Policy design PDF | Admission guardrail design write-up | Converted to public Markdown; original PDF not required |
| VAP validationActions note | Admission documentation | Included as generic technical note |
| VAP exception-handling guide | Exclusion strategy | Converted to Markdown |
| AKO/AVI architecture deck | Architecture case study | Sanitized architecture only; original deck excluded |
| GitOps working logs | GitOps migration workflow | Sanitized derivative only |
| Security guideline PDFs | Security/compliance experience | **Do not publish originals** - marked Confidential |
| Vulnerability assessment workbooks | Security remediation experience | **Do not publish originals** |
| Weekly WBS | Career evidence inventory / troubleshooting cases | **Do not publish original WBS** |

## Important security observation

The supplied GitOps working logs contain internal URLs and plaintext credentials. They are evidence of real operational work, but the raw files must not be pushed to a public GitHub repository. The GitOps files in this package are rewritten, sanitized derivatives.
