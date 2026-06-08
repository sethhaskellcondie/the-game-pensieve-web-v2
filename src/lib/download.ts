// Browser download helpers. Client-only — these touch the DOM, so call them
// from event handlers in client components, not during render or on the server.

// Triggers a browser download of `contents` as a plain-text file, cleaning up
// the temporary object URL and anchor afterward.
export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Filesystem-safe UTC timestamp for a backup file: ISO 8601 truncated to
// seconds with colons replaced by dashes, e.g. "backup-2026-06-08T14-30-00Z.txt".
export function backupFilename(): string {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  return `backup-${stamp}Z.txt`;
}
