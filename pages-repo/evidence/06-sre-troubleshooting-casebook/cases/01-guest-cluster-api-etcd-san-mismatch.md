# Guest Cluster API Failure Caused by etcd Certificate SAN Mismatch

**Classification:** Production incident - sanitized

## Symptoms

A guest Kubernetes cluster stopped responding to API requests. Control-plane recovery did not complete normally and cluster management operations were unavailable.

## Initial investigation

The failure was narrowed below the application layer because the API server itself was not healthy. Control-plane networking, DHCP assignment, and etcd peer health were compared with a working environment.

## Root cause

Two isolated test/development network domains had been configured with overlapping DHCP address space. When a DHCP service in the other domain restarted, a control-plane VM completed a DHCP transaction against the wrong DHCP source.

The control-plane node therefore came up with an address that did not match the address encoded in its etcd peer certificate SAN. The certificate/address mismatch prevented healthy etcd peer clustering, which in turn prevented normal kube-apiserver operation.

```text
Overlapping DHCP domains
        -> wrong control-plane address
        -> etcd peer certificate SAN mismatch
        -> etcd clustering failure
        -> kube-apiserver unavailable
        -> cluster API unavailable
```

## Recovery

- stopped the conflicting DHCP path
- restored deterministic address assignment for the affected control-plane VM
- restarted the affected control-plane node after network consistency was restored
- allowed the platform self-healing mechanism to replace one control-plane VM that did not recover cleanly

## Validation

- etcd quorum / peer health returned to normal
- `etcdctl` health checks passed
- Kubernetes API requests returned normally
- cluster nodes returned to the expected state

## What this case demonstrates

The visible symptom was "cannot connect to Kubernetes," but the actual failure crossed DHCP, PKI, etcd and kube-apiserver. The useful troubleshooting skill was following the control-plane dependency chain rather than treating the API timeout as a generic network problem.
