# Manual Validation Tool for RAGAS Evaluation

## Overview

This tool allows manual review and validation of RAGAS evaluation results to identify patterns of failures, inconsistencies, and evaluate the reliability of automated metrics.

## Why Manual Validation?

The RAGAS evaluation has shown **inconsistent and unreliable results**:

1. **Retrieval Failures**: Some evaluations retrieve zero contexts
2. **False Hallucination Detection**: Correct answers marked as hallucinations
3. **Contradictory Metrics**: High relevancy + low faithfulness (logically impossible)
4. **Systematic Timeouts**: Cases timing out after 120s
5. **Metric Reliability**: Need to verify if the problem is the RAG or the evaluator

## Features

- ✅ Interactive CLI for reviewing evaluation results
- ✅ Full context display (no truncation)
- ✅ Manual validation questions for each test case
- ✅ Automatic pattern detection
- ✅ Detailed reports in JSON and Markdown
- ✅ Actionable recommendations with priority levels

## Installation

No additional installation needed. The tool uses the existing evaluation dependencies.

## Usage

### Run the tool

```bash
cd apps/evaluation
npm run validate
```

### Alternative methods

```bash
# Direct execution
npx tsx src/cli/manual-validate.ts

# Or from project root
cd /path/to/rag-chat-project
npx tsx apps/evaluation/src/cli/manual-validate.ts
```

## Workflow

### 1. Select Evaluation Result File

The tool will list recent RAGAS evaluation results:

```
📂 Recent Evaluation Results:

  1. ragas_2026-02-03T08-39-34.json
     2026-02-03 - 36 KB

  2. ragas_2026-02-03T07-51-03.json
     2026-02-03 - 8 KB

Select file [1-2]:
```

### 2. Review Each Test Case

For each case, the tool displays:

- **Question** and expected ground truth
- **Generated Answer** from the RAG
- **Retrieved Contexts** with preview (option to view full)
- **Retrieved Sources** (filenames)
- **All Metrics** with visual progress bars
- **Hallucinations Detected** by automated system
- **Error Information** if any

### 3. Answer Validation Questions

For each case, you'll be asked:

1. **Is the generated answer FACTUALLY CORRECT?**
   - `y` = Yes, fully correct
   - `n` = No, incorrect
   - `partial` = Partially correct

2. **Does the answer use ONLY information from contexts?**
   - `y` = Yes, only from contexts
   - `n` = No, added external info

3. **Are the hallucinations marked correctly?**
   - `y` = Yes, correctly identified
   - `n` = No, incorrectly identified
   - `false-positive` = Correct info marked as hallucination

4. **Were relevant contexts retrieved?**
   - `y` = Yes, all relevant
   - `n` = No, not relevant
   - `partial` = Some relevant

5. **Rate answer quality (1-5):**
   - `1` = Very Poor
   - `2` = Poor
   - `3` = Acceptable
   - `4` = Good
   - `5` = Excellent

6. **Issue type:**
   - `1` = correct_but_flagged (false positive hallucination)
   - `2` = missing_context (retrieval failure)
   - `3` = wrong_answer (generation failure)
   - `4` = contradictory_metrics (metric calculation issue)
   - `5` = timeout_masked (timeout hiding real issue)
   - `6` = no_issue (working correctly)

7. **Additional notes (optional):**
   - Any observations or comments

### 4. Review Generated Reports

After validation, three reports are generated in `benchmark/evaluation/results/validations/`:

#### A. Validation Session JSON

Complete record of the validation session:

```json
{
  "validation_session": {
    "timestamp": "2026-02-03T10:00:00Z",
    "result_file": "ragas_2026-02-03T08-39-34.json",
    "total_cases_reviewed": 3
  },
  "validated_cases": [...],
  "patterns": [...],
  "recommendations": [...]
}
```

#### B. Pattern Analysis (Markdown)

Detailed analysis of detected patterns:

```markdown
# Manual Validation Report - Pattern Analysis

## Patterns Identified

### 🚨 PATTERN 1: Total Retrieval Failure

**Priority:** CRITICAL
**Frequency:** 3 case(s)
**Effort Estimate:** High (2-4 hours investigation + debugging)

**Affected Cases:**
- basica_1
- basica_2
- basica_3

**Characteristics:**
- retrieved_contexts: []
- No documents returned by retriever
- All scores affected

**Root Cause Hypothesis:**
BM25 cache empty, vector store not indexed, or parent retriever not working

**Recommended Fix:**
Check backend retrieval logs, rebuild BM25 cache, verify vector store indexing
```

#### C. Recommendations (Markdown)

Actionable recommendations prioritized:

```markdown
# Manual Validation Report - Recommendations

## 🚨 Critical Priority

### 1. Fix Total Retrieval Failure

**Issue:** BM25 cache empty, vector store not indexed

**Evidence:**
- 3 case(s) affected: basica_1, basica_2, basica_3
- retrieved_contexts: []

**Action Items:**
1. Check backend retrieval logs
2. Rebuild BM25 cache
3. Verify vector store indexing
```

## Pattern Detection

The tool automatically detects these patterns:

### 1. Total Retrieval Failure (CRITICAL)
- **Characteristics**: `retrieved_contexts: []`
- **Root Cause**: BM25 cache empty, vector store not indexed
- **Impact**: Cannot evaluate RAG at all

### 2. False Hallucination Detection (HIGH)
- **Characteristics**: User confirms correct, automated flags as hallucination
- **Root Cause**: Detector too strict or synthesis considered hallucination
- **Impact**: Metrics not trustworthy

### 3. Contradictory Metrics (HIGH)
- **Characteristics**: High relevancy + low faithfulness
- **Root Cause**: Metrics calculated independently without validation
- **Impact**: Logically impossible results

### 4. Systematic Timeouts (CRITICAL)
- **Characteristics**: Timeout after 120s, empty responses
- **Root Cause**: LLM API slow, reranker issues
- **Impact**: Cannot complete evaluation

### 5. Wrong Answers (CRITICAL)
- **Characteristics**: User confirms incorrect
- **Root Cause**: Retrieval or generation failure
- **Impact**: RAG producing wrong information

## Output Files

All reports are saved to:
```
benchmark/evaluation/results/validations/
├── validation_2026-02-03T10-00-00.json
├── patterns_2026-02-03T10-00-00.md
└── recommendations_2026-02-03T10-00-00.md
```

## Example Output

```
═══════════════════════════════════════════════════════════
                 Test Case 1/3: basica_1
═══════════════════════════════════════════════════════════

📝 QUESTION:
¿Qué versiones de Angular e Ionic se usan en el proyecto?

🤖 GENERATED ANSWER:
El proyecto utiliza Angular 15 e Ionic 6.

📚 RETRIEVED CONTEXTS: 3 documents

  [1] 01-arquitectura-general.md (5234 chars)
      Preview: # Arquitectura General...

📊 METRICS:
  Faithfulness:        ████░░░░░░░░ 0.50 ⚠️  BELOW THRESHOLD
  Answer Relevancy:    ██████████░░ 0.90 ✓  Good
  Context Recall:      ████████████ 1.00 ✓  Perfect
  Hallucination Score: ████████░░░░ 0.60 ⚠️  HIGH

⚠️ HALLUCINATIONS DETECTED (1):
  1. "El proyecto utiliza Angular 15..."

❓ MANUAL VALIDATION
...
```

## Tips

1. **View Full Contexts**: Always review full contexts when answer seems wrong
2. **Check Sources**: Verify expected sources were retrieved
3. **Compare Metrics**: Look for contradictions between metrics
4. **Note Patterns**: Pay attention to recurring issues
5. **Document Notes**: Add notes for unusual cases

## Troubleshooting

### No files found
```
❌ No evaluation result files found
```
**Solution**: Run evaluation first: `npm run eval`

### Invalid selection
```
Invalid selection
```
**Solution**: Enter a number from the displayed range

### Error loading file
```
❌ Error loading file: ...
```
**Solution**: Check file is valid JSON and not corrupted

## Next Steps

After manual validation:

### If RAG is working correctly
→ Fix evaluator (hallucination detection, metrics)

### If RAG has issues
→ Fix RAG first (retrieval, generation, timeouts)
→ Then re-evaluate

### Create validation dataset
→ Use validated cases as ground truth
→ Test evaluator improvements against this dataset

## Technical Details

### Architecture

```
cli/manual-validate.ts          # Main CLI interface
├── utils/displayFormatters.ts  # Terminal formatting
├── core/manualValidator.ts     # Validation logic
├── core/patternDetector.ts     # Pattern detection
└── core/validationReport.ts    # Report generation
```

### Key Classes

- **ManualValidationCLI**: Interactive terminal interface
- **DisplayFormatters**: Terminal colors, progress bars, formatting
- **ManualValidator**: Compare automated vs manual validations
- **PatternDetector**: Detect systematic issues
- **ValidationReportGenerator**: Generate JSON and Markdown reports

### Extended Types

See `apps/evaluation/src/core/types.ts` for:
- `UserValidation`: Manual validation input
- `ValidatedCase`: Combined automated + manual
- `DetectedPattern`: Pattern information
- `ValidationSession`: Complete session data
- `Recommendation`: Actionable recommendations

## Contributing

To add new pattern detectors:

1. Edit `apps/evaluation/src/core/patternDetector.ts`
2. Add new detection method
3. Call from `detectPatterns()`
4. Test with real evaluation data

## License

Same as parent project.
