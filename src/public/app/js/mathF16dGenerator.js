//+_+// F16D bounded, replayable mathematical generator; all arithmetic answers use integers/rationals.
import { MATH_GENERATOR_VERSION, MIXED_OPERATION_WHOLE_MAX, getMathSpec, UNIT_PAIRS } from "./mathF16dSpec.js";
import { normalizeLearningActivity } from "./learningActivity.js";
import { gcd, addFractions, subtractFractions, compareFractions, formatFractionText } from "./fractionOperations.js";
import { parseDecimal, formatDecimal, addDecimals, subtractDecimals, multiplyDecimals, divideDecimals } from "./decimalDomain.js";
import { normalizeFractionRepresentationSpec } from "./fractionRepresentationView.js";

export const FRACTION_POOL = Object.freeze(Array.from({ length: 19 }, (_, i) => i + 2)
  .flatMap(d => Array.from({ length: d - 1 }, (_, i) => i + 1).filter(n => gcd(n, d) === 1)
    .map(n => Object.freeze({ numerator: n, denominator: d, wholeNumber: 0 }))));
const SYMBOLS = ["<", "=", ">"];
const REPRESENTATIONS = ["PART_WHOLE_BAR", "PART_WHOLE_GRID", "NUMBER_LINE", "SYMBOLIC_FRACTION", "EQUIVALENT_PAIR"];
const ftext = f => formatFractionText(f);
const rational = f => {
  const n = f.numerator + (f.wholeNumber || 0) * f.denominator;
  const g = gcd(n, f.denominator);
  return [n / g, f.denominator / g];
};
function decimal(unscaledValue, scale) { return formatDecimal({ unscaledValue, scale }); }
function decimalCanonical(s) {
  const d = parseDecimal(s);
  if (!d) throw new Error("Invalid decimal");
  return rational({ numerator: d.unscaledValue, denominator: 10 ** d.scale });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Unordered two-digit factor pairs. No product-value or display permutations enter the count.
export const PRODUCT_COMPARISON_PAIRS = Object.freeze(Array.from({ length: 90 }, (_, i) => i + 10)
  .flatMap(a => Array.from({ length: 100 - a }, (_, i) => Object.freeze([a, a + i]))));
// a<c<=d<=99<b<=999: one two-digit × three-digit product, one two-digit product.
// Disjoint from the original Cartesian segment. Precompute only 89 rank blocks.
export const THREE_DIGIT_COMPARISON_BLOCKS = Object.freeze(Array.from({length:89},(_,i)=> {
  const a=10+i, width=99-a;
  const preceding = Array.from({length:i},(_,j)=>90-j).reduce((sum,w)=>sum+w*(w-1)/2,0);
  return Object.freeze({a,width,start:preceding,count:width*(width+1)/2});
}));
export const THREE_DIGIT_COMPARISON_PER_FACTOR = THREE_DIGIT_COMPARISON_BLOCKS.reduce((sum,b)=>sum+b.count,0);
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function rawSpace(specOrId) {
  const s = typeof specOrId === "string" ? getMathSpec(specOrId) : specOrId;
  if (s.domain === "multiplication") return s.task === "compare_products" ? PRODUCT_COMPARISON_PAIRS.length ** 2 + 900 * THREE_DIGIT_COMPARISON_PER_FACTOR : 998 * 98;
  if (s.domain === "division") return 998 * 98;
  if (s.domain === "measurement") {
    if (["unit_choice", "unit_error"].includes(s.task)) return 5;
    return 5 * 9999 * (s.task === "compare" || s.task === "multistep" ? 99 : 1);
  }
  const size = FRACTION_POOL.length;
  if (s.domain === "fraction_concept") {
    if (s.task === "identify") return size * 5;
    if (["to_mixed", "to_improper"].includes(s.task)) return size * 9;
    if (["equivalent", "reduce"].includes(s.task)) return size * 3;
    return size ** (s.task === "order" ? 3 : 2);
  }
  if (s.domain === "fraction_operation") {
    const n = size * (s.task.startsWith("mixed") ? MIXED_OPERATION_WHOLE_MAX + 1 : 1);
    return n * n;
  }
  if (["add", "sub", "mul", "div", "compare"].includes(s.task)) return 999 * 999;
  if (s.task === "order") return 99 ** 3;
  if (s.task === "place") return 9999 * 3;
  return s.task === "measurement" ? 9999 * 3 : 9999;
}
export function parametersAt(specOrId, index) {
  const s = typeof specOrId === "string" ? getMathSpec(specOrId) : specOrId;
  if (!Number.isSafeInteger(index) || index < 0 || index >= rawSpace(s)) throw new RangeError("Candidate index out of bounds");
  const size = FRACTION_POOL.length;
  if (s.domain === "multiplication" && s.task === "compare_products") {
    const n = PRODUCT_COMPARISON_PAIRS.length;
    if (index >= n*n) {
      const extended=index-n*n, b=100+Math.floor(extended/THREE_DIGIT_COMPARISON_PER_FACTOR);
      let rank=extended%THREE_DIGIT_COMPARISON_PER_FACTOR;
      const block=THREE_DIGIT_COMPARISON_BLOCKS.find(x=>rank>=x.start && rank<x.start+x.count);
      rank-=block.start;
      let c=block.a+1;
      while (rank>=100-c) { rank-=100-c; c++; }
      return {a:block.a,b,c,d:c+rank};
    }
    const [a, b] = PRODUCT_COMPARISON_PAIRS[Math.floor(index / n)];
    const [c, d] = PRODUCT_COMPARISON_PAIRS[index % n];
    return { a, b, c, d };
  }
  if (["multiplication", "division"].includes(s.domain)) return { a: 2 + Math.floor(index / 98), b: 2 + index % 98 };
  if (s.domain === "measurement") {
    if (["unit_choice", "unit_error"].includes(s.task)) return { pair: index, value: 1, other: 1 };
    const width = 9999 * (["compare", "multistep"].includes(s.task) ? 99 : 1);
    return { pair: Math.floor(index / width), value: 1 + index % 9999, other: 1 + Math.floor(index % width / 9999) };
  }
  if (s.domain.startsWith("fraction")) {
    const mixed = s.domain === "fraction_operation" && s.task.startsWith("mixed");
    const n = size * (mixed ? MIXED_OPERATION_WHOLE_MAX + 1 : 1);
    const at = i => ({ ...FRACTION_POOL[i % size], wholeNumber: Math.floor(i / size) });
    if (s.domain === "fraction_operation") return { f1: at(Math.floor(index / n)), f2: at(index % n) };
    if (s.task === "identify") return { f1: at(Math.floor(index / 5)), representation: REPRESENTATIONS[index % 5], scale: 2 };
    if (["to_mixed", "to_improper"].includes(s.task)) return { f1: { ...at(index % size), wholeNumber: 1 + Math.floor(index / size) } };
    if (["equivalent", "reduce"].includes(s.task)) return { f1: at(Math.floor(index / 3)), scale: 2 + index % 3 };
    if (s.task === "order") return { fractions: [at(Math.floor(index / (size * size))), at(Math.floor(index / size) % size), at(index % size)] };
    return { f1: at(Math.floor(index / size)), f2: at(index % size) };
  }
  if (["add", "sub", "mul", "div", "compare"].includes(s.task)) return { a: 1 + Math.floor(index / 999), b: 1 + index % 999 };
  if (s.task === "order") return { values: [1 + Math.floor(index / (99 * 99)), 1 + Math.floor(index / 99) % 99, 1 + index % 99] };
  if (s.task === "place") return { a: 1 + Math.floor(index / 3), place: 1 + index % 3 };
  if (s.task === "measurement") return { a: 1 + Math.floor(index / 3), pair: [0, 3, 4][index % 3] };
  return { a: index + 1 };
}
function allowedFraction(f, mixed = false, maxWhole = 9) {
  return f && [f.numerator, f.denominator, f.wholeNumber].every(Number.isSafeInteger)
    && f.denominator >= 2 && f.denominator <= 20 && f.numerator >= 1 && f.numerator < f.denominator
    && gcd(f.numerator, f.denominator) === 1 && f.wholeNumber >= 0 && f.wholeNumber <= (mixed ? maxWhole : 0);
}
export function validateParameters(specOrId, p) {
  const s = typeof specOrId === "string" ? getMathSpec(specOrId) : specOrId;
  if (!p || typeof p !== "object") return false;
  const between = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
  if (s.domain === "multiplication" && s.task === "compare_products") {
    // a<c<=d<b removes factor swaps, left/right reversal, identical/shared factors,
    // and componentwise domination that could be answered without calculating either product.
    return [p.a, p.c, p.d].every(x => between(x, 10, 99)) && between(p.b,10,999)
      && p.a < p.c && p.c <= p.d && p.d < p.b;
  }
  if (["multiplication", "division"].includes(s.domain)) {
    if (!between(p.a, 2, 999) || !between(p.b, 2, 99)) return false;
    if (s.domain === "multiplication") return true;
    if (p.a < p.b * 2) return false;
    if (s.task === "exact" || s.task === "missing_divisor" || s.task === "missing_quotient") return p.a % p.b === 0;
    if (s.task === "remainder") return p.a % p.b > 0;
    return true;
  }
  if (s.domain === "measurement") return between(p.pair, 0, 4) && between(p.value, 1, 9999) && between(p.other, 1, 99)
    && (!(["unit_choice", "unit_error"].includes(s.task)) || (p.value === 1 && p.other === 1));
  if (s.domain === "fraction_concept") {
    if (s.task === "order") return p.fractions?.length === 3 && p.fractions.every(f => allowedFraction(f))
      && p.fractions.every((f, i) => i === 0 || compareFractions(p.fractions[i - 1], f) < 0);
    if (!allowedFraction(p.f1, s.task.startsWith("to_"))) return false;
    if (s.task.startsWith("to_")) return p.f1.wholeNumber > 0;
    if (s.task === "identify") return REPRESENTATIONS.includes(p.representation) && p.scale === 2;
    if (["equivalent", "reduce"].includes(s.task)) return between(p.scale, 2, 4);
    return allowedFraction(p.f2) && compareFractions(p.f1, p.f2) < 0;
  }
  if (s.domain === "fraction_operation") {
    const mixed = s.task.startsWith("mixed");
    if (!allowedFraction(p.f1, mixed, MIXED_OPERATION_WHOLE_MAX) || !allowedFraction(p.f2, mixed, MIXED_OPERATION_WHOLE_MAX)) return false;
    if (s.task.startsWith("same") && p.f1.denominator !== p.f2.denominator) return false;
    if (s.task.startsWith("unlike") && p.f1.denominator === p.f2.denominator) return false;
    if (mixed && p.f1.wholeNumber === 0 && p.f2.wholeNumber === 0) return false;
    return s.task.endsWith("add") ? compareFractions(p.f1, p.f2) <= 0 : compareFractions(p.f1, p.f2) >= 0;
  }
  if (s.task === "order") return p.values?.length === 3 && p.values.every(x => between(x, 1, 99)) && p.values[0] < p.values[1] && p.values[1] < p.values[2];
  if (!between(p.a, 1, ["add", "sub", "mul", "div", "compare"].includes(s.task) ? 999 : 9999)) return false;
  if (["add", "sub", "mul", "div", "compare"].includes(s.task)) {
    if (!between(p.b, 1, 999)) return false;
    if (["add", "mul", "compare"].includes(s.task)) return p.a <= p.b;
    if (s.task === "sub") return p.a >= p.b;
    //+_+// Dividend = hundredths quotient × tenths divisor, with at most 3 decimal places.
    return true;
  }
  if (s.task === "place") return between(p.place, 1, 3);
  if (s.task === "measurement") return [0, 3, 4].includes(p.pair);
  return true;
}
const relation = cmp => SYMBOLS[Math.sign(cmp) + 1];
const symChoices = () => SYMBOLS.map(x => ({ id: x, label: x }));
function numberChoices(correct, wrong) {
  const values = [...new Set([String(correct), ...wrong.map(String)])];
  if (values.length < 2) throw new Error("Ambiguous choices");
  return values.map(x => ({ id: x, label: x }));
}
function fractionVisual(p, type = "SYMBOLIC_FRACTION") {
  if (type === "EQUIVALENT_PAIR") return { type, pair1: { type: "PART_WHOLE_BAR", ...p.f1 },
    pair2: { type: "PART_WHOLE_BAR", numerator: p.f1.numerator * 2, denominator: p.f1.denominator * 2, wholeNumber: 0 } };
  if (type === "NUMBER_LINE") return { type, ...p.f1, maxVal: (p.f1.wholeNumber || 0) + 1 };
  if (type === "PART_WHOLE_GRID") {
    const d = p.f1.denominator;
    let rows = Math.floor(Math.sqrt(d));
    while (d % rows !== 0) rows--;
    return { type, ...p.f1, rows, cols: d / rows };
  }
  return { type, ...p.f1 };
}
function koreanDecimal(s) {
  const [whole, frac = ""] = s.split(".");
  const digits = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  // Concept operands stay below 10; boundary distractors must stay in that range too.
  if (!/^\d$/.test(whole) || !/^\d*$/.test(frac)) throw new Error("Invalid decimal reading range");
  return frac ? `${digits[Number(whole)]} 점 ${frac.split("").map(x => digits[Number(x)]).join(" ")}` : digits[Number(whole)];
}
//+_+// Derivation returns the response task and its exact answer; presentation is reconstructed on validation.
function derive(s, p) {
  let prompt, answer, choices = null, representation = "SYMBOLIC", visual = null, context = "none", operands, operation = s.task;
  const feature = { family: s.task };
  if (s.domain === "multiplication" && s.task === "compare_products") {
    const { a, b, c, d } = p;
    operands = [[a, b], [c, d]];
    prompt = `${a} × ${b} □ ${c} × ${d}. 두 곱을 계산하여 알맞은 부호를 고르세요.`;
    answer = relation(a * b - c * d); choices = symChoices();
    Object.assign(feature, { digits: [2, String(b).length, 2, 2], comparison: answer, independentlyCalculatedProducts: 2 });
  } else if (s.domain === "multiplication") {
    const { a, b } = p; const product = a * b;
    operands = [a, b]; feature.digits = [String(a).length, String(b).length].sort(); feature.zero = `${a}${b}`.includes("0");
    const carry = (x, y) => String(y).split("").reduce((sum, digit) => {
      let c = 0; let hits = 0;
      for (const n of String(x).split("").reverse()) { const v = Number(n) * Number(digit) + c; c = Math.floor(v / 10); if (c) hits++; }
      return sum + hits;
    }, 0);
    feature.carry = carry(a, b) + carry(b, a); feature.partialProducts = Math.min(String(a).length, String(b).length);
    if (s.task === "multiply") { prompt = `${a} × ${b} = ?`; answer = String(product); }
    if (s.task === "missing_factor") { prompt = `${a} × □ = ${product}. □에 알맞은 수는?`; answer = String(b); }
    if (s.task === "missing_left") { prompt = `□ × ${b} = ${product}. □에 알맞은 수는?`; answer = String(a); }
    if (s.task === "inverse") { prompt = `${a} × ${b} = ${product}입니다. ${product} ÷ ${b} = ?`; answer = String(a); }
    if (s.task === "equation") { prompt = `${a} × ${b} = □. 식을 완성하세요.`; answer = String(product); }
    if (s.task === "verify") { prompt = `${a} × ${b} = ${product}를 검산하는 올바른 식은?`; answer = `${product} ÷ ${b} = ${a}`; choices = numberChoices(answer, [`${product} ÷ ${b} = ${a + 1}`, `${product + 1} ÷ ${b} = ${a}`]); }
    if (s.task === "estimate") { const x = Math.round(a / 10) * 10; const y = Math.round(b / 10) * 10;
      prompt = `${a}와 ${b}를 각각 십의 자리까지 반올림하여 곱을 어림하세요.`; answer = String(x * y); }
    if (["multiply", "equation", "estimate"].includes(s.task)) operands.sort((a, b) => a - b);
    if (s.task === "multiply" && a <= 9 && b <= 9) representation = "ARRAY";
  } else if (s.domain === "division") {
    const { a, b } = p; const q = Math.floor(a / b); const r = a % b;
    operands = [a, b]; Object.assign(feature, { remainder: r === 0 ? "exact" : r * 2 < b ? "small" : "large", dividendDigits: String(a).length,
      divisorDigits: String(b).length, quotientDigits: String(q).length, trailingZero: a % 10 === 0 || b % 10 === 0 });
    if (s.task === "exact" || s.task === "missing_quotient") { prompt = `${a} ÷ ${b} = □. 몫을 쓰세요.`; answer = String(q); }
    if (s.task === "remainder") { prompt = `${a} ÷ ${b}의 몫과 나머지를 '몫, 나머지' 순서로 쓰세요.`; answer = `${q}, ${r}`; }
    if (s.task === "missing_dividend") { prompt = `□ ÷ ${b}의 몫은 ${q}, 나머지는 ${r}입니다. □는?`; answer = String(a); }
    if (s.task === "missing_divisor") { prompt = `${a} ÷ □ = ${q}이고 나머지는 0입니다. □는?`; answer = String(b); }
    if (s.task === "verify") { prompt = `${a} ÷ ${b}의 몫 ${q}, 나머지 ${r}를 검산하는 식은?`; answer = `${b} × ${q} + ${r} = ${a}`;
      choices = numberChoices(answer, [`${b} × ${q + 1} + ${r} = ${a}`, `${b} × ${q} + ${r + 1} = ${a}`]); }
    if (s.task === "estimate") { const low = Math.floor(q / 10) * 10; prompt = `${a} ÷ ${b}의 몫이 들어가는 범위는?`;
      answer = `${low} 이상 ${low + 10} 미만`; choices = numberChoices(answer, [`${low + 10} 이상 ${low + 20} 미만`, `${low + 20} 이상 ${low + 30} 미만`]); }
  } else if (s.domain === "measurement") {
    const u = UNIT_PAIRS[p.pair]; const whole = Math.floor(p.value / u.ratio), rest = p.value % u.ratio;
    operands = [u.id, p.value]; Object.assign(feature, { dimension: u.dimension, sourceUnit: ["mixed_write", "compare"].includes(s.task) ? u.small : u.big,
      targetUnit: ["mixed_write", "compare"].includes(s.task) ? u.big : u.small, conversionDirection: s.task === "mixed_write" ? "to_mixed" : "to_smaller", mixed: rest > 0 });
    const contextNoun = { length: "리본", capacity: "물", mass: "쌀" }[u.dimension];
    if (s.task === "convert") { prompt = `${p.value} ${u.big} = □ ${u.small}`; answer = String(p.value * u.ratio); }
    if (s.task === "composite") { prompt = `${whole} ${u.big} ${rest} ${u.small} = □ ${u.small}`; answer = String(p.value); representation = "MIXED_UNIT"; }
    if (s.task === "mixed_write") { prompt = `${p.value} ${u.small}를 '${u.big}, ${u.small}' 순서의 두 수로 쓰세요.`; answer = `${whole}, ${rest}`; representation = "MIXED_UNIT"; }
    if (s.task === "compare") { prompt = `${p.value} ${u.small} □ ${p.other} ${u.big}. 알맞은 부호는?`; answer = relation(p.value - p.other * u.ratio); choices = symChoices(); operands.push(p.other); }
    if (s.task === "unit_choice" || s.task === "unit_error") {
      const scenario = ["교실 문 높이 약 2", "동전 두께 약 2", "도시 사이 거리 약 20", "큰 물병 들이 약 2", "쌀 한 봉지 무게 약 10"][p.pair];
      const correct = ["m", "mm", "km", "L", "kg"][p.pair];
      const wrong = ["kg", "L", "g", "km", "cm"][p.pair];
      context = `unit_sense_${u.id}`;
      if (s.task === "unit_choice") { prompt = `${scenario} 뒤에 올 알맞은 단위는?`; answer = correct; choices = numberChoices(correct, [wrong]); }
      else { prompt = `${scenario}의 단위 사용 중 잘못된 것은?`; answer = wrong; choices = numberChoices(wrong, [correct]); }
    }
    if (s.task === "context") { context = `measurement_read_${u.dimension}`; prompt = `${contextNoun}의 측정값은 ${whole} ${u.big} ${rest} ${u.small}입니다. ${u.small}로 나타내세요.`; answer = String(p.value); }
    if (s.task === "multistep") { context = `measurement_combine_${u.dimension}`; operands.push(p.other);
      prompt = `${contextNoun}의 측정값 ${whole} ${u.big} ${rest} ${u.small}에 ${p.other} ${u.big}만큼 더했습니다. 합은 몇 ${u.small}인가요?`; answer = String(p.value + p.other * u.ratio); feature.steps = 2; }
  } else if (s.domain.startsWith("fraction")) {
    operands = p.fractions ? p.fractions.map(rational) : [rational(p.f1), ...(p.f2 ? [rational(p.f2)] : [])];
    feature.form = p.f1?.wholeNumber || p.f2?.wholeNumber ? "mixed" : "proper";
    if (s.domain === "fraction_operation") {
      const add = s.task.endsWith("add"); const result = add ? addFractions(p.f1, p.f2) : subtractFractions(p.f1, p.f2);
      feature.denominators = p.f1.denominator === p.f2.denominator ? "same" : "unlike";
      feature.regroup = add ? p.f1.numerator * p.f2.denominator + p.f2.numerator * p.f1.denominator >= p.f1.denominator * p.f2.denominator
        : p.f1.numerator * p.f2.denominator < p.f2.numerator * p.f1.denominator;
      const [n,d] = rational(result);
      prompt = `${ftext(p.f1)} ${add ? "+" : "−"} ${ftext(p.f2)}를 기약분수 또는 대분수로 쓰세요.`;
      answer = d === 1 ? String(n) : `${n}/${d}`;
      //+_+// Legacy operation bars omit mixed wholes and unlike subtraction units. Render exact symbolic operands instead.
      representation = "SYMBOLIC_FRACTION";
    } else {
      if (s.task === "identify") { representation = p.representation; visual = fractionVisual(p, representation);
        prompt = representation === "EQUIVALENT_PAIR" ? "두 그림의 양을 나타내는 기약분수를 쓰세요." : "그림 또는 기호가 나타내는 기약분수를 쓰세요."; answer = ftext(p.f1); }
      if (s.task === "compare") { prompt = `${ftext(p.f1)} □ ${ftext(p.f2)}. 부호를 고르세요.`; answer = relation(compareFractions(p.f1, p.f2)); choices = symChoices(); }
      if (s.task === "order") { const shown = [p.fractions[2], p.fractions[0], p.fractions[1]];
        prompt = `${shown.map(ftext).join(", ")}를 작은 순서대로 쉼표로 구분해 쓰세요.`; answer = p.fractions.map(ftext).join(", "); }
      if (s.task === "to_mixed") { const [n, d] = rational(p.f1); prompt = `${n}/${d}를 대분수로 쓰세요.`; answer = ftext(p.f1); visual = { type: "SYMBOLIC_FRACTION", numerator: n, denominator: d, wholeNumber: 0 }; }
      if (s.task === "to_improper") { const [n, d] = rational(p.f1); prompt = `${ftext(p.f1)}를 가분수로 쓰세요.`; answer = `${n}/${d}`; visual = fractionVisual(p); }
      if (s.task === "equivalent") { prompt = `${ftext(p.f1)} = □/${p.f1.denominator * p.scale}. □는?`; answer = String(p.f1.numerator * p.scale); operands.push(p.scale); }
      if (s.task === "reduce") { prompt = `${p.f1.numerator * p.scale}/${p.f1.denominator * p.scale}를 기약분수로 쓰세요.`; answer = ftext(p.f1); operands.push(p.scale); }
      if (s.task === "common") { const d = p.f1.denominator * p.f2.denominator / gcd(p.f1.denominator, p.f2.denominator);
        prompt = `${ftext(p.f1)}, ${ftext(p.f2)}를 최소공통분모로 통분하여 같은 순서로 쓰세요.`;
        answer = `${p.f1.numerator * (d / p.f1.denominator)}/${d}, ${p.f2.numerator * (d / p.f2.denominator)}/${d}`; }
    }
  } else {
    const two = ["add", "sub", "mul", "div", "compare"].includes(s.task);
    let a = decimal(p.a, two ? 2 : 3); let b = two ? decimal(p.b, s.task === "div" ? 1 : 2) : null;
    if (s.task === "div") a = formatDecimal(multiplyDecimals(parseDecimal(a), parseDecimal(b)));
    operands = p.values ? p.values.map(x => decimalCanonical(decimal(x, 2))) : [decimalCanonical(a), ...(b ? [decimalCanonical(b)] : [])];
    feature.decimalPlaces = two ? 2 : 3; feature.integerDigits = a.split(".")[0].length; feature.zero = String(p.a).includes("0");
    if (s.task === "read") { prompt = `${a}를 읽은 것을 고르세요.`; answer = koreanDecimal(a);
      // Move down at the upper boundary instead of leaking 10+ into a single-digit reader.
      const offset = p.a + 10 <= 9999 ? 1 : -1;
      choices = numberChoices(answer, [koreanDecimal(decimal(p.a + offset, 3)), koreanDecimal(decimal(p.a + 10 * offset, 3))]); }
    if (s.task === "write") { prompt = `'${koreanDecimal(a)}'를 소수로 쓰세요.`; answer = a; }
    if (s.task === "place") { const padded = String(p.a).padStart(4, "0"); const digit = Number(padded.slice(-3)[p.place - 1]);
      prompt = `${a}의 소수 ${p.place}째 자리 숫자가 나타내는 값은?`; answer = decimal(digit, p.place); operands.push(p.place); feature.place = p.place; }
    if (s.task === "compare") { prompt = `${a} □ ${b}. 알맞은 부호는?`; answer = relation(p.a - p.b); choices = symChoices(); }
    if (s.task === "order") { const shown = [p.values[2], p.values[0], p.values[1]].map(x => decimal(x, 2));
      prompt = `${shown.join(", ")}를 작은 순서대로 쉼표로 구분해 쓰세요.`; answer = p.values.map(x => decimal(x, 2)).join(", "); }
    if (s.task === "zero") { const extended = a.includes(".") ? `${a}0` : `${a}.0`; prompt = `${a}와 ${extended}의 크기를 비교하세요.`; answer = "="; choices = symChoices(); feature.trailingZero = true; }
    if (s.task === "fraction") { const [n, d] = decimalCanonical(a); prompt = `${a}를 기약분수로 쓰세요.`; answer = `${n}/${d}`; }
    const operations = { add: ["+", addDecimals], sub: ["−", subtractDecimals], mul: ["×", multiplyDecimals], div: ["÷", divideDecimals] };
    if (operations[s.task]) { const [symbol, fn] = operations[s.task]; prompt = `${a} ${symbol} ${b} = ?`; answer = formatDecimal(fn(parseDecimal(a), parseDecimal(b))); }
    if (s.task === "measurement") { const u = UNIT_PAIRS[p.pair]; context = `decimal_measure_${u.id}`; operands.push(u.id);
      prompt = `${a} ${u.big}는 몇 ${u.small}인가요?`; answer = decimal(p.a * u.ratio, 3); feature.dimension = u.dimension; }
    if (["add", "mul"].includes(s.task)) operands.sort((a, b) => a[0] * b[1] - b[0] * a[1]);
  }
  if (!prompt || answer === undefined) throw new Error("Missing derivation");
  return { prompt, expectedAnswer: answer, choices, operation, operands, featureVector: feature, representationType: representation,
    contextSemanticId: context, visual };
}
export function mathFingerprint(candidate, { includeRepresentation = true } = {}) {
  const m = candidate.metadata?.math;
  if (!m || m.version !== MATH_GENERATOR_VERSION) throw new Error("Stale or missing generator version");
  return stableJson({ generatorId: m.generatorId, version: m.version, skillId: candidate.skillId,
    operation: m.operation, operands: m.operands, feature: m.featureVector,
    ...(includeRepresentation ? { representation: m.representationType } : {}), context: m.contextSemanticId });
}
export function mathNearDuplicateKey(candidate) {
  const m = candidate.metadata.math;
  const spec = getMathSpec(m.generatorId);
  // A blank factor's position is a presentation variant; key the known and unknown factors.
  if (spec.domain === "multiplication" && ["missing_factor", "missing_left"].includes(spec.task)) {
    const [a,b] = m.operands;
    return stableJson({domain:spec.domain, operation:"missing_factor", knownFactor:spec.task === "missing_left" ? b : a,
      unknownFactor:spec.task === "missing_left" ? a : b});
  }
  const measurementDimension = spec.domain === "measurement" ? UNIT_PAIRS.find(u => u.id === m.operands[0])?.dimension : null;
  if (spec.domain === "measurement" && ((spec.task === "composite" && m.contextSemanticId === "none")
    || (spec.task === "context" && m.contextSemanticId === `measurement_read_${measurementDimension}`))) {
    return stableJson({domain:spec.domain,operation:"mixed_to_small",operands:m.operands});
  }
  //+_+// Prompt nouns, seed and ID never establish a new mathematical/semantic problem.
  return stableJson({ domain: getMathSpec(m.generatorId).domain, operation: m.operation, operands: m.operands, context: m.contextSemanticId });
}
export function generateMathCandidate(generatorId, index) {
  const spec = getMathSpec(generatorId); const parameters = parametersAt(spec, index);
  if (!validateParameters(spec, parameters)) return null;
  const d = derive(spec, parameters);
  if (d.visual) normalizeFractionRepresentationSpec(d.visual);
  const key = stableJson([spec.generatorId, d.operands, d.representationType]);
  const id = `f16d_${encodeURIComponent(key).replaceAll("%", "_")}`;
  const activity = normalizeLearningActivity({ ...spec, id, version: 1, moduleId: spec.domain,
    activityType: d.choices ? "MULTIPLE_CHOICE" : "SHORT_ANSWER", responseType: d.choices ? "CHOICE" : "TEXT", gradingMode: "GUARDIAN_MANUAL",
    prompt: d.prompt, expectedAnswer: d.expectedAnswer, choices: d.choices,
    explanation: spec.task === "compare_products"
      ? `${parameters.a} × ${parameters.b} = ${parameters.a * parameters.b}, ${parameters.c} × ${parameters.d} = ${parameters.c * parameters.d}이므로 ${d.expectedAnswer}입니다.`
      : "동치 답안의 허용 여부와 최종 판정은 보호자가 확인합니다.", curriculumVersion: "2022-revised",
    achievementStandardIds: spec.domain === "measurement" ? [UNIT_PAIRS[parameters.pair].standard] : spec.achievementStandardIds,
    contentRef: { packageId: "math-f16d-generator", packageVersion: MATH_GENERATOR_VERSION, contentId: id, contentVersion: 1 },
    sourceMetadata: { sourceType: "PROJECT_OWNED", sourceId: generatorId, license: "PROJECT_OWNED", attribution: "Math Canvas Pro", reviewStatus: "AUTO_VALIDATED" },
    metadata: { math: { generatorId, version: MATH_GENERATOR_VERSION, index, parameters, operation: d.operation, operands: d.operands,
      featureVector: d.featureVector, representationType: d.representationType, contextSemanticId: d.contextSemanticId },
      ...(d.visual ? { fractionRepresentation: d.visual } : {}), placementStatus: spec.placementStatus, autoRecommend: false }
  });
  activity.metadata.math.fingerprint = mathFingerprint(activity);
  return activity;
}
export function validateMathCandidate(candidate) {
  try {
    const m = candidate?.metadata?.math;
    if (!m || m.version !== MATH_GENERATOR_VERSION) return { valid: false, reason: "STALE_VERSION" };
    const spec = getMathSpec(m.generatorId);
    const text = [candidate.prompt, candidate.expectedAnswer, candidate.explanation,
      ...(candidate.choices || []).flatMap(c => [c.id,c.label])];
    if (text.some(t => typeof t !== "string" || !t.trim() || /undefined|NaN|\bnull\b/.test(t)))
      return {valid:false,reason:"INVALID_PRESENTATION_TEXT"};
    if (!validateParameters(spec, m.parameters) || !same(parametersAt(spec, m.index), m.parameters)) return { valid: false, reason: "PARAMETERS" };
    // Independently check quotient * divisor == dividend. Do not reuse derive,
    // parseDecimal or divideDecimals: regeneration alone can repeat a math bug.
    if (spec.domain === "decimal" && spec.task === "div") {
      const match = /^(\d+)(?:\.(\d+))?$/.exec(candidate.expectedAnswer);
      const [a, b] = m.operands;
      if (!match || ![...a, ...b].every(Number.isSafeInteger) || a[1] <= 0 || b[0] <= 0 || b[1] <= 0)
        return { valid: false, reason: "DECIMAL_DIVISION_MATH" };
      const numerator = BigInt(match[1] + (match[2] || ""));
      const denominator = 10n ** BigInt((match[2] || "").length);
      if (BigInt(a[0]) * BigInt(b[1]) * denominator !== numerator * BigInt(b[0]) * BigInt(a[1]))
        return { valid: false, reason: "DECIMAL_DIVISION_MATH" };
    }
    const fresh = generateMathCandidate(m.generatorId, m.index);
    if (!same(candidate, fresh)) return { valid: false, reason: "ANSWER_OR_REPRESENTATION_MISMATCH" };
    if (candidate.choices && (new Set(candidate.choices.map(x => x.label)).size !== candidate.choices.length
      || candidate.choices.filter(x => x.id === candidate.expectedAnswer).length !== 1)) return { valid: false, reason: "MULTIPLE_ANSWERS" };
    return { valid: true, reason: null };
  } catch (error) { return { valid: false, reason: error.message }; }
}
export function resolveMathGeneratedActivity(ref, snapshot) {
  if (!snapshot || !same(snapshot.contentRef, ref)) throw new Error("A matching immutable snapshot is required");
  if (ref.packageId !== "math-f16d-generator") throw new Error("Not an F16D reference");
  //+_+// Historical version snapshots are authoritative; never substitute the current generator.
  return structuredClone(snapshot);
}
