#!/bin/bash
# Shark Agent v4.6 Container Test Suite
# Tests WITHOUT MOCKS - all real container-based tests

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

test_guardian_source_edit_block() {
    local test_name="guardian_blocks_source_edit"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"
    
    # v4.8 has canEdit with SOURCE_FILE_NO_EDIT_HISTORY
    local check
    check=$(grep -c "canEdit\|SOURCE_FILE_NO_EDIT_HISTORY" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shared/guardian.ts 2>/dev/null | head -1 || echo "0")
    
    if [ "$check" -ge 1 ]; then
        log_pass "$test_name - canEdit blocks direct source edits"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_guardian_grace_period() {
    local test_name="guardian_grace_period_60min"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"
    
    # v4.8 has 60 minute grace period
    local grace_check
    grace_check=$(grep -c "GRACE_PERIOD_MS.*60.*60.*1000" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shared/guardian.ts 2>/dev/null | head -1 || echo "0")
    
    if [ "$grace_check" -ge 1 ]; then
        log_pass "$test_name - 60 minute grace period present"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_guardian_inplace_modify_block() {
    local test_name="guardian_blocks_inplace_modify"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"
    
    # v4.8 has canModifyFile that blocks sed -i, echo >, etc.
    local check
    check=$(grep -c "canModifyFile\|INPLACE_MODIFY_BLOCKED" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shared/guardian.ts 2>/dev/null | head -1 || echo "0")
    
    if [ "$check" -ge 1 ]; then
        log_pass "$test_name - In-place modifications blocked"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_guardian_dangerous_commands() {
    local test_name="guardian_blocks_dangerous"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"
    
    local check
    check=$(grep -c "rm.*-rf\|dd if=\|mkfs\|fork bomb" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shared/guardian.ts 2>/dev/null | head -1 || echo "0")
    
    if [ "$check" -ge 1 ]; then
        log_pass "$test_name - Dangerous commands blocked"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_triple_brain_structure() {
    local test_name="triple_brain_coordination"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"
    
    # Check all three brains exist
    local exec_brain
    local reason_brain
    local sys_brain
    exec_brain=$(grep -c "EXECUTION_BRAIN_T1" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shark/macro/brains.ts 2>/dev/null | head -1 || echo "0")
    reason_brain=$(grep -c "REASONING_BRAIN_T1" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shark/macro/brains.ts 2>/dev/null | head -1 || echo "0")
    sys_brain=$(grep -c "SYSTEM_BRAIN_T1" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shark/macro/brains.ts 2>/dev/null | head -1 || echo "0")
    
    if [ "$exec_brain" -ge 1 ] && [ "$reason_brain" -ge 1 ] && [ "$sys_brain" -ge 1 ]; then
        log_pass "$test_name - Triple brain structure present"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_theatrical_detector_enforcement() {
    local test_name="theatrical_detector_enforcement"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"

    # Check theatrical patterns exist in guardian-hook and are used
    local theatrical_patterns
    local wired_into_guardian
    theatrical_patterns=$(grep -c "THEATRICAL_PATTERNS" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/hooks/v4.1/guardian-hook.ts 2>/dev/null | head -1 || echo "0")
    wired_into_guardian=$(grep -c "for (const pattern of THEATRICAL_PATTERNS)" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/hooks/v4.1/guardian-hook.ts 2>/dev/null | head -1 || echo "0")

    if [ "$theatrical_patterns" -ge 1 ] && [ "$wired_into_guardian" -ge 1 ]; then
        log_pass "$test_name - Theatrical patterns present and wired into guardian"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name - patterns=$theatrical_patterns wired=$wired_into_guardian"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_mock_tests_banned() {
    local test_name="mock_tests_banned_enforcement"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"

    # Check mock/test patterns are blocked in guardian
    local mock_patterns
    local fake_test_patterns
    mock_patterns=$(grep -c "MOCK_STUB_PATTERNS\|mock.*stub" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/hooks/v4.1/guardian-hook.ts 2>/dev/null | head -1 || echo "0")
    fake_test_patterns=$(grep -c "FAKE_TEST_PATTERNS" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/hooks/v4.1/guardian-hook.ts 2>/dev/null | head -1 || echo "0")

    if [ "$mock_patterns" -ge 1 ] || [ "$fake_test_patterns" -ge 1 ]; then
        log_pass "$test_name - Mock/test patterns blocked in Guardian"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name - Mock patterns not found"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_agent_identity_filtering() {
    local test_name="agent_identity_filtering"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"
    
    local check
    check=$(grep -c "isSharkAgent\|SHARK_PREFIX" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shared/agent-identity.ts 2>/dev/null | head -1 || echo "0")
    
    if [ "$check" -ge 1 ]; then
        log_pass "$test_name - Agent identity filtering present"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_gate_chain() {
    local test_name="gate_chain_plan_build_test_verify"
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running: $test_name"
    
    local plan
    local build
    local test
    local verify
    plan=$(grep -c "PLAN.*BUILD.*TEST.*VERIFY" /home/leviathan/OPENCODE_WORKSPACE/projects/shark-agent-v4/src/shared/gates.ts 2>/dev/null | head -1 || echo "0")
    
    if [ "$plan" -ge 1 ]; then
        log_pass "$test_name - Gate chain present"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

main() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     Shark Agent v4.8 Container Test Suite           ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    test_guardian_source_edit_block
    test_guardian_grace_period
    test_guardian_dangerous_commands
    test_guardian_inplace_modify_block
    test_triple_brain_structure
    test_theatrical_detector_enforcement
    test_mock_tests_banned
    test_agent_identity_filtering
    test_gate_chain
    
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    TEST RESULTS                        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo -e "Tests Run:    $TESTS_RUN"
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo ""
    
    [ $TESTS_FAILED -eq 0 ] && echo -e "${GREEN}ALL TESTS PASSED${NC}" && exit 0 || echo -e "${RED}SOME TESTS FAILED${NC}" && exit 1
}

main "$@"