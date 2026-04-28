/**
 * Firewall Patterns — v4.8.3 Checkpoint 4.1
 * 
 * SINGLE SOURCE OF TRUTH. All hooks import from here.
 * Eliminates 4-way pattern duplication that caused inconsistent blocking.
 */
export const THEATRICAL_PATTERNS = [
  /\|.*wc\s+-l/i, /wc\s+-l.*\|/i, /cat.*\|.*wc/i, /grep.*\|.*wc/i,
  /echo.*\|.*wc/i, /ls.*\|.*wc/i, /find.*\|.*wc/i, /\|.*tee/i,
  /\|.*>.*\./i, /wc\s+-l.*dist\//i, /wc\s+-l.*src\//i, /wc\s+-l.*build\//i,
  /\bwc\b.*\.(dist|src|build)/i, /wc\s*</,
  /grep.*setCurrentAgent.*src/i, /grep.*isSharkAgent.*src/i, /grep.*guardian.*src/i,
];

export const LEGITIMATE_PATTERNS = [
  /mkdir\s+-p/i, /cp\s+-r/i, /mv\s+/i, /cat\s+[^\|]+$/i,
  /head\s+-[0-9]+\s+/i, /tail\s+-[0-9]+\s+/i, /grep\s+-[rEn]+.*[^\|]$/i,
  /find\s+.*-name/i, /test\s+-d/i, /test\s+-x/i,
];

export const FAKE_TEST_PATTERNS = [
  /node\s+run-tests?\.js/i, /node\s+verify.*\.mjs/i, /node\s+test/i,
  /npm\s+(run\s+)?test/i, /npm\s+exec\s+test/i, /yarn\s+(run\s+)?test/i,
  /bun\s+test/i, /bunx\s+test/i, /pnpm\s+test/i,
  /jest/i, /vitest/i, /mocha/i, /jasmine/i,
  /pytest/i, /python.*-m.*pytest/i,
  /go\s+test/i, /cargo\s+test/i, /ruby\s+-Itest/i, /rspec/i,
];

export const SOURCE_INSPECTION_PATTERNS = [
  /test\s+-[fe]\s+\$\{?.*\}/i,
  /test\s+-d\s+\$\{?.*\}/i,
  /if\s+\[\s*-[fes]\s+.*\]\s*;/i,
  /\[\s*-[fe]\s+\$\{?.*\}/i,
  /stat\s+/i,
];

export const WRONG_CONTAINER_PATTERNS = [
  /opencode\s+container\s+run/i, /opencode\s+container\s+start/i,
  /opencode\s+container\s+exec/i, /opencode\s+container\s+sh/i,
  /opencode\s+run\s+/i, /docker\s+run.*opencode/i,
];

export const HOST_FALLBACK_PATTERNS = [
  /host.*testing.*already.*works/i, /fall.*back.*to.*host/i,
  /host.*already.*proves/i, /local.*works.*container.*not.*needed/i,
  /since.*host.*works/i, /skip.*container.*test/i,
  /container.*not.*necessary/i, /container.*not.*needed/i,
  /not.*need.*container/i, /skip.*container/i,
  /use.*host.*instead/i, /host.*prove.*it.*works/i,
  /already.*proven.*to.*work/i, /already.*verified.*on.*host/i,
  /already.*tested.*on.*local/i,
];

export const SUCCESS_CLAIM_PATTERNS = [
  /it.*works.*trust.*me/i, /trust.*me.*it.*works/i,
  /believe.*me.*it.*works/i, /already.*verified.*by.*myself/i,
  /already.*tested.*and.*works/i, /obviously.*correct/i,
  /clearly.*works/i, /self.*evidently.*correct/i,
  /in.*my.*assessment.*it.*works/i, /in.*my.*experience.*it.*works/i,
  /based.*on.*my.*analysis.*works/i, /no.*need.*for.*test/i,
  /no.*need.*for.*verification/i, /no.*further.*test.*needed/i,
];

export const MODEL_RESTRICTION_PATTERNS = [
  /only.*gpt/i, /only.*claude/i, /only.*gemini/i, /only.*llama/i,
  /must.*use.*gpt/i, /must.*use.*claude/i, /restricted.*to.*model/i,
  /model.*quota/i, /model.*limit/i, /rate.*limit.*excuse/i,
  /api.*key.*issue/i, /can't.*afford.*model/i,
  /too.*expensive.*model/i, /model.*cost.*too.*high/i, /switch.*model.*理由/i,
];

export const MOCK_STUB_PATTERNS = [
  /mock.*data/i, /stub.*data/i, /fake.*data/i, /dummy.*data/i,
  /sample.*data/i, /test.*data.*only/i, /mocked.*response/i,
  /stubbed.*response/i, /fake.*api/i, /hardcoded.*response/i,
  /static.*json.*instead/i, /no.*real.*api/i,
];

export const SIMPLIFICATION_PATTERNS = [
  /over.*simplif/i, /overly.*simplif/i, /too.*simpl/i, /oversimplif/i,
  /hand.*wave/i, /handwave/i, /gloss.*over/i, /glossed.*over/i,
  /skip.*detail/i, /skip.*nuance/i,
];

export const CONFUSION_PRETENSE_PATTERNS = [
  /it.*somewhat.*works/i, /sorta.*works/i, /kinda.*works/i,
  /more.*or.*less/i, /mostly.*works/i, /approximately.*correct/i,
  /basically.*correct/i, /essentially.*works/i, /nominally.*functional/i,
  /partially.*implemented/i, /partially.*working/i, /somewhat.*correct/i,
];

export const SCOPE_CREEP_PATTERNS = [
  /while.*at.*it/i, /while.*we.*re.*at.*it/i, /at.*the.*same.*time/i,
  /also.*need.*to/i, /might.*as.*well/i, /顺便/i, /顺便说一下/i,
  /just.*to.*be.*thorough/i, /for.*completeness/i, /one.*more.*thing/i,
  /oh.*and.*also/i, /on.*the.*side/i,
];

export const CROSS_AGENT_TOOLS = new Set([
  'hermes_remember', 'hermes_recall', 'hermes_context',
  'hive_remember', 'hive_context', 'hive_status',
  'kraken_hive_remember', 'kraken_hive_search', 'kraken_hive_get_cluster_context',
  'memremember', 'memsearch', 'memread', 'membrowse', 'memcommit',
  'knowledge_remember', 'knowledge_recall', 'knowledge_query',
]);

export const CROSS_AGENT_PATTERNS = [
  /hermes_remember/i, /hermes_recall/i, /hermes_context/i,
  /hive_remember/i, /hive_context/i, /hive_status/i, /hive_mind/i,
  /kraken_hive/i, /memremember/i, /memsearch/i, /memread/i, /membrowse/i,
  /knowledge_remember/i, /knowledge_recall/i, /knowledge_query/i,
];

export const UNDERMINING_PATTERNS = [
  /not.*worth.*the.*effort/i, /too.*much.*work/i, /not.*worth.*it/i,
  /diminishing.*returns/i, /marginal.*benefit/i, /minimal.*gain/i,
  /savvy.*engineer.*would/i, /experienced.*developer.*would/i,
  /realistic.*timeline/i, /realistically/i,
  /practically.*impossible/i, /realistically.*impractical/i,
];

export const IMPATIENCE_PATTERNS = [
  /let's.*just.*move.*on/i, /let's.*skip.*to.*the.*end/i,
  /good.*enough/i, /close.*enough/i,
  /ship.*it/i, /just.*deploy/i, /ship\s+(it|now)\b/i,
  /deploy\s+now/i, /let's.*hurry/i,
];

export const SELF_REFERENCE_PATTERNS = [
  /i.*have.*verified.*that/i, /i.*verified.*it.*works/i,
  /my.*verification.*shows/i, /i.*tested.*it.*works/i,
  /i.*ran.*it.*and.*works/i, /my.*testing.*confirms/i,
  /i.*know.*it.*works/i, /i.*am.*certain.*it.*works/i,
  /my.*assessment.*is/i, /in.*my.*assessment/i, /my.*analysis.*shows/i,
];

export const DANGEROUS_TOOLS = new Set([
  'terminal', 'mcp_terminal', 'bash', 'mcp_bash',
  'write_file', 'mcp_write_file',
  'patch', 'mcp_patch',
  'edit', 'mcp_edit',
  'delete_file', 'mcp_delete_file'
]);

export const CONTAINER_TEST_RESULT_FILE = 'ContainerTestResult.json';

// ============================================================================
// L8: BEHAVIORAL INTELLIGENCE SIGNATURES
// ============================================================================
export const BEHAVIORAL_PATTERNS: Array<{ label: string; pattern: RegExp; requireEvidence?: boolean }> = [
  { label: 'Confused avoidance', pattern: /i('?m| am) confused about (the )?(goal|task|purpose|direction)/i },
  { label: 'Already works claim', pattern: /(host|local).*(already|proves).*(works|correct)/i },
  { label: 'Simplify excuse', pattern: /(maybe|perhaps).*simplif/i },
  { label: 'Goal reset', pattern: /what was the (user.?s |original )?goal/i },
  { label: 'Basic solution shortcut', pattern: /(just|simply) use .*(instead|rather)/i },
  { label: 'Self-assessment claim', pattern: /in my (assessment|experience|analysis)/i, requireEvidence: true },
  { label: 'Scope expansion', pattern: /(while|whilst).*(at it|we.?re at it|also)|should also (fix|add|do)/i },
  { label: 'False fix claim', pattern: /(should be |is )?fixed now|should (be |)working now/i },
  { label: 'Superficial check', pattern: /let me (just )?(check|verify|confirm) (real )?quick/i },
  { label: 'Trust me deflection', pattern: /trust me|i promise|believe me|it.?ll be fine/i, requireEvidence: true },
  { label: 'Task avoidance', pattern: /(maybe|perhaps|let.?s).*(come back|revisit|later|another time)/i },
  { label: 'Overthinking stall', pattern: /(hmm|um|uh).*(thinking|wonder|ponder)/i },
  { label: 'Derail: reading sensitive', pattern: /read(ing)? .*(ssh|key|credential|secret|token|passwd|shadow|\.env|auth)/i },
  { label: 'Derail: exploring system', pattern: /let me (explore|check|look at|see).*(system|root|other|different|whole)/i },
  { label: 'Derail: data exfil', pattern: /(dump|print|output|show) (full|entire|all|complete).*(key|secret|credential|config)/i },
];

// ============================================================================
// L7: VERIFICATION GATE PATTERNS — agent must not claim verification without proof
// ============================================================================
export const VERIFICATION_PATTERNS = [
  /verified( by|\.| and|$)/i,
  /confirmed working/i,
  /tested (and|&) (works|passes|verified)/i,
  /all tests pass(ed|ing)?/i,
  /ready to ship/i,
  /proven (to work|working|correct)/i,
];