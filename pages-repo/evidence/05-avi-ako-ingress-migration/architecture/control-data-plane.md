# Control Plane vs Data Plane

The public diagram deliberately separates control-plane configuration from runtime traffic.

## AS-IS - Contour / HTTPProxy model

### Control plane

```mermaid
flowchart LR
    HP[HTTPProxy / Ingress] --> C[Contour]
    C --> ECFG[Envoy configuration]
```

### Data plane

```mermaid
flowchart LR
    CL[Client] --> DNS[DNS]
    DNS --> VIP[AVI VIP]
    VIP --> SE[Service Engine]
    SE --> ENV[Envoy]
    ENV --> SVC[Kubernetes Service]
    SVC --> POD[Pod]
```

## TO-BE - AKO / AVI Ingress model

### Control plane

```mermaid
flowchart LR
    ING[Ingress] --> AKO[AKO]
    AIS[AviInfraSetting / IngressClass] --> AKO
    HR[HostRule / AVI CRD] --> AKO
    AKO --> AVI[AVI Controller]
    AVI --> VS[Virtual Service / VIP configuration]
```

### Data plane

```mermaid
flowchart LR
    CL[Client] --> DNS[DNS]
    DNS --> VIP[AVI VIP]
    VIP --> SE[Service Engine]
    SE --> SVC[Kubernetes Service / Node backend]
    SVC --> POD[Pod]
```

## Why this separation matters

AKO and Contour are controllers. They configure the data-plane components but are not normally inline hops for every application packet. Showing control plane and data plane separately makes the portfolio architecture easier to defend technically.
