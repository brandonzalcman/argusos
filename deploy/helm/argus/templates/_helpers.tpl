{{/*
Expand the chart name, honoring an explicit name override.
*/}}
{{- define "argus.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Build a stable, DNS-compatible release resource name.
*/}}
{{- define "argus.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/* Shared chart labels. */}}
{{- define "argus.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "argus.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* Component selector labels; these must remain immutable. */}}
{{- define "argus.selectorLabels" -}}
app.kubernetes.io/name: {{ include "argus.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .name }}
{{- end }}

{{/* Select an immutable image digest when supplied, otherwise the explicit tag. */}}
{{- define "argus.image" -}}
{{- if .image.digest }}
{{- printf "%s@%s" .image.repository .image.digest }}
{{- else }}
{{- printf "%s:%s" .image.repository .image.tag }}
{{- end }}
{{- end }}

{{/*
Fail rendering before Kubernetes admission when external dependencies or the
pre-created runtime Secret are absent. This chart never provisions them.
*/}}
{{- define "argus.validateExternalDependencies" -}}
{{- required "external.publicWebUrl is required" .Values.external.publicWebUrl }}
{{- required "external.publicApiUrl is required" .Values.external.publicApiUrl }}
{{- required "external.publicRealtimeUrl is required" .Values.external.publicRealtimeUrl }}
{{- required "external.publicElectricUrl is required (ElectricSQL is not installed by this chart)" .Values.external.publicElectricUrl }}
{{- required "external.publicTilesUrl is required (Martin is not installed by this chart)" .Values.external.publicTilesUrl }}
{{- required "external.postgresql.host is required (PostgreSQL is not installed by this chart)" .Values.external.postgresql.host }}
{{- required "external.nats.host is required (NATS JetStream is not installed by this chart)" .Values.external.nats.host }}
{{- required "external.objectStorage.endpoint is required (S3 storage is not installed by this chart)" .Values.external.objectStorage.endpoint }}
{{- required "external.objectStorage.region is required" .Values.external.objectStorage.region }}
{{- range $workload := list "api" "realtime" "worker" }}
{{- include "argus.secretName" (dict "root" $ "name" $workload) }}
{{- end }}
{{- if and .Values.networkPolicy.enabled .Values.ingress.enabled (not .Values.networkPolicy.ingressFrom) }}
{{- fail "networkPolicy.ingressFrom is required when ingress and networkPolicy are enabled (default deny would block the ingress controller)" }}
{{- end }}
{{- include "argus.validateImages" . }}
{{- end }}

{{/*
Name of the pre-created Secret for one server workload. Each workload has its own
Secret so a compromised pod never receives another workload's credentials.
*/}}
{{- define "argus.secretName" -}}
{{- $entry := index .root.Values.secrets .name -}}
{{- required (printf "secrets.%s.existingSecret is required; create the Secret out of band" .name) $entry.existingSecret }}
{{- end }}

{{/*
Never allow a mutable "latest" tag; with production=true require an immutable
sha256 digest for every workload.
*/}}
{{- define "argus.validateImages" -}}
{{- range $name, $workload := .Values.workloads }}
{{- if eq $workload.image.tag "latest" }}
{{- fail (printf "workloads.%s.image.tag must not be \"latest\"" $name) }}
{{- end }}
{{- if and $.Values.production (not $workload.image.digest) }}
{{- fail (printf "production=true requires workloads.%s.image.digest (sha256:...)" $name) }}
{{- end }}
{{- end }}
{{- end }}
