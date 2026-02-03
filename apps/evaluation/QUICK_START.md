# Quick Start: Manual Validation Tool

## TL;DR

```bash
cd apps/evaluation
npm run validate
```

## What This Tool Does

Identifies why your RAGAS evaluation results are unreliable by:
1. Manually reviewing each test case
2. Comparing automated vs manual validation
3. Detecting systematic patterns of failure
4. Generating actionable fix recommendations

## Critical Issues This Tool Detects

### 🚨 Total Retrieval Failure
**Symptom:** `retrieved_contexts: []` - RAG returns ZERO documents
**Impact:** Cannot evaluate, all metrics invalid
**Example:** `ragas_2026-02-03T07-51-03.json` - all 3 cases

### ⚠️ False Hallucination Detection
**Symptom:** Correct answer from context marked as hallucination
**Impact:** Metrics untrustworthy, good RAG looks bad
**Example:** "Angular 15" is in context but flagged

### ⚠️ Contradictory Metrics
**Symptom:** High relevancy (0.9) + low faithfulness (0.5)
**Impact:** Logically impossible, metrics broken
**Example:** Perfect answer flagged as hallucination

### 🚨 Systematic Timeouts
**Symptom:** Cases timeout after 120s with empty responses
**Impact:** Cannot complete evaluation
**Example:** 2 of 3 recent cases

## 3-Step Workflow

### Step 1: Run Tool
```bash
npm run validate
```

### Step 2: Select & Review
- Choose evaluation file
- Review each case (question, answer, contexts, metrics)
- Answer 7 validation questions

### Step 3: Get Reports
Tool generates:
- `validation_*.json` - Complete session data
- `patterns_*.md` - Pattern analysis
- `recommendations_*.md` - Prioritized fixes

## Example Validation Questions

```
1. Is the answer FACTUALLY CORRECT? [y/n/partial]
   → Check against your knowledge

2. Uses ONLY context info? [y/n]
   → Verify no external knowledge added

3. Hallucinations marked correctly? [y/n/false-positive]
   → Cross-check detected hallucinations with context

4. Relevant contexts retrieved? [y/n/partial]
   → Check if right documents were found

5. Quality rating (1-5)?
   → 1=Very Poor, 5=Excellent

6. Issue type [1-6]:
   1 = correct_but_flagged
   2 = missing_context
   3 = wrong_answer
   4 = contradictory_metrics
   5 = timeout_masked
   6 = no_issue

7. Notes (optional):
   → Any additional observations
```

## Example Output

```
═══════════════════════════════════════════════════════════
                 Test Case 1/3: basica_1
═══════════════════════════════════════════════════════════

📝 QUESTION:
¿Qué versiones de Angular e Ionic se usan?

🤖 GENERATED ANSWER:
Angular 15 e Ionic 6

📚 RETRIEVED CONTEXTS: 3 documents
  [1] 01-arquitectura-general.md (5234 chars)
      Preview: Framework: Angular 15, Ionic 6...

📊 METRICS:
  Faithfulness:        ████░░░░░░░░ 0.50 ⚠️  BELOW THRESHOLD
  Answer Relevancy:    ██████████░░ 0.90 ✓  Good
  Context Recall:      ████████████ 1.00 ✓  Perfect
  Hallucination Score: ████████░░░░ 0.60 ⚠️  HIGH

⚠️ HALLUCINATIONS DETECTED (1):
  1. "Angular 15 e Ionic 6"  ← THIS IS IN THE CONTEXT!

❓ MANUAL VALIDATION
1. Factually correct? y
2. Uses only context? y
3. Hallucinations correct? false-positive  ← Key issue!
...
```

## What Happens Next?

### Pattern Detected: False Hallucination
```markdown
### ⚠️ PATTERN: False Hallucination Detection

**Frequency:** 1 case
**Priority:** HIGH

**Root Cause:**
Hallucination detector too strict or synthesis considered as hallucination

**Recommended Fix:**
1. Review hallucination detection prompt
2. Add test cases for valid synthesis
3. Lower detection threshold
4. Improve context matching logic
```

## Tips

1. **View Full Contexts**: Press `y` when asked to see complete context text
2. **Check Sources**: Verify expected files were retrieved
3. **Compare Metrics**: Look for contradictions (high relevancy + low faithfulness)
4. **Document Notes**: Add observations for unusual patterns

## Common Scenarios

### Scenario 1: All Cases Have Zero Contexts
**→ Pattern Detected:** Total Retrieval Failure
**→ Priority:** CRITICAL
**→ Fix:** Check BM25 cache, verify vector store indexing

### Scenario 2: Correct Answers Flagged
**→ Pattern Detected:** False Hallucination Detection
**→ Priority:** HIGH
**→ Fix:** Adjust hallucination detection sensitivity

### Scenario 3: Everything Times Out
**→ Pattern Detected:** Systematic Timeouts
**→ Priority:** CRITICAL
**→ Fix:** Profile LLM calls, optimize reranker

## Output Location

```
benchmark/evaluation/results/validations/
├── validation_2026-02-03T10-30-00.json
├── patterns_2026-02-03T10-30-00.md
└── recommendations_2026-02-03T10-30-00.md
```

## Troubleshooting

**No evaluation files found?**
```bash
# Run evaluation first
npm run eval
```

**Want to validate specific file?**
```bash
# List files first, then run validate
ls -lh ../../benchmark/evaluation/results/ragas_*.json
npm run validate
```

## Next Steps After Validation

1. **If RAG is correct → Fix evaluator**
   - Adjust hallucination detection
   - Fix metric calculations
   - Add consistency checks

2. **If RAG has issues → Fix RAG first**
   - Fix retrieval (BM25, embeddings)
   - Optimize timeouts
   - Then re-evaluate

3. **Create validation dataset**
   - Use validated cases as ground truth
   - Test future evaluator changes

## More Info

See [MANUAL_VALIDATION.md](./MANUAL_VALIDATION.md) for complete documentation.
