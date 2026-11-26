#!/usr/bin/env bash
# Run only in an isolated Kind cluster with the Git fixture image and Argo CD installed.
set -euo pipefail
[[ $# == 1 ]] || { echo 'Usage: bash scripts/verify-gitops.sh LOCAL_KIND_KUBECONFIG' >&2; exit 2; }
cfg=$1
context=$(kubectl --kubeconfig "$cfg" config current-context)
server=$(kubectl --kubeconfig "$cfg" config view --minify -o jsonpath='{.clusters[0].cluster.server}')
[[ $context == kind-* && $server == https://127.0.0.1:* ]] || { echo 'Use disposable local Kind only' >&2; exit 2; }
k(){ kubectl --kubeconfig "$cfg" --warnings-as-errors "$@"; }
root=$(cd "$(dirname "$0")/.." && pwd)
k apply -f "$root/gitops/git-service.yaml"
k -n git-lab rollout status deployment/git-server --timeout=180s
k -n git-lab wait endpointslice -l kubernetes.io/service-name=git-server --for=jsonpath='{.endpoints[0].conditions.ready}'=true --timeout=90s
k apply -f "$root/gitops/application.local.yaml"
k -n argocd annotate application fintech-local argocd.argoproj.io/refresh=hard --overwrite
k -n argocd wait application/fintech-local --for=jsonpath='{.status.sync.status}'=Synced --timeout=180s
k -n argocd wait application/fintech-local --for=jsonpath='{.status.health.status}'=Healthy --timeout=180s
next=$(k -n git-lab exec deploy/git-server -- git --git-dir=/git/repo.git rev-parse refs/heads/next)
k -n git-lab exec deploy/git-server -- git --git-dir=/git/repo.git update-ref refs/heads/main refs/heads/next
k -n argocd annotate application fintech-local argocd.argoproj.io/refresh=hard --overwrite
k -n argocd wait application/fintech-local --for=jsonpath='{.status.sync.revision}'="$next" --timeout=180s
k -n fintech-gitops wait deployment/checkout --for=jsonpath='{.status.readyReplicas}'=2 --timeout=180s
k -n fintech-gitops scale deployment/checkout --replicas=1
k -n fintech-gitops wait deployment/checkout --for=jsonpath='{.spec.replicas}'=2 --timeout=180s
k -n fintech-gitops wait deployment/checkout --for=jsonpath='{.status.readyReplicas}'=2 --timeout=180s
k -n argocd wait application/fintech-local --for=jsonpath='{.status.health.status}'=Healthy --timeout=180s
k -n argocd get application fintech-local
echo 'PASS: local Git revision reconciled and checkout drift restored'
