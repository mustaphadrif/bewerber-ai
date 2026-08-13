import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/lib/db";

const STATUS_META: Record<ApplicationStatus, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "blue" }> = {
  interessiert: { label: "Interessiert", variant: "secondary" },
  beworben: { label: "Beworben", variant: "blue" },
  gesehen: { label: "Gesehen", variant: "outline" },
  interview: { label: "Interview", variant: "warning" },
  angebot: { label: "Angebot", variant: "success" },
  abgelehnt: { label: "Abgelehnt", variant: "destructive" },
  archiviert: { label: "Archiviert", variant: "secondary" },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.interessiert;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
