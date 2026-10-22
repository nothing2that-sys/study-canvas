//+_+// F16D spec is project-owned; grade-band evidence is not placement or publication approval.
export const MATH_GENERATOR_VERSION = "1.3.1";
export const MIXED_OPERATION_WHOLE_MAX = 19;
export const MATH_SOURCE = Object.freeze({ notice: "2022-33", annex: 8,
  url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&boardSeq=93458&lev=0",
  sha256: "aab8eed59ecf244223d04afad75f4cf5ac5085fadcfc3cf52c2f6d54ddfc7856" });
export const UNIT_PAIRS = Object.freeze([
  { id: "m_cm", dimension: "length", big: "m", small: "cm", ratio: 100, standard: "2수03-11" },
  { id: "cm_mm", dimension: "length", big: "cm", small: "mm", ratio: 10, standard: "4수03-16" },
  { id: "km_m", dimension: "length", big: "km", small: "m", ratio: 1000, standard: "4수03-16" },
  { id: "L_mL", dimension: "capacity", big: "L", small: "mL", ratio: 1000, standard: "4수03-18" },
  { id: "kg_g", dimension: "mass", big: "kg", small: "g", ratio: 1000, standard: "4수03-21" }
]);
const rows = [
  ["multiplication", "multiply", "곱셈", ["4수01-04"]],
  ["multiplication", "missing_factor", "빈 곱하는 수", ["4수01-04", "4수01-05"]],
  ["multiplication", "missing_left", "빈 곱해지는 수", ["4수01-04", "4수01-05"]],
  ["multiplication", "inverse", "곱셈과 나눗셈 관계", ["4수01-05"]],
  ["multiplication", "equation", "곱셈식 완성", ["4수01-04"]],
  ["multiplication", "verify", "곱셈 검산 선택", ["4수01-04", "4수01-05"]],
  ["multiplication", "estimate", "곱셈 어림", ["4수01-08"]],
  ["multiplication", "compare_products", "두 곱의 크기 비교", ["4수01-04"]],
  ["division", "exact", "나누어떨어지는 나눗셈", ["4수01-06", "4수01-07"]],
  ["division", "remainder", "몫과 나머지", ["4수01-06", "4수01-07"]],
  ["division", "missing_dividend", "빈 나누어지는 수", ["4수01-05", "4수01-06"]],
  ["division", "missing_divisor", "빈 나누는 수", ["4수01-05", "4수01-07"]],
  ["division", "missing_quotient", "빈 몫", ["4수01-06", "4수01-07"]],
  ["division", "verify", "나눗셈 검산", ["4수01-05", "4수01-06"]],
  ["division", "estimate", "몫의 범위 선택", ["4수01-08"]],
  ...["convert", "composite", "mixed_write", "compare", "unit_choice", "unit_error", "context", "multistep"].map((task, i) =>
    ["measurement", task, ["단위 변환", "복합 단위 읽기", "혼합 단위 쓰기", "측정값 비교", "알맞은 단위", "잘못된 단위", "생활 속 측정", "측정 두 단계"][i], []]),
  ...["identify", "compare", "order", "to_mixed", "to_improper", "equivalent", "reduce", "common"].map((task, i) =>
    ["fraction_concept", task, ["그림과 분수", "분수 비교", "분수 순서", "가분수를 대분수로", "대분수를 가분수로", "동치 분수", "약분", "통분"][i],
      task === "identify" ? ["4수01-09"] : task.startsWith("to_") ? ["4수01-10"] : ["6수01-06", "6수01-07"]]),
  ...["same_add", "same_sub", "unlike_add", "unlike_sub", "mixed_add", "mixed_sub"].map((task, i) =>
    ["fraction_operation", task, ["동분모 덧셈", "동분모 뺄셈", "이분모 덧셈", "이분모 뺄셈", "대분수 덧셈", "대분수 뺄셈"][i],
      task.startsWith("same") ? ["4수01-15"] : ["6수01-08"]]),
  ...["read", "write", "place", "compare", "order", "zero", "fraction", "add", "sub", "mul", "div", "measurement"].map((task, i) =>
    ["decimal", task, ["소수 읽기", "소수 쓰기", "소수 자릿값", "소수 비교", "소수 순서", "끝자리 0", "소수와 분수", "소수 덧셈", "소수 뺄셈", "소수 곱셈", "소수 나눗셈", "소수와 측정"][i],
      ["add", "sub"].includes(task) ? ["4수01-16"] : task === "mul" ? ["6수01-13"] : task === "div" ? ["6수01-15"] : task === "fraction" ? ["6수01-12"] : task === "zero" || task === "compare" || task === "order" ? ["4수01-14"] : ["4수01-13"]])
];
export const MATH_SPECS = Object.freeze(rows.map(([domain, task, title, standards]) => Object.freeze({
  generatorId: `f16d_${domain}_${task}`, version: MATH_GENERATOR_VERSION, domain, task, title,
  subjectId: "math", courseId: domain.startsWith("fraction") ? "fraction" : ["multiplication", "division"].includes(domain) ? "arithmetic" : domain,
  unitId: domain, skillId: `MATH_F16D_${domain}_${task}`.toUpperCase(), achievementStandardIds: standards,
  gradeLevel: null, semester: null, difficulty: null, placementStatus: "PENDING_EXPERT_REVIEW",
  reviewStatus: "AUTO_VALIDATED", publicationStatus: "REVIEW_REQUIRED", autoRecommend: false
})));
export function getMathSpec(id) {
  const spec = MATH_SPECS.find(s => s.generatorId === id);
  if (!spec) throw new Error(`Unknown math generator: ${id}`);
  return spec;
}
export const F19_GATES = Object.freeze([
  { skillId: "geometry", status: "PLANNED_F19", minimum: 20000, stretch: 50000 },
  { skillId: "pattern", status: "PLANNED_F19", minimum: 20000, stretch: 50000 },
  { skillId: "data_graph", status: "PLANNED_F19", minimum: 20000, stretch: 50000 },
  { skillId: "story", status: "PLANNED_F19", minimum: 50000, stretch: 100000 }
]);
