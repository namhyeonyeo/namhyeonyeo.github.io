# Security Notes

The original supplied working notes contained:

- internal GitLab and ArgoCD URLs
- employee/account identifiers
- plaintext passwords

Those values were intentionally excluded. Do not commit the original logs, even to a repository that you *currently* intend to keep private, unless you first rotate/remove all secrets and confirm the organization's data-handling policy.

For a public portfolio, reconstructed examples with `example.com` plus a clear `SANITIZED` label provide enough engineering evidence without exposing the customer environment.
