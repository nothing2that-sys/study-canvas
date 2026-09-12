//+_+// Phase F13-R3 기존 콘텐츠를 자동 학년 승인하지 않는 문제집 카탈로그

import { normalizeWorkbookDefinition, normalizeWorkbookEdition } from "./workbookEngine.js";

const rawCatalog = [
  {
    definition: {
      workbookId: "legacy-math-arithmetic",
      type: "FIXED",
      subjectId: "math",
      courseId: "arithmetic",
      title: "수학 연산 문제집",
      description: "곱셈과 나눗셈 단계를 직접 선택해 풀어요.",
      gradeLevel: null,
      semester: "ALL",
      status: "ACTIVE",
      legacyUnclassified: true
    },
    edition: {
      workbookId: "legacy-math-arithmetic",
      editionVersion: 1,
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-arithmetic-contents", pageNumber: 1, unitId: "arithmetic", title: "연산 단계 선택", launchTarget: "/math/arithmetic" }
      ]
    }
  },
  {
    definition: {
      workbookId: "legacy-math-measurement",
      type: "FIXED",
      subjectId: "math",
      courseId: "measurement",
      title: "수학 단위 변환 문제집",
      description: "길이, 무게와 들이 단위를 연습해요.",
      gradeLevel: null,
      semester: "ALL",
      status: "ACTIVE",
      legacyUnclassified: true
    },
    edition: {
      workbookId: "legacy-math-measurement",
      editionVersion: 1,
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-measurement-contents", pageNumber: 1, unitId: "measurement", title: "단위 변환 차례", launchTarget: "/math/measurement" }
      ]
    }
  },
  {
    definition: {
      workbookId: "legacy-korean-core",
      type: "FIXED",
      subjectId: "korean",
      courseId: "korean-core",
      title: "국어 핵심 문제집",
      description: "어휘, 맞춤법, 띄어쓰기와 문장을 연습해요.",
      gradeLevel: null,
      semester: "ALL",
      status: "ACTIVE",
      legacyUnclassified: true
    },
    edition: {
      workbookId: "legacy-korean-core",
      editionVersion: 1,
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "korean-core-contents", pageNumber: 1, unitId: "korean-core", title: "국어 핵심 차례", launchTarget: "/korean/core" }
      ]
    }
  },
  {
    definition: {
      workbookId: "legacy-english-core",
      type: "FIXED",
      subjectId: "english",
      courseId: "english-core",
      title: "영어 핵심 문제집",
      description: "어휘, 단어형, 표현과 문장을 연습해요.",
      gradeLevel: null,
      semester: "ALL",
      status: "ACTIVE",
      legacyUnclassified: true
    },
    edition: {
      workbookId: "legacy-english-core",
      editionVersion: 1,
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "english-core-contents", pageNumber: 1, unitId: "english-core", title: "영어 핵심 차례", launchTarget: "/english/core" }
      ]
    }
  }
];

const catalog = rawCatalog.map((item) => ({
  definition: normalizeWorkbookDefinition(item.definition),
  edition: normalizeWorkbookEdition(item.edition)
}));

export function getWorkbookCatalog() {
  return catalog.slice();
}

export function getWorkbookCatalogItem(workbookId) {
  return catalog.find((item) => item.definition.workbookId === String(workbookId || "")) || null;
}
