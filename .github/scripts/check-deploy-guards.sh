#!/usr/bin/env bash
# CI guard for deployment manifests. Fails on:
#   1. mutable ":latest" image tags in Compose, Helm values/templates, Dockerfiles;
#   2. literal passwords/secrets in deploy/helm (credentials must be supplied by
#      pre-created Kubernetes Secrets) and literal passwords in Compose (must use
#      ${VAR:?} interpolation backed by deploy/compose/.env.example).
# Static text checks only; they do not replace a secret scanner.
set -u
cd "$(git rev-parse --show-toplevel)"
status=0
fail() { echo "::error::$1"; status=1; }

# --- 1. :latest tags -------------------------------------------------------
files=$(git ls-files -- 'deploy/**/*.yaml' 'deploy/**/*.yml' 'deploy/**/*.tpl' 'apps/*/Dockerfile'; \
        git ls-files --others --exclude-standard -- 'deploy/**/*.yaml' 'deploy/**/*.yml' 'deploy/**/*.tpl' 'apps/*/Dockerfile')
for f in $(echo "$files" | sort -u); do
  [ -f "$f" ] || continue
  # image:/FROM/ARG *_IMAGE=/tag: lines, ignoring comment-only lines
  if grep -nP '^\s*(?!#)(image:|FROM\s|ARG\s+\w*IMAGE=|tag:|repository:)[^#]*(:|\s)"?latest\b' "$f"; then
    fail "$f uses a ':latest' image tag; pin an exact version or digest"
  fi
done

# --- 2a. Helm: no literal credentials --------------------------------------
helm_files=$(find deploy/helm -type f \( -name '*.yaml' -o -name '*.yml' -o -name '*.tpl' -o -name '*.txt' \) \
             ! -name 'values.schema.json')
for f in $helm_files; do
  # key names that look like credentials, with a non-empty literal value (not a
  # template expression, not an empty string, not a reference field name)
  if grep -nP '^\s*(?!#)[\w.-]*(?i:password|passwd|secret|token|apikey|api_key|access_?key|private_?key)[\w.-]*"?\s*[:=]\s*"?(?!\{\{|"?\s*$|""|\$\{)[^\s"#]' "$f" \
     | grep -vP '(?i)existingSecret|secretName|secretRef|secretKeyRef|automountServiceAccountToken|secrets:|^\d+:\s*secret:\s*$'; then
    fail "$f appears to contain a literal credential; reference a pre-created Secret instead"
  fi
  # URLs with embedded user:password@
  if grep -nP '[a-z][a-z0-9+.-]*://[^/\s:@{]+:(?!\{\{)[^/\s@{]+@' "$f"; then
    fail "$f embeds credentials in a URL"
  fi
done

# --- 2b. Compose: passwords must use interpolation ---------------------------
compose=deploy/compose/docker-compose.yaml
if grep -nP '^\s*\w*(?i:PASSWORD|SECRET|SECRET_KEY|ACCESS_KEY)\w*:\s*(?!\$\{)[^\s#]' "$compose" | grep -vP '(?i)existingSecret'; then
  fail "$compose has a literal credential; use \${VAR:?} interpolation"
fi
if grep -nP '://[^/\s:@$]+:(?!\$\{)[^/\s@]+@' "$compose"; then
  fail "$compose embeds a literal password in a URL; use \${VAR:?} interpolation"
fi

[ "$status" -eq 0 ] && echo "Deployment guards passed."
exit "$status"
