//+_+// Phase F13-R3 기존 콘텐츠를 자동 학년 승인하지 않는 문제집 카탈로그

import { normalizeWorkbookDefinition, normalizeWorkbookEdition } from "./workbookEngine.js";
import { isReleaseSubjectAllowed } from "./publicReleasePolicy.js";

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
  },
  {
    definition: {
      workbookId: "math-fraction-g3",
      type: "FIXED",
      subjectId: "math",
      courseId: "fraction",
      title: "3학년 분수 개념: 분수의 이해와 크기 비교",
      description: "부분과 전체, 단위분수, 분수의 기호와 수직선 표현을 익혀요.",
      gradeLevel: 3,
      semester: "ALL",
      difficulty: "FOUNDATION",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["4수01-09", "4수01-11"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-fraction-g3",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-fraction-concepts-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-fraction-g3-p1", pageNumber: 1, unitId: "concepts", title: "부분과 전체", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_part_whole_bar_001" }, { activityId: "frac_part_whole_grid_002" }] },
        { pageId: "math-fraction-g3-p2", pageNumber: 2, unitId: "concepts", title: "분수의 기호와 읽기", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_symbolic_parts_001" }, { activityId: "frac_symbolic_reading_002" }] },
        { pageId: "math-fraction-g3-p3", pageNumber: 3, unitId: "number_line", title: "수직선과 분수의 크기", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_number_line_pos_001" }, { activityId: "frac_number_line_compare_002" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "math-fraction-g4",
      type: "FIXED",
      subjectId: "math",
      courseId: "fraction",
      title: "4학년 분수 개념: 진분수, 가분수, 대분수",
      description: "진분수, 가분수, 대분수의 의미와 상호 변환 관계를 배워요.",
      gradeLevel: 4,
      semester: "ALL",
      difficulty: "FOUNDATION",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["4수01-10"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-fraction-g4",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-fraction-concepts-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-fraction-g4-p1", pageNumber: 1, unitId: "fraction_types", title: "진분수와 가분수", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_types_identify_001" }] },
        { pageId: "math-fraction-g4-p2", pageNumber: 2, unitId: "fraction_types", title: "대분수와 가분수의 관계", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_mixed_to_improper_002" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "math-fraction-g5",
      type: "FIXED",
      subjectId: "math",
      courseId: "fraction",
      title: "5학년 분수 개념: 크기가 같은 분수와 동치 표현",
      description: "그림 모델과 수직선으로 크기가 같은 분수를 직관적으로 이해해요.",
      gradeLevel: 5,
      semester: "ALL",
      difficulty: "STANDARD",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["6수01-06"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-fraction-g5",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-fraction-concepts-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-fraction-g5-p1", pageNumber: 1, unitId: "equivalent", title: "막대로 크기가 같은 분수 찾기", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_equiv_pair_choice_001" }] },
        { pageId: "math-fraction-g5-p2", pageNumber: 2, unitId: "equivalent", title: "수직선에서 크기가 같은 분수 찾기", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_equiv_text_002" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "math-fractionops-g4",
      type: "FIXED",
      subjectId: "math",
      courseId: "fraction",
      title: "4학년 분수 연산: 동분모 덧셈과 뺄셈",
      description: "분모가 같은 진분수와 대분수의 덧셈과 뺄셈을 연습해요.",
      gradeLevel: 4,
      semester: "ALL",
      difficulty: "FOUNDATION",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["4수01-12"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-fractionops-g4",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-fraction-operations-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-fractionops-g4-p1", pageNumber: 1, unitId: "same_denominator", title: "동분모 분수의 덧셈", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_op_same_add_001" }, { activityId: "frac_op_same_add_text_002" }] },
        { pageId: "math-fractionops-g4-p2", pageNumber: 2, unitId: "same_denominator", title: "동분모 분수의 뺄셈", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_op_same_sub_001" }, { activityId: "frac_op_same_sub_text_002" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "math-fractionops-g5",
      type: "FIXED",
      subjectId: "math",
      courseId: "fraction",
      title: "5학년 분수 연산: 이분모 통분과 덧셈·뺄셈",
      description: "공통분모로 통분하여 분모가 다른 분수의 덧셈과 뺄셈을 연습해요.",
      gradeLevel: 5,
      semester: "ALL",
      difficulty: "STANDARD",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["6수01-04", "6수01-05"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-fractionops-g5",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-fraction-operations-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-fraction-ops-g5-p1", pageNumber: 1, unitId: "unlike_denominator", title: "이분모 분수의 통분", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_op_common_denom_001" }] },
        { pageId: "math-fraction-ops-g5-p2", pageNumber: 2, unitId: "unlike_denominator", title: "이분모 분수의 덧셈과 뺄셈", launchTarget: "/math/fraction", activityRefs: [{ activityId: "frac_op_unlike_add_text_001" }, { activityId: "frac_op_unlike_sub_text_001" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "math-decimal-g3",
      type: "FIXED",
      subjectId: "math",
      courseId: "decimal",
      title: "3학년 소수 개념: 소수의 이해와 자릿값",
      description: "0.1 단위 소수, 0.01 단위 소수와 자릿값의 기초를 배워요.",
      gradeLevel: 3,
      semester: "ALL",
      difficulty: "FOUNDATION",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["4수01-12", "4수01-13"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-decimal-g3",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-decimal-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-decimal-g3-p1", pageNumber: 1, unitId: "concepts", title: "0.1 단위의 소수", launchTarget: "/math/decimal", activityRefs: [{ activityId: "dec_tenths_bar_001" }, { activityId: "dec_tenths_text_002" }] },
        { pageId: "math-decimal-g3-p2", pageNumber: 2, unitId: "concepts", title: "0.01 단위 소수와 자릿값", launchTarget: "/math/decimal", activityRefs: [{ activityId: "dec_hundredths_grid_001" }, { activityId: "dec_place_value_text_001" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "math-decimal-g4",
      type: "FIXED",
      subjectId: "math",
      courseId: "decimal",
      title: "4학년 소수 연산: 크기 비교와 덧셈·뺄셈",
      description: "소수의 크기를 비교하고 자리맞춤 덧셈과 뺄셈을 연습해요.",
      gradeLevel: 4,
      semester: "ALL",
      difficulty: "STANDARD",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["4수01-14", "4수01-16"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-decimal-g4",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-decimal-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-decimal-g4-p1", pageNumber: 1, unitId: "compare", title: "소수의 크기 비교", launchTarget: "/math/decimal", activityRefs: [{ activityId: "dec_compare_choice_001" }] },
        { pageId: "math-decimal-g4-p2", pageNumber: 2, unitId: "operations", title: "소수의 덧셈과 뺄셈", launchTarget: "/math/decimal", activityRefs: [{ activityId: "dec_add_text_001" }, { activityId: "dec_sub_text_001" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "math-decimal-g5",
      type: "FIXED",
      subjectId: "math",
      courseId: "decimal",
      title: "5~6학년 소수 연산: 소수 곱셈과 나눗셈",
      description: "소수점 이동을 이해하고 소수의 곱셈과 나눗셈을 연습해요.",
      gradeLevel: 5,
      semester: "ALL",
      difficulty: "STANDARD",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["6수01-13", "6수01-15"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "math-decimal-g5",
      editionVersion: 2,
      contentPackageRefs: [{ packageId: "math-decimal-v1", packageVersion: "1.0.1" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "math-decimal-g5-p1", pageNumber: 1, unitId: "operations", title: "소수의 곱셈", launchTarget: "/math/decimal", activityRefs: [{ activityId: "dec_mul_text_001" }] },
        { pageId: "math-decimal-g5-p2", pageNumber: 2, unitId: "operations", title: "소수의 나눗셈", launchTarget: "/math/decimal", activityRefs: [{ activityId: "dec_div_text_001" }] }
      ]
    }
  },
  {
    definition: {
      workbookId: "english-vocabulary-review-g3",
      type: "REVIEW",
      subjectId: "english",
      courseId: "english-core",
      title: "3학년 영단어 복습장",
      description: "학교, 가족과 일상 단어를 예정일에 맞춰 반복해요.",
      gradeLevel: 3,
      semester: "ALL",
      difficulty: "FOUNDATION",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["PROJECT-EN-G3-VOCAB"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "english-vocabulary-review-g3",
      editionVersion: 1,
      contentPackageRefs: [{ packageId: "english-vocabulary-v1", packageVersion: "1.0.0" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "english-vocab-g3-school", pageNumber: 1, unitId: "school", title: "학교", launchTarget: "/english/core" },
        { pageId: "english-vocab-g3-family", pageNumber: 2, unitId: "family", title: "가족", launchTarget: "/english/core" },
        { pageId: "english-vocab-g3-daily", pageNumber: 3, unitId: "daily", title: "일상", launchTarget: "/english/core" }
      ]
    }
  },
  {
    definition: {
      workbookId: "english-vocabulary-review-g4",
      type: "REVIEW",
      subjectId: "english",
      courseId: "english-core",
      title: "4학년 영단어 복습장",
      description: "날씨, 음식과 장소 단어를 예정일에 맞춰 반복해요.",
      gradeLevel: 4,
      semester: "ALL",
      difficulty: "FOUNDATION",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["PROJECT-EN-G4-VOCAB"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "english-vocabulary-review-g4",
      editionVersion: 1,
      contentPackageRefs: [{ packageId: "english-vocabulary-v1", packageVersion: "1.0.0" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "english-vocab-g4-weather", pageNumber: 1, unitId: "weather", title: "날씨", launchTarget: "/english/core" },
        { pageId: "english-vocab-g4-food", pageNumber: 2, unitId: "food", title: "음식", launchTarget: "/english/core" },
        { pageId: "english-vocab-g4-places", pageNumber: 3, unitId: "places", title: "장소", launchTarget: "/english/core" }
      ]
    }
  },
  {
    definition: {
      workbookId: "english-vocabulary-review-g5",
      type: "REVIEW",
      subjectId: "english",
      courseId: "english-core",
      title: "5학년 영단어 복습장",
      description: "취미, 건강과 자연 단어를 예정일에 맞춰 반복해요.",
      gradeLevel: 5,
      semester: "ALL",
      difficulty: "STANDARD",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["PROJECT-EN-G5-VOCAB"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "english-vocabulary-review-g5",
      editionVersion: 1,
      contentPackageRefs: [{ packageId: "english-vocabulary-v1", packageVersion: "1.0.0" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "english-vocab-g5-hobbies", pageNumber: 1, unitId: "hobbies", title: "취미", launchTarget: "/english/core" },
        { pageId: "english-vocab-g5-health", pageNumber: 2, unitId: "health", title: "건강", launchTarget: "/english/core" },
        { pageId: "english-vocab-g5-nature", pageNumber: 3, unitId: "nature", title: "자연", launchTarget: "/english/core" }
      ]
    }
  },
  {
    definition: {
      workbookId: "english-vocabulary-review-g6",
      type: "REVIEW",
      subjectId: "english",
      courseId: "english-core",
      title: "6학년 영단어 복습장",
      description: "기술, 환경과 사회 단어를 예정일에 맞춰 반복해요.",
      gradeLevel: 6,
      semester: "ALL",
      difficulty: "STANDARD",
      status: "ACTIVE",
      curriculumVersion: "2022-revised",
      achievementStandardIds: ["PROJECT-EN-G6-VOCAB"],
      reviewStatus: "APPROVED"
    },
    edition: {
      workbookId: "english-vocabulary-review-g6",
      editionVersion: 1,
      contentPackageRefs: [{ packageId: "english-vocabulary-v1", packageVersion: "1.0.0" }],
      reviewStatus: "APPROVED",
      pages: [
        { pageId: "english-vocab-g6-technology", pageNumber: 1, unitId: "technology", title: "기술", launchTarget: "/english/core" },
        { pageId: "english-vocab-g6-environment", pageNumber: 2, unitId: "environment", title: "환경", launchTarget: "/english/core" },
        { pageId: "english-vocab-g6-society", pageNumber: 3, unitId: "society", title: "사회", launchTarget: "/english/core" }
      ]
    }
  }
];

const catalog = rawCatalog.map((item) => ({
  definition: normalizeWorkbookDefinition(item.definition),
  edition: normalizeWorkbookEdition(item.edition)
}));

export function getWorkbookCatalog() {
  return catalog.filter(item => isReleaseSubjectAllowed(item.definition.subjectId));
}

export function getWorkbookCatalogItem(workbookId) {
  return catalog.find((item) => item.definition.workbookId === String(workbookId || "") && isReleaseSubjectAllowed(item.definition.subjectId)) || null;
}
