export default function VersionInfo({ meta }: { meta?: any }) {
  const source = meta?.source ?? "local";
  const backendVersion =
    meta?.version ?? (source === "local" ? "Local (no backend)" : "Degraded (timeout)");

  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="font-semibold">Version Info:</div>
      <div>UI: {(import.meta as any).env?.VITE_APP_VERSION ?? "ui-unknown"}</div>
      <div>Backend: {backendVersion}</div>
      <div>Source: {String(source)}</div>
    </div>
  );
}