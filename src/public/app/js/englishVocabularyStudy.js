//+_+// Phase F14 영단어 Practice와 Check Session 도메인 엔진

import { normalizeLearningActivity } from "./learningActivity.js";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export const VocabularyMemoryStatus = Object.freeze({
  NEW: "NEW",
  LEARNING: "LEARNING",
  REVIEW: "REVIEW",
  MASTERED: "MASTERED"
});

export const VocabularyPracticeMode = Object.freeze({
  STUDY_CARD: "STUDY_CARD",
  MEANING_CHOICE: "MEANING_CHOICE",
  REVERSE_CHOICE: "REVERSE_CHOICE",
  SPELLING_RECALL: "SPELLING_RECALL",
  CONTEXT_APPLICATION: "CONTEXT_APPLICATION"
});

export const VocabularyPracticeRating = Object.freeze({
  AGAIN: "AGAIN",
  HARD: "HARD",
  GOOD: "GOOD",
  EASY: "EASY"
});

const VALID_MEMORY_STATUSES = new Set(Object.values(VocabularyMemoryStatus));
const VALID_PRACTICE_MODES = new Set(Object.values(VocabularyPracticeMode));
const VALID_RATINGS = new Set(Object.values(VocabularyPracticeRating));
const VALID_DIFFICULTIES = new Set(["FOUNDATION", "STANDARD", "ADVANCED"]);

function requiredText(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} 값이 필요합니다.`);
  return normalized;
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(items, seed) {
  const result = items.slice();
  const random = createRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach((child) => deepFreeze(child));
  return Object.freeze(value);
}

export function normalizeVocabularyWord(input = {}) {
  const gradeLevel = Number(input.gradeLevel);
  if (!Number.isInteger(gradeLevel) || gradeLevel < 3 || gradeLevel > 6) throw new Error("gradeLevel은 3부터 6까지여야 합니다.");
  const meanings = Array.isArray(input.meanings) ? input.meanings.map((item) => requiredText(item, "meaning")) : [];
  if (meanings.length === 0) throw new Error("meanings는 한 개 이상이어야 합니다.");
  const difficulty = requiredText(input.difficulty, "difficulty").toUpperCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) throw new Error("difficulty가 유효하지 않습니다.");
  const sourceMetadata = input.sourceMetadata && typeof input.sourceMetadata === "object" ? input.sourceMetadata : {};
  if (sourceMetadata.sourceType !== "PROJECT_OWNED") throw new Error("F14 단어 sourceType은 PROJECT_OWNED여야 합니다.");
  if (sourceMetadata.license !== "PROJECT_OWNED") throw new Error("F14 단어 license는 PROJECT_OWNED여야 합니다.");
  if (sourceMetadata.reviewStatus !== "APPROVED") throw new Error("F14 단어는 사람 검수 후 APPROVED 상태여야 합니다.");

  return deepFreeze({
    wordId: requiredText(input.wordId, "wordId"),
    headword: requiredText(input.headword, "headword"),
    meanings,
    partOfSpeech: requiredText(input.partOfSpeech, "partOfSpeech"),
    exampleSentence: requiredText(input.exampleSentence, "exampleSentence"),
    exampleMeaning: requiredText(input.exampleMeaning, "exampleMeaning"),
    gradeLevel,
    semester: requiredText(input.semester || "ALL", "semester").toUpperCase(),
    topicId: requiredText(input.topicId, "topicId"),
    difficulty,
    curriculumVersion: requiredText(input.curriculumVersion, "curriculumVersion"),
    achievementStandardIds: Array.isArray(input.achievementStandardIds)
      ? input.achievementStandardIds.map((item) => requiredText(item, "achievementStandardId"))
      : [],
    sourceMetadata: {
      sourceType: sourceMetadata.sourceType,
      sourceId: requiredText(sourceMetadata.sourceId, "sourceMetadata.sourceId"),
      license: sourceMetadata.license,
      attribution: requiredText(sourceMetadata.attribution, "sourceMetadata.attribution"),
      retrievedAt: requiredText(sourceMetadata.retrievedAt, "sourceMetadata.retrievedAt"),
      reviewStatus: sourceMetadata.reviewStatus,
      reviewer: requiredText(sourceMetadata.reviewer, "sourceMetadata.reviewer")
    }
  });
}

export function validateVocabularyCatalog(input = {}) {
  if (Number(input.schemaVersion) !== 1) throw new Error("영단어 카탈로그 schemaVersion은 1이어야 합니다.");
  const packageId = requiredText(input.packageId, "packageId");
  const packageVersion = requiredText(input.packageVersion, "packageVersion");
  const rawWords = Array.isArray(input.words) ? input.words : [];
  if (rawWords.length === 0) throw new Error("영단어 카탈로그가 비어 있습니다.");
  const seenIds = new Set();
  const seenGradeHeadwords = new Set();
  const normalizedWords = rawWords.map((raw) => {
    const word = normalizeVocabularyWord(raw);
    if (seenIds.has(word.wordId)) throw new Error(`중복 wordId입니다: ${word.wordId}`);
    const headwordKey = `${word.gradeLevel}:${word.headword.toLowerCase()}`;
    if (seenGradeHeadwords.has(headwordKey)) throw new Error(`같은 학년의 중복 headword입니다: ${word.headword}`);
    seenIds.add(word.wordId);
    seenGradeHeadwords.add(headwordKey);
    return word;
  });
  return { valid: true, packageId, packageVersion, wordCount: normalizedWords.length, words: normalizedWords };
}

export function createVocabularyMemoryState({ learnerId, wordId, now = Date.now() } = {}) {
  const owner = requiredText(learnerId, "learnerId");
  const targetWordId = requiredText(wordId, "wordId");
  return {
    id: `${owner}:${targetWordId}`,
    learnerId: owner,
    wordId: targetWordId,
    memoryStatus: VocabularyMemoryStatus.NEW,
    dueAt: null,
    exposureCount: 0,
    successStreak: 0,
    lastRating: null,
    lastPracticedAt: null,
    createdAt: Number(now) || Date.now(),
    updatedAt: Number(now) || Date.now()
  };
}

export function normalizeVocabularyMemoryState(input = {}) {
  const base = createVocabularyMemoryState(input);
  const memoryStatus = String(input.memoryStatus || VocabularyMemoryStatus.NEW).toUpperCase();
  if (!VALID_MEMORY_STATUSES.has(memoryStatus)) throw new Error(`유효하지 않은 기억 상태입니다: ${input.memoryStatus}`);
  const dueAt = input.dueAt === null || input.dueAt === undefined ? null : Number(input.dueAt);
  if (dueAt !== null && (!Number.isFinite(dueAt) || dueAt < 0)) throw new Error("dueAt이 유효하지 않습니다.");

  const exposureCount = input.exposureCount === null || input.exposureCount === undefined ? 0 : Number(input.exposureCount);
  if (!Number.isInteger(exposureCount) || exposureCount < 0) throw new Error("exposureCount가 유효하지 않습니다.");
  const successStreak = input.successStreak === null || input.successStreak === undefined ? 0 : Number(input.successStreak);
  if (!Number.isInteger(successStreak) || successStreak < 0) throw new Error("successStreak가 유효하지 않습니다.");

  const lastRating = input.lastRating ? String(input.lastRating).toUpperCase() : null;
  if (lastRating !== null && !VALID_RATINGS.has(lastRating)) throw new Error(`lastRating이 유효하지 않습니다: ${input.lastRating}`);
  const lastPracticedAt = input.lastPracticedAt === null || input.lastPracticedAt === undefined ? null : Number(input.lastPracticedAt);
  if (lastPracticedAt !== null && (!Number.isFinite(lastPracticedAt) || lastPracticedAt < 0)) throw new Error("lastPracticedAt이 유효하지 않습니다.");

  const createdAt = input.createdAt === null || input.createdAt === undefined ? base.createdAt : Number(input.createdAt);
  if (!Number.isFinite(createdAt) || createdAt < 0) throw new Error("createdAt이 유효하지 않습니다.");
  const updatedAt = input.updatedAt === null || input.updatedAt === undefined ? base.updatedAt : Number(input.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt < 0) throw new Error("updatedAt이 유효하지 않습니다.");

  return {
    ...base,
    id: `${base.learnerId}:${base.wordId}`,
    memoryStatus,
    dueAt,
    exposureCount,
    successStreak,
    lastRating,
    lastPracticedAt,
    createdAt,
    updatedAt
  };
}

export function applyVocabularyPracticeRating(input, rawRating, { now = Date.now() } = {}) {
  const state = normalizeVocabularyMemoryState(input);
  const rating = String(rawRating || "").toUpperCase();
  if (!VALID_RATINGS.has(rating)) throw new Error(`유효하지 않은 Practice 평가입니다: ${rawRating}`);
  const timestamp = Number(now) || Date.now();
  let memoryStatus = state.memoryStatus;
  let successStreak = state.successStreak;
  let intervalMs;

  if (rating === VocabularyPracticeRating.AGAIN) {
    memoryStatus = VocabularyMemoryStatus.LEARNING;
    successStreak = 0;
    intervalMs = 10 * MINUTE;
  } else if (rating === VocabularyPracticeRating.HARD) {
    memoryStatus = state.memoryStatus === VocabularyMemoryStatus.NEW ? VocabularyMemoryStatus.LEARNING : state.memoryStatus;
    successStreak = Math.max(0, successStreak - 1);
    intervalMs = DAY;
  } else {
    successStreak += rating === VocabularyPracticeRating.EASY ? 2 : 1;
    if (state.memoryStatus === VocabularyMemoryStatus.NEW) {
      memoryStatus = rating === VocabularyPracticeRating.EASY ? VocabularyMemoryStatus.REVIEW : VocabularyMemoryStatus.LEARNING;
    } else if (state.memoryStatus === VocabularyMemoryStatus.LEARNING && successStreak >= 2) {
      memoryStatus = VocabularyMemoryStatus.REVIEW;
    } else if (state.memoryStatus === VocabularyMemoryStatus.REVIEW && successStreak >= 4) {
      memoryStatus = VocabularyMemoryStatus.MASTERED;
    }
    if (memoryStatus === VocabularyMemoryStatus.LEARNING) intervalMs = DAY;
    else if (memoryStatus === VocabularyMemoryStatus.REVIEW) intervalMs = rating === VocabularyPracticeRating.EASY ? 7 * DAY : 3 * DAY;
    else intervalMs = 30 * DAY;
  }

  return normalizeVocabularyMemoryState({
    ...state,
    memoryStatus,
    dueAt: timestamp + intervalMs,
    exposureCount: state.exposureCount + 1,
    successStreak,
    lastRating: rating,
    lastPracticedAt: timestamp,
    updatedAt: timestamp
  });
}

export function isVocabularyReviewDue(state, now = Date.now()) {
  const status = String(state?.memoryStatus || VocabularyMemoryStatus.NEW).toUpperCase();
  if (status === VocabularyMemoryStatus.NEW) return false;
  const dueAt = Number(state?.dueAt);
  return Number.isFinite(dueAt) && dueAt <= Number(now);
}

export function selectVocabularyWords({ words = [], gradeLevel = null, topicId = null } = {}) {
  return words
    .map((word) => normalizeVocabularyWord(word))
    .filter((word) => gradeLevel === null || gradeLevel === undefined || word.gradeLevel === Number(gradeLevel))
    .filter((word) => !topicId || topicId === "ALL" || word.topicId === String(topicId))
    .sort((left, right) => left.gradeLevel - right.gradeLevel || left.topicId.localeCompare(right.topicId) || left.wordId.localeCompare(right.wordId));
}

export function buildVocabularyPracticeQueue({ words = [], memoryStates = [], learnerId, now = Date.now(), limit = 12 } = {}) {
  const owner = requiredText(learnerId, "learnerId");
  const stateMap = new Map(memoryStates
    .filter((state) => state?.learnerId === owner)
    .map((state) => [state.wordId, normalizeVocabularyMemoryState(state)]));
  const candidates = words.map((word) => {
    const normalizedWord = normalizeVocabularyWord(word);
    const state = stateMap.get(normalizedWord.wordId) || createVocabularyMemoryState({ learnerId: owner, wordId: normalizedWord.wordId, now });
    return { word: normalizedWord, state };
  });
  const due = candidates
    .filter((item) => isVocabularyReviewDue(item.state, now))
    .sort((left, right) => left.state.dueAt - right.state.dueAt || left.word.wordId.localeCompare(right.word.wordId));
  const fresh = candidates
    .filter((item) => item.state.memoryStatus === VocabularyMemoryStatus.NEW)
    .sort((left, right) => left.word.wordId.localeCompare(right.word.wordId));
  return [...due, ...fresh].slice(0, Math.max(1, Number(limit) || 12));
}

export function resolveVocabularyPracticeMode(state) {
  const normalized = normalizeVocabularyMemoryState(state);
  if (normalized.memoryStatus === VocabularyMemoryStatus.NEW && normalized.exposureCount === 0) return VocabularyPracticeMode.STUDY_CARD;
  const modes = [
    VocabularyPracticeMode.MEANING_CHOICE,
    VocabularyPracticeMode.REVERSE_CHOICE,
    VocabularyPracticeMode.SPELLING_RECALL,
    VocabularyPracticeMode.CONTEXT_APPLICATION
  ];
  return modes[Math.max(0, normalized.exposureCount - 1) % modes.length];
}

function buildChoiceOptions(word, allWords, labelSelector, seedSuffix) {
  const normalizedPool = selectVocabularyWords({ words: allWords });
  const targetLabel = labelSelector(word);
  const candidates = normalizedPool
    .filter((item) => item.wordId !== word.wordId)
    .map((item) => ({ id: item.wordId, label: labelSelector(item) }))
    .filter((item, index, list) => item.label !== targetLabel && list.findIndex((other) => other.label === item.label) === index)
    .sort((left, right) => hashText(`${word.wordId}:${seedSuffix}:${left.id}`) - hashText(`${word.wordId}:${seedSuffix}:${right.id}`))
    .slice(0, 3);
  if (candidates.length < 3) throw new Error(`선택지 생성을 위한 단어가 부족합니다: ${word.wordId}`);
  return deterministicShuffle([{ id: word.wordId, label: targetLabel }, ...candidates], hashText(`${word.wordId}:${seedSuffix}`));
}

export function createVocabularyPracticePrompt(inputWord, rawMode, { words = [] } = {}) {
  const word = normalizeVocabularyWord(inputWord);
  const mode = String(rawMode || "").toUpperCase();
  if (!VALID_PRACTICE_MODES.has(mode)) throw new Error(`유효하지 않은 Practice mode입니다: ${rawMode}`);
  const base = { wordId: word.wordId, mode, headword: word.headword, expectedAnswer: null, choices: null };

  if (mode === VocabularyPracticeMode.STUDY_CARD) {
    return { ...base, responseType: "NONE", prompt: word.headword, answerLabel: word.meanings.join(", "), exampleSentence: word.exampleSentence, exampleMeaning: word.exampleMeaning };
  }
  if (mode === VocabularyPracticeMode.SPELLING_RECALL) {
    return { ...base, responseType: "TEXT", prompt: `다음 뜻에 맞는 영어 단어를 쓰세요: ${word.meanings[0]}`, expectedAnswer: word.headword, answerLabel: word.headword, exampleSentence: word.exampleSentence };
  }
  const reverse = mode === VocabularyPracticeMode.REVERSE_CHOICE;
  const usesHeadwordChoices = reverse || mode === VocabularyPracticeMode.CONTEXT_APPLICATION;
  const choices = buildChoiceOptions(word, words, usesHeadwordChoices ? (item) => item.headword : (item) => item.meanings[0], mode);
  const prompt = mode === VocabularyPracticeMode.MEANING_CHOICE
    ? `${word.headword}의 뜻을 고르세요.`
    : mode === VocabularyPracticeMode.REVERSE_CHOICE
      ? `다음 뜻에 맞는 영어 단어를 고르세요: ${word.meanings[0]}`
      : word.exampleSentence.replace(new RegExp(`\\b${word.headword.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i"), "____");
  return { ...base, responseType: "CHOICE", prompt, expectedAnswer: word.wordId, answerLabel: usesHeadwordChoices ? word.headword : word.meanings[0], choices, exampleMeaning: word.exampleMeaning };
}

export function createVocabularyCheckActivities({ words = [], gradeLevel, topicId = null, count = 12, seed = 0 } = {}) {
  const eligible = selectVocabularyWords({ words, gradeLevel, topicId });
  if (eligible.length === 0) throw new Error("확인 학습에 사용할 승인 단어가 없습니다.");
  const selected = deterministicShuffle(eligible, Number(seed) || hashText(`${gradeLevel}:${topicId || "ALL"}`)).slice(0, Math.min(Math.max(1, Number(count) || 12), eligible.length));
  const modes = [VocabularyPracticeMode.MEANING_CHOICE, VocabularyPracticeMode.REVERSE_CHOICE, VocabularyPracticeMode.SPELLING_RECALL, VocabularyPracticeMode.CONTEXT_APPLICATION];
  return selected.map((word, index) => {
    const mode = modes[index % modes.length];
    const prompt = createVocabularyPracticePrompt(word, mode, { words: eligible });
    const activityId = `${word.wordId}_check_${mode.toLowerCase()}`;
    return normalizeLearningActivity({
      id: activityId,
      version: 1,
      subjectId: "english",
      courseId: "english-core",
      moduleId: "english-vocabulary",
      unitId: word.topicId,
      skillId: `EN_VOCAB_G${word.gradeLevel}`,
      activityType: prompt.responseType === "TEXT" ? "SHORT_ANSWER" : "MULTIPLE_CHOICE",
      responseType: prompt.responseType,
      gradingMode: "GUARDIAN_MANUAL",
      prompt: prompt.prompt,
      expectedAnswer: prompt.expectedAnswer,
      choices: prompt.choices,
      explanation: `${word.headword}: ${word.meanings.join(", ")}. ${word.exampleSentence}`,
      gradingReference: { expectedAnswer: prompt.answerLabel, acceptableAnswers: [word.headword], explanation: word.exampleMeaning },
      contentRef: { packageId: "english-vocabulary-v1", packageVersion: "1.0.0", contentId: activityId, contentVersion: 1 },
      sourceMetadata: { ...word.sourceMetadata, sourceId: word.wordId },
      gradeLevel: word.gradeLevel,
      semester: word.semester,
      difficulty: word.difficulty,
      curriculumVersion: word.curriculumVersion,
      achievementStandardIds: word.achievementStandardIds,
      reviewStatus: "APPROVED",
      metadata: { sessionPurpose: "VOCABULARY_CHECK", wordId: word.wordId, practiceMode: mode, topicId: word.topicId }
    });
  });
}
