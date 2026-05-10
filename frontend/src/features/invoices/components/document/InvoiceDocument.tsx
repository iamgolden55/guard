// InvoiceDocument — selects template + wraps in PaperFrame.
// Ported 1:1 from project/invoice-document.jsx:511-528.
import type { Accent } from "../../../../design-system/accents";
import type { InvoiceRecord } from "../../data/mocks";
import { ClassicInvoice } from "./ClassicInvoice";
import { ModernInvoice } from "./ModernInvoice";
import { MinimalInvoice } from "./MinimalInvoice";
import { PaperFrame } from "./PaperFrame";

export type InvoiceTemplate = "modern" | "classic" | "minimal";

export interface InvoiceDocumentProps {
  inv: InvoiceRecord | undefined;
  template: InvoiceTemplate;
  accent: Accent;
  paperEffect?: boolean;
  scale?: number;
  /** When provided on a draft staff invoice, base-rate shift cells become
   * click-to-edit. Resolves once the API mutation completes. */
  onEditShiftRate?: (shiftId: number, hourlyRate: number) => Promise<void>;
}

export function InvoiceDocument({
  inv,
  template,
  accent,
  paperEffect = true,
  scale = 1,
  onEditShiftRate,
}: InvoiceDocumentProps) {
  if (!inv) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: 400,
          color: "#a19f9d",
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
        }}
      >
        Select an invoice from the list
      </div>
    );
  }
  return (
    <PaperFrame paperEffect={paperEffect} scale={scale}>
      {template === "classic" && <ClassicInvoice inv={inv} accent={accent} />}
      {template === "minimal" && <MinimalInvoice inv={inv} accent={accent} />}
      {template === "modern" && (
        <ModernInvoice inv={inv} accent={accent} onEditShiftRate={onEditShiftRate} />
      )}
    </PaperFrame>
  );
}
