//+_+// F16D uses F15 symbolic rendering without its single-unit operation bars for mixed/unlike operations.
import { renderFractionRepresentation } from "./fractionRepresentationView.js";
export function renderMathF16dRepresentation(activity) {
  const m = activity?.metadata?.math;
  if (m?.representationType === "ARRAY") {
    const [rows, cols] = m.operands;
    return `<div role="img" aria-label="${rows}줄에 각각 ${cols}개" style="line-height:1.4;">${Array.from({ length: rows }, () => `<div>${"● ".repeat(cols)}</div>`).join("")}</div>`;
  }
  if (!m || !m.generatorId.startsWith("f16d_fraction_operation_")) return "";
  const { f1, f2 } = m.parameters;
  const symbol = m.operation.endsWith("add") ? "+" : "−";
  return `<div class="math-f16d-symbolic" role="group" aria-label="분수 연산식">${renderFractionRepresentation({ type: "SYMBOLIC_FRACTION", ...f1 })} ${symbol} ${renderFractionRepresentation({ type: "SYMBOLIC_FRACTION", ...f2 })}</div>`;
}
