#!/usr/bin/env node
/**
 * Script de Validación Manual de RAGAS
 *
 * Muestra casos de evaluación para validación manual humana.
 * Ayuda a detectar si RAGAS está evaluando correctamente.
 *
 * Uso:
 *   npx tsx apps/evaluation/src/cli/validate-ragas.ts <json-path>
 */

import { readFile } from 'fs/promises';

interface EvaluationResult {
  test_case_id: string;
  question: string;
  generated_answer: string;
  retrieved_sources: string[];
  retrieved_contexts: string[];
  faithfulness_score: number;
  answer_relevancy_score: number;
  context_precision_score: number;
  context_recall_score: number;
  error?: string;
}

interface EvaluationReport {
  detailed_results: EvaluationResult[];
}

function detectTimeout(result: EvaluationResult): boolean {
  // Detectar timeouts: múltiples scores de exactamente 0.5
  const scores = [
    result.faithfulness_score,
    result.answer_relevancy_score,
    result.context_precision_score,
  ];

  const halfScores = scores.filter(s => s === 0.5).length;
  return halfScores >= 2; // Si 2+ métricas son 0.5, probablemente timeout
}

function getManualEvaluationPrompt(result: EvaluationResult): string {
  return `
${'='.repeat(80)}
CASO: ${result.test_case_id}
${'='.repeat(80)}

📝 PREGUNTA:
${result.question}

🤖 RESPUESTA GENERADA:
${result.generated_answer}

📚 FUENTES RECUPERADAS (${result.retrieved_sources.length}):
${result.retrieved_sources.join('\n')}

${result.retrieved_contexts.length > 0 ? `
📄 CONTEXTOS RECUPERADOS:
${result.retrieved_contexts.slice(0, 2).map((ctx, i) =>
  `[${i + 1}] ${ctx.substring(0, 300)}...`
).join('\n\n')}
` : ''}

${'─'.repeat(80)}
🎯 SCORES RAGAS (Automáticos):
${'─'.repeat(80)}
• Faithfulness (Fidelidad):       ${result.faithfulness_score.toFixed(2)} ${detectTimeout(result) ? '⚠️  POSIBLE TIMEOUT' : ''}
• Answer Relevancy (Relevancia):  ${result.answer_relevancy_score.toFixed(2)} ${detectTimeout(result) ? '⚠️  POSIBLE TIMEOUT' : ''}
• Context Precision (Precisión):  ${result.context_precision_score.toFixed(2)} ${detectTimeout(result) ? '⚠️  POSIBLE TIMEOUT' : ''}
• Context Recall (Cobertura):     ${result.context_recall_score.toFixed(2)}

${'─'.repeat(80)}
✏️  EVALUACIÓN MANUAL (TÚ DECIDES):
${'─'.repeat(80)}

1. FAITHFULNESS (¿La respuesta está soportada por los contextos?):
   [ ] 1.0 = Totalmente soportada, sin alucinaciones
   [ ] 0.7 = Mayormente soportada, mínimas alucinaciones
   [ ] 0.5 = Parcialmente soportada
   [ ] 0.3 = Pocas partes soportadas
   [ ] 0.0 = No soportada, muchas alucinaciones

   Tu score: _____

2. ANSWER RELEVANCY (¿La respuesta responde la pregunta?):
   [ ] 1.0 = Responde completamente la pregunta
   [ ] 0.7 = Responde la mayoría, algo incompleto
   [ ] 0.5 = Responde parcialmente
   [ ] 0.3 = Responde muy poco
   [ ] 0.0 = No responde la pregunta

   Tu score: _____

3. CONTEXT PRECISION (¿Los contextos son relevantes para la pregunta?):
   [ ] 1.0 = Todos los contextos son relevantes
   [ ] 0.7 = La mayoría son relevantes
   [ ] 0.5 = ~50% relevantes
   [ ] 0.3 = Pocos relevantes
   [ ] 0.0 = Ninguno relevante

   Tu score: _____

4. CONTEXT RECALL (¿Se recuperaron todos los documentos esperados?):
   ${result.context_recall_score === 1.0 ? '✅ PERFECTO (1.0)' : `⚠️  ${result.context_recall_score.toFixed(2)}`}

${'─'.repeat(80)}
📊 COMPARACIÓN:
${'─'.repeat(80)}
Si tus scores difieren significativamente (>0.3) de RAGAS:
→ RAGAS podría estar evaluando incorrectamente
→ Considera: timeouts, prompts de evaluación, o temperatura del LLM evaluador

${detectTimeout(result) ? `
⚠️  ALERTA: Este caso tiene indicios de TIMEOUT en el evaluador.
Los scores de 0.5 exactos sugieren que el LLM evaluador no terminó de evaluar.
Considera aumentar el timeout o usar un modelo más rápido para evaluación.
` : ''}

`;
}

async function main() {
  const jsonPath = process.argv[2];

  if (!jsonPath) {
    console.error('❌ Error: Debes proporcionar la ruta al archivo JSON de resultados');
    console.error('\nUso:');
    console.error('  npx tsx apps/evaluation/src/cli/validate-ragas.ts <ruta-json>');
    console.error('\nEjemplo:');
    console.error('  npx tsx apps/evaluation/src/cli/validate-ragas.ts benchmark/evaluation/results/ragas_2026-02-02.json');
    process.exit(1);
  }

  try {
    const content = await readFile(jsonPath, 'utf-8');
    const report: EvaluationReport = JSON.parse(content);

    if (!report.detailed_results || report.detailed_results.length === 0) {
      console.error('❌ Error: No se encontraron resultados en el archivo JSON');
      process.exit(1);
    }

    console.log('🔍 VALIDACIÓN MANUAL DE RAGAS');
    console.log('═'.repeat(80));
    console.log(`Archivo: ${jsonPath}`);
    console.log(`Total de casos: ${report.detailed_results.length}`);
    console.log('═'.repeat(80));

    // Detectar casos con posibles timeouts
    const timeoutCases = report.detailed_results.filter(detectTimeout);
    if (timeoutCases.length > 0) {
      console.log(`\n⚠️  ALERTA: ${timeoutCases.length}/${report.detailed_results.length} casos tienen indicios de TIMEOUT`);
      console.log('   → Considera aumentar el timeout del evaluador (actualmente 90s)');
      console.log('   → O usar un modelo más rápido para evaluación\n');
    }

    // Mostrar cada caso para validación manual
    for (const result of report.detailed_results) {
      console.log(getManualEvaluationPrompt(result));
      console.log('\n\n');
    }

    // Resumen final
    console.log('═'.repeat(80));
    console.log('📋 RESUMEN DE VALIDACIÓN');
    console.log('═'.repeat(80));
    console.log(`
Después de revisar manualmente los casos:

1. Si la mayoría de tus scores coinciden con RAGAS (±0.2):
   ✅ RAGAS está evaluando correctamente
   → Puedes confiar en las métricas automáticas

2. Si tus scores difieren significativamente (>0.3):
   ⚠️  RAGAS podría tener problemas:
   → Timeouts del LLM evaluador
   → Prompts de evaluación incorrectos
   → Temperatura muy alta en el evaluador

3. Si ves muchos scores de 0.5 exactos:
   ❌ Probable timeout del evaluador
   → Aumenta timeout en ragasEvaluator.ts (actualmente 90s)
   → Usa modelo más rápido para evaluación
   → O reduce complejidad de prompts de evaluación

Casos con posibles timeouts: ${timeoutCases.length}/${report.detailed_results.length}
`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
