//+_+// Phase F16A: Content Factory Core Schema & Enum SSOT
//+_+// Provides schema definitions, lifecycle statuses, license types, and universal validation functions

export const SCHEMA_VERSION = "1.0.0";

export const LifecycleStatus = Object.freeze({
  CANDIDATE: "CANDIDATE",
  VALIDATED: "VALIDATED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
});

export const LicenseType = Object.freeze({
  PROJECT_OWNED: "PROJECT_OWNED",
  PUBLIC_DOMAIN: "PUBLIC_DOMAIN",
  OPEN_LICENSE: "OPEN_LICENSE",
  ATTRIBUTION_REQUIRED: "ATTRIBUTION_REQUIRED",
  SHARE_ALIKE: "SHARE_ALIKE",
  UNKNOWN: "UNKNOWN",
  PROHIBITED: "PROHIBITED"
});

export const DuplicateStatus = Object.freeze({
  EXACT_DUPLICATE: "EXACT_DUPLICATE",
  NEAR_DUPLICATE: "NEAR_DUPLICATE",
  UNIQUE: "UNIQUE"
});

export const SupportedSubjects = Object.freeze(["english", "korean", "math"]);

export const SupportedResponseTypes = Object.freeze(["CHOICE", "TEXT", "CANVAS"]);

/**
 * Universal validation helper for Content Factory entity schemas
 * @param {string} schemaName
 * @param {object} entity
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSchema(schemaName, entity) {
  const errors = [];

  if (!entity || typeof entity !== "object") {
    return { valid: false, errors: [`[${schemaName}] Entity must be a non-null object`] };
  }

  // Common required fields for all factory schemas
  if (!entity.schemaVersion || typeof entity.schemaVersion !== "string") {
    errors.push(`[${schemaName}] Missing or invalid schemaVersion`);
  }

  if (!entity.status || !Object.values(LifecycleStatus).includes(entity.status)) {
    errors.push(`[${schemaName}] Missing or invalid status: "${entity.status}"`);
  }

  // Validate provenance
  if (!entity.provenance || typeof entity.provenance !== "object") {
    errors.push(`[${schemaName}] Missing or invalid provenance object`);
  } else {
    if (!entity.provenance.sourceId || typeof entity.provenance.sourceId !== "string") {
      errors.push(`[${schemaName}] provenance.sourceId is required`);
    }
  }

  // Schema-specific validation
  switch (schemaName) {
    case "Lexeme": {
      if (!entity.lexemeId || typeof entity.lexemeId !== "string") {
        errors.push("[Lexeme] lexemeId is required");
      }
      if (!entity.headword || typeof entity.headword !== "string" || !entity.headword.trim()) {
        errors.push("[Lexeme] headword is required");
      }
      if (!entity.partOfSpeech || typeof entity.partOfSpeech !== "string") {
        errors.push("[Lexeme] partOfSpeech is required");
      }
      if (!Array.isArray(entity.senses) || entity.senses.length === 0) {
        errors.push("[Lexeme] senses array must not be empty");
      } else {
        const seenSenseIds = new Set();
        entity.senses.forEach((s, idx) => {
          if (!s.senseId || typeof s.senseId !== "string") {
            errors.push(`[Lexeme] senses[${idx}].senseId is required`);
          } else if (seenSenseIds.has(s.senseId)) {
            errors.push(`[Lexeme] duplicate senseId "${s.senseId}" detected`);
          } else {
            seenSenseIds.add(s.senseId);
          }
          if (!s.definition || typeof s.definition !== "string" || !s.definition.trim()) {
            errors.push(`[Lexeme] senses[${idx}].definition is required`);
          }
        });
      }
      if (typeof entity.gradeLevel !== "number" || entity.gradeLevel < 1 || entity.gradeLevel > 6) {
        errors.push("[Lexeme] gradeLevel must be an integer between 1 and 6");
      }
      break;
    }

    case "WordFamily": {
      if (!entity.wordFamilyId || typeof entity.wordFamilyId !== "string") {
        errors.push("[WordFamily] wordFamilyId is required");
      }
      if (!entity.baseWord || typeof entity.baseWord !== "string" || !entity.baseWord.trim()) {
        errors.push("[WordFamily] baseWord is required");
      }
      if (!Array.isArray(entity.morphologyVariants)) {
        errors.push("[WordFamily] morphologyVariants must be an array");
      } else {
        const seenForms = new Set();
        entity.morphologyVariants.forEach((v, idx) => {
          if (!v.form || typeof v.form !== "string") {
            errors.push(`[WordFamily] morphologyVariants[${idx}].form is required`);
          } else if (seenForms.has(v.form)) {
            errors.push(`[WordFamily] duplicate form "${v.form}" in morphologyVariants`);
          } else {
            seenForms.add(v.form);
          }
          if (v.isIrregular && !v.rule) {
            errors.push(`[WordFamily] irregular variant "${v.form}" must specify rule`);
          }
        });
      }
      if (typeof entity.gradeLevel !== "number" || entity.gradeLevel < 1 || entity.gradeLevel > 6) {
        errors.push("[WordFamily] gradeLevel must be an integer between 1 and 6");
      }
      break;
    }

    case "Morphology": {
      if (!entity.morphologyId || typeof entity.morphologyId !== "string") {
        errors.push("[Morphology] morphologyId is required");
      }
      if (!entity.baseWord || typeof entity.baseWord !== "string") {
        errors.push("[Morphology] baseWord is required");
      }
      if (!entity.form || typeof entity.form !== "string") {
        errors.push("[Morphology] form is required");
      }
      if (!entity.variantType || typeof entity.variantType !== "string") {
        errors.push("[Morphology] variantType is required");
      }
      if (entity.isIrregular && !entity.rule) {
        errors.push("[Morphology] irregular morphology must specify a rule");
      }
      break;
    }

    case "Expression": {
      if (!entity.expressionId || typeof entity.expressionId !== "string") {
        errors.push("[Expression] expressionId is required");
      }
      if (!entity.text || typeof entity.text !== "string" || !entity.text.trim()) {
        errors.push("[Expression] text is required");
      }
      if (!entity.meaning || typeof entity.meaning !== "string" || !entity.meaning.trim()) {
        errors.push("[Expression] meaning is required");
      }
      if (typeof entity.gradeLevel !== "number" || entity.gradeLevel < 1 || entity.gradeLevel > 6) {
        errors.push("[Expression] gradeLevel must be an integer between 1 and 6");
      }
      break;
    }

    case "ContextSentence": {
      if (!entity.sentenceId || typeof entity.sentenceId !== "string") {
        errors.push("[ContextSentence] sentenceId is required");
      }
      if (!entity.text || typeof entity.text !== "string" || !entity.text.trim()) {
        errors.push("[ContextSentence] text is required");
      }
      if (!Array.isArray(entity.targetElements) || entity.targetElements.length === 0) {
        errors.push("[ContextSentence] targetElements must be a non-empty array");
      }
      if (typeof entity.gradeLevel !== "number" || entity.gradeLevel < 1 || entity.gradeLevel > 6) {
        errors.push("[ContextSentence] gradeLevel must be an integer between 1 and 6");
      }
      break;
    }

    case "KnowledgeRule": {
      if (!entity.ruleId || typeof entity.ruleId !== "string") {
        errors.push("[KnowledgeRule] ruleId is required");
      }
      if (!entity.subject || !SupportedSubjects.includes(entity.subject)) {
        errors.push(`[KnowledgeRule] subject must be one of ${SupportedSubjects.join(", ")}`);
      }
      if (!entity.ruleName || typeof entity.ruleName !== "string" || !entity.ruleName.trim()) {
        errors.push("[KnowledgeRule] ruleName is required");
      }
      if (!entity.domain || typeof entity.domain !== "string") {
        errors.push("[KnowledgeRule] domain is required");
      }
      if (!Array.isArray(entity.examples) || entity.examples.length === 0) {
        errors.push("[KnowledgeRule] examples must be a non-empty array");
      }
      break;
    }

    case "GenerationRule": {
      if (!entity.generationRuleId || typeof entity.generationRuleId !== "string") {
        errors.push("[GenerationRule] generationRuleId is required");
      }
      if (!entity.generatorId || typeof entity.generatorId !== "string") {
        errors.push("[GenerationRule] generatorId is required");
      }
      if (!entity.generatorVersion || typeof entity.generatorVersion !== "string") {
        errors.push("[GenerationRule] generatorVersion is required");
      }
      if (!entity.subject || !SupportedSubjects.includes(entity.subject)) {
        errors.push(`[GenerationRule] subject must be one of ${SupportedSubjects.join(", ")}`);
      }
      if (!entity.responseType || !SupportedResponseTypes.includes(entity.responseType)) {
        errors.push(`[GenerationRule] responseType must be one of ${SupportedResponseTypes.join(", ")}`);
      }
      break;
    }

    case "MathGeneratorSpec": {
      if (!entity.specId || typeof entity.specId !== "string") {
        errors.push("[MathGeneratorSpec] specId is required");
      }
      if (!entity.generatorId || typeof entity.generatorId !== "string") {
        errors.push("[MathGeneratorSpec] generatorId is required");
      }
      if (!entity.domain || typeof entity.domain !== "string") {
        errors.push("[MathGeneratorSpec] domain is required");
      }
      if (!entity.operationType || typeof entity.operationType !== "string") {
        errors.push("[MathGeneratorSpec] operationType is required");
      }
      if (!entity.operandConstraints || typeof entity.operandConstraints !== "object") {
        errors.push("[MathGeneratorSpec] operandConstraints object is required");
      }
      if (!entity.curriculumLinkage || typeof entity.curriculumLinkage !== "object") {
        errors.push("[MathGeneratorSpec] curriculumLinkage object is required");
      } else {
        if (!entity.curriculumLinkage.skillId) {
          errors.push("[MathGeneratorSpec] curriculumLinkage.skillId is required");
        }
      }
      break;
    }

    case "MathFeatureVector": {
      if (!entity.featureVectorId || typeof entity.featureVectorId !== "string") {
        errors.push("[MathFeatureVector] featureVectorId is required");
      }
      if (!entity.specId || typeof entity.specId !== "string") {
        errors.push("[MathFeatureVector] specId is required");
      }
      if (!entity.features || typeof entity.features !== "object") {
        errors.push("[MathFeatureVector] features object is required");
      }
      break;
    }

    case "ActivityCandidate": {
      if (!entity.candidateId || typeof entity.candidateId !== "string") {
        errors.push("[ActivityCandidate] candidateId is required");
      }
      if (!entity.subject || !SupportedSubjects.includes(entity.subject)) {
        errors.push(`[ActivityCandidate] subject must be one of ${SupportedSubjects.join(", ")}`);
      }
      if (typeof entity.gradeLevel !== "number" || entity.gradeLevel < 1 || entity.gradeLevel > 6) {
        errors.push("[ActivityCandidate] gradeLevel must be an integer between 1 and 6");
      }
      if (!entity.skillId || typeof entity.skillId !== "string") {
        errors.push("[ActivityCandidate] skillId is required");
      }
      if (!entity.responseType || !SupportedResponseTypes.includes(entity.responseType)) {
        errors.push(`[ActivityCandidate] responseType must be one of ${SupportedResponseTypes.join(", ")}`);
      }
      if (!entity.prompt || typeof entity.prompt !== "string" || !entity.prompt.trim()) {
        errors.push("[ActivityCandidate] prompt is required and non-empty");
      }
      if (entity.responseType === "CHOICE") {
        if (!Array.isArray(entity.choices) || entity.choices.length < 2) {
          errors.push("[ActivityCandidate] CHOICE responseType must have at least 2 choices");
        }
      }
      if (entity.expectedReference === undefined || entity.expectedReference === null || entity.expectedReference === "") {
        errors.push("[ActivityCandidate] expectedReference is required");
      }
      break;
    }

    case "ReviewBatch": {
      if (!entity.batchId || typeof entity.batchId !== "string") {
        errors.push("[ReviewBatch] batchId is required");
      }
      if (!entity.subject || !SupportedSubjects.includes(entity.subject)) {
        errors.push(`[ReviewBatch] subject must be one of ${SupportedSubjects.join(", ")}`);
      }
      if (typeof entity.candidateCount !== "number" || entity.candidateCount < 0) {
        errors.push("[ReviewBatch] candidateCount must be a non-negative integer");
      }
      if (typeof entity.approvedCount !== "number" || entity.approvedCount < 0) {
        errors.push("[ReviewBatch] approvedCount must be a non-negative integer");
      }
      if (entity.approvedCount > 0) {
        if (!entity.reviewer || typeof entity.reviewer !== "string" || !entity.reviewer.trim()) {
          errors.push("[ReviewBatch] reviewer identity is mandatory when approvedCount > 0");
        }
        if (!entity.reviewedAt || typeof entity.reviewedAt !== "string") {
          errors.push("[ReviewBatch] reviewedAt date is mandatory when approvedCount > 0");
        }
      }
      break;
    }

    case "MaterializedActivity": {
      if (!entity.activityId || typeof entity.activityId !== "string") {
        errors.push("[MaterializedActivity] activityId is required");
      }
      if (entity.status !== LifecycleStatus.APPROVED) {
        errors.push(`[MaterializedActivity] status must be APPROVED (got "${entity.status}")`);
      }
      if (entity.reviewStatus !== LifecycleStatus.APPROVED) {
        errors.push(`[MaterializedActivity] reviewStatus must be APPROVED (got "${entity.reviewStatus}")`);
      }
      if (!entity.sourceIdentity || typeof entity.sourceIdentity !== "string") {
        errors.push("[MaterializedActivity] sourceIdentity is required");
      }
      if (!entity.contentVersion || typeof entity.contentVersion !== "string") {
        errors.push("[MaterializedActivity] contentVersion is required");
      }
      if (!entity.fingerprint || typeof entity.fingerprint !== "string") {
        errors.push("[MaterializedActivity] fingerprint is required");
      }
      if (!entity.prompt || typeof entity.prompt !== "string" || !entity.prompt.trim()) {
        errors.push("[MaterializedActivity] prompt is required and non-empty");
      }
      break;
    }

    case "ContentShardManifest": {
      if (!entity.shardId || typeof entity.shardId !== "string") {
        errors.push("[ContentShardManifest] shardId is required");
      }
      if (!entity.subject || !SupportedSubjects.includes(entity.subject)) {
        errors.push(`[ContentShardManifest] subject must be one of ${SupportedSubjects.join(", ")}`);
      }
      if (!Array.isArray(entity.gradeRange) || entity.gradeRange.length !== 2) {
        errors.push("[ContentShardManifest] gradeRange must be a 2-element array [minGrade, maxGrade]");
      }
      if (!Array.isArray(entity.skillIds) || entity.skillIds.length === 0) {
        errors.push("[ContentShardManifest] skillIds must be a non-empty array");
      }
      if (typeof entity.itemCount !== "number" || entity.itemCount < 0) {
        errors.push("[ContentShardManifest] itemCount must be a non-negative integer");
      }
      if (typeof entity.byteSize !== "number" || entity.byteSize < 0) {
        errors.push("[ContentShardManifest] byteSize must be a non-negative integer");
      }
      if (!entity.sha256 || typeof entity.sha256 !== "string" || entity.sha256.length !== 64) {
        errors.push("[ContentShardManifest] sha256 must be a valid 64-char hex string");
      }
      break;
    }

    case "CoverageReport": {
      if (!entity.reportId || typeof entity.reportId !== "string") {
        errors.push("[CoverageReport] reportId is required");
      }
      if (!entity.generatedAt || typeof entity.generatedAt !== "string") {
        errors.push("[CoverageReport] generatedAt is required");
      }
      if (!entity.summary || typeof entity.summary !== "object") {
        errors.push("[CoverageReport] summary object is required");
      }
      break;
    }

    default:
      errors.push(`Unknown schema name: "${schemaName}"`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
