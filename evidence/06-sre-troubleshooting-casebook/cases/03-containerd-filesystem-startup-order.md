# containerd Started Before Its Data Filesystem Was Mounted

**Classification:** Production incident - sanitized

## Symptoms

After a worker-node/host migration and reboot event, workloads on the node did not start normally. Restarting `containerd` restored the node, which initially made the problem look like an image-cache or runtime-socket issue.

## Early hypotheses

- damaged local container image cache
- stale containerd gRPC socket
- kubelet/containerd state synchronization issue
- transient filesystem or read-only mount issue

## Evidence that changed the diagnosis

Journal timestamps showed:

```text
containerd start
    -> approximately 10 seconds later
node data filesystem mount completes
```

The delayed mount occurred while filesystem recovery (`fsck`) was cleaning state after an abrupt shutdown.

At the time containerd started, the expected data directory therefore appeared empty/unavailable. Runtime images required by local platform components could not be found until the filesystem was mounted and containerd was restarted.

## Root cause

A service ordering dependency no longer matched the filesystem behavior of the newer node image/cloud-init combination. The runtime was ordered after a remote-filesystem target while the actual data disk now belonged to the local-filesystem startup path.

## Immediate recovery

Restarting `containerd` after the filesystem was fully mounted allowed it to discover the expected data and workloads recovered.

## Long-term direction

The durable fix is to make runtime startup depend on the filesystem target that actually guarantees the node data disk is mounted. In the affected managed platform, configuration changes also had to be considered in the context of how new nodes are generated.

## What this case demonstrates

The restart was only a workaround. The root cause was found by comparing systemd/journal timestamps and filesystem startup ordering instead of stopping at "containerd restart fixed it."
