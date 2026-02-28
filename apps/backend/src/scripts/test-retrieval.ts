import { queryRAG } from '../services/rag';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

async function testRetrieval() {
  const questions = [
    "¿Qué versiones de Angular e Ionic se usan?",
    "¿Cómo se implementa la gestión de estado y qué versión de NgRx se utiliza?",
    "¿Qué microfrontends están activos en el proyecto?",
    "¿Cómo funciona el proceso de autenticación y qué guards se utilizan?",
    "¿Cuál es el flujo de CI/CD en Jenkins y qué plataformas se construyen?",
    "¿Qué API mínima de Android se soporta?"
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = join(process.cwd(), '..', '..', 'benchmark', 'evaluation', 'results', 'validations');
  const reportPath = join(resultsDir, `retrieval-report-${timestamp}.md`);

  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  let reportMd = `# RAG Retrieval Report\n\n`;
  reportMd += `**Date:** ${new Date().toLocaleString()}\n`;
  reportMd += `**Total Questions:** ${questions.length}\n\n`;
  reportMd += `| # | Question | Status | Time | Sources | Max Score |\n`;
  reportMd += `|---|---|---|---|---|---|\n`;

  console.log('🔍 Testing RAG Retrieval\n');
  console.log('='.repeat(60));

  const detailedResults: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n📝 Question [${i+1}/${questions.length}]: ${q}`);
    const start = Date.now();
    let status = '✅ OK';
    let elapsed = 0;
    let sourceCount = 0;
    let maxScore = 'N/A';

    try {
      const result = await queryRAG(q);
      elapsed = Date.now() - start;
      sourceCount = result.sources.length;

      console.log(`✓ Success in ${elapsed}ms (${(elapsed/1000).toFixed(1)}s)`);
      console.log(`  Answer preview: ${result.answer.substring(0, 100).replace(/\n/g, ' ')}...`);

      const rerankScores = result.sources
        .map(s => s.rerankScore)
        .filter((score): score is number => score !== undefined);

      if (rerankScores.length > 0) {
        maxScore = Math.max(...rerankScores).toFixed(3);
      }

      // Add to detailed section
      let detail = `## ${i + 1}. ${q}\n\n`;
      detail += `**Time:** ${(elapsed/1000).toFixed(2)}s | **Sources:** ${sourceCount} | **Max Rerank Score:** ${maxScore}\n\n`;
      detail += `### Answer\n${result.answer}\n\n`;
      detail += `### Sources\n`;
      
      result.sources.forEach((s, idx) => {
        const scoreStr = s.rerankScore !== undefined ? ` (Score: ${s.rerankScore.toFixed(3)})` : '';
        detail += `${idx + 1}. **${s.filename}**${scoreStr}\n`;
      });
      
      detailedResults.push(detail);

    } catch (error: any) {
      elapsed = Date.now() - start;
      status = '❌ Error';
      console.error(`❌ Error after ${elapsed}ms: ${error.message}`);
      
      detailedResults.push(`## ${i + 1}. ${q}\n\n**STATUS: ERROR**\n\n\`\`\`\n${error.message}\n${error.stack}\n\`\`\`\n`);
    }

    reportMd += `| ${i + 1} | ${q} | ${status} | ${(elapsed/1000).toFixed(2)}s | ${sourceCount} | ${maxScore} |\n`;
    console.log('-'.repeat(60));
  }

  reportMd += `\n---\n\n` + detailedResults.join('\n---\n\n');

  writeFileSync(reportPath, reportMd);
  console.log(`\n✅ Test completed. Report generated at:`);
  console.log(`👉 ${reportPath}\n`);
}

testRetrieval().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
