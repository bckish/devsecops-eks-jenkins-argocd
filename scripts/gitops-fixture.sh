#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp/source" "$tmp/repo.git"; rm -f "$tmp/git_server.py" "$tmp/Dockerfile" "$tmp/values.next"; rmdir "$tmp"' EXIT
mkdir "$tmp/source"
cp -R chart "$tmp/source/chart"
git -C "$tmp/source" init -q -b main
git -C "$tmp/source" add chart
git -C "$tmp/source" -c user.name=Local -c user.email=local@example.invalid commit -qm 'Initial local release'
git -C "$tmp/source" switch -q -c next
sed 's/^checkoutReplicas: 1$/checkoutReplicas: 2/' "$tmp/source/chart/values.yaml" > "$tmp/values.next"
mv "$tmp/values.next" "$tmp/source/chart/values.yaml"
git -C "$tmp/source" add chart/values.yaml
git -C "$tmp/source" -c user.name=Local -c user.email=local@example.invalid commit -qm 'Scale stateless checkout'
git -C "$tmp/source" switch -q main
git clone -q --bare "$tmp/source" "$tmp/repo.git"
cp gitops/git_server.py "$tmp/git_server.py"
cp gitops/git-server.Dockerfile "$tmp/Dockerfile"
docker build -t fintech-git-source:local "$tmp"
git --git-dir="$tmp/repo.git" show-ref
