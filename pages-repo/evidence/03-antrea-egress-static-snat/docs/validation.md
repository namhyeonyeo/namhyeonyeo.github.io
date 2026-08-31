# Validation Procedure

## 1. Confirm policy objects

```bash
kubectl get externalippool sample-egress-pool -o yaml
kubectl get egress sample-app-egress -o yaml
```

## 2. Confirm the test Pod has the selector label

```bash
kubectl get pod -l app=egress-test-app --show-labels
```

## 3. Generate outbound traffic

```bash
kubectl exec -it <test-pod> -- ping <remote-server>
```

## 4. Observe the source on the remote side

```bash
sudo tcpdump -ni <interface> icmp
```

## Success criterion

The request should be observed with the configured Egress IP as the source address. The remote host should not see the underlying Kubernetes node IP as the source for the selected Pod traffic.

## Troubleshooting sequence

```text
Pod label
 -> Egress appliedTo match
 -> ExternalIPPool assignment
 -> eligible Egress node
 -> routing / L2-L3 reachability
 -> firewall
 -> remote packet capture
```
