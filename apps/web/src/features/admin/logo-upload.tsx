import { Badge, Button, Field } from "@argus/ui";
import { ImageUp, Trash2 } from "@argus/ui/icons";
import { type ReactElement, useEffect, useId, useState } from "react";
import { ErrorState } from "../workflows/status-views.js";
import {
  LOGO_ACCEPTED_TYPES,
  LOGO_MAX_BYTES,
  useLogoUpload,
  validateLogoFile,
} from "./account-ports.js";

/**
 * Logo picker for the theme: validates a PNG/JPEG/WebP locally, previews it, uploads through the
 * typed LogoUploadPort, and stores only the returned attachment id in the draft.
 * Input: the current attachment id and a change callback. Output: id (or null to remove).
 * Errors: validation messages show on the field; upload failures show a retryable error. Nothing
 * is claimed as stored until the port returns an id.
 */
export function LogoUpload({
  attachmentId,
  onChange,
  disabled = false,
}: {
  readonly attachmentId: string | null;
  readonly onChange: (attachmentId: string | null) => void;
  readonly disabled?: boolean;
}): ReactElement {
  const inputId = useId();
  const upload = useLogoUpload();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (next: File | undefined): void => {
    upload.reset();
    if (!next) {
      setFile(null);
      setProblem(null);
      return;
    }
    const message = validateLogoFile(next);
    setProblem(message);
    setFile(message ? null : next);
  };

  const send = (): void => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (result) => {
        onChange(result.attachmentId);
        setFile(null);
      },
    });
  };

  return (
    <div className="grid gap-3">
      <Field
        label="Logo image"
        description={`PNG, JPEG or WebP up to ${LOGO_MAX_BYTES / 1024} KB. SVG is not accepted.`}
        {...(problem ? { error: problem } : {})}
      >
        <input
          id={inputId}
          type="file"
          accept={LOGO_ACCEPTED_TYPES.join(",")}
          disabled={disabled}
          onChange={(event) => choose(event.target.files?.[0])}
          className="block w-full max-w-md rounded-sm border border-border bg-surface px-2 py-1.5 text-base text-fg file:me-3 file:rounded-sm file:border-0 file:bg-surface-hover file:px-3 file:py-1 file:text-sm file:font-medium file:text-fg"
        />
      </Field>
      {file && previewUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-sunken p-3">
          <img
            src={previewUrl}
            alt="Selected logo preview"
            className="max-h-16 max-w-48 object-contain"
          />
          <span className="font-mono text-sm text-fg-muted">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </span>
          <Button
            variant="primary"
            leadingIcon={<ImageUp aria-hidden="true" />}
            loading={upload.isPending}
            onClick={send}
          >
            Upload logo
          </Button>
        </div>
      ) : null}
      {upload.isError ? (
        <ErrorState title="Couldn't upload the logo" error={upload.error} onRetry={send} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {attachmentId ? (
          <>
            <Badge tone="success">Logo attached</Badge>
            <code className="font-mono text-xs text-fg-muted">{attachmentId}</code>
            <Button
              size="sm"
              leadingIcon={<Trash2 aria-hidden="true" />}
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Remove logo
            </Button>
          </>
        ) : (
          <Badge tone="neutral" variant="outline">
            No logo attached
          </Badge>
        )}
      </div>
    </div>
  );
}
