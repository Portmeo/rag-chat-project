import { queryRAG } from '../services/rag';

async function testRetrieval() {
  const questions = [
    "¿Qué versiones de Angular e Ionic se usan?",
    "¿Qué versión de Angular se usa?",
    "¿Qué versión de Ionic se usa?"
  ];

  console.log('🔍 Testing RAG Retrieval\n');
  console.log('='.repeat(60));

  for (const q of questions) {
    console.log(`\n📝 Question: ${q}`);
    const start = Date.now();

    try {
      const result = await queryRAG(q);
      const elapsed = Date.now() - start;

      console.log(`✓ Success in ${elapsed}ms (${(elapsed/1000).toFixed(1)}s)`);
      console.log(`  Answer length: ${result.answer.length} chars`);
      console.log(`  Answer preview: ${result.answer.substring(0, 150).replace(/\n/g, ' ')}...`);
      console.log(`  Sources: ${result.sources.length}`);

      if (result.sources.length > 0) {
        const rerankScores = result.sources
          .map(s => s.rerankScore)
          .filter(score => score !== undefined);

        if (rerankScores.length > 0) {
          const avgScore = rerankScores.reduce((a, b) => a + b, 0) / rerankScores.length;
          const minScore = Math.min(...rerankScores);
          const maxScore = Math.max(...rerankScores);

          console.log(`  Rerank scores: min=${minScore.toFixed(3)}, max=${maxScore.toFixed(3)}, avg=${avgScore.toFixed(3)}`);
          console.log(`  Sources with scores: ${rerankScores.length}/${result.sources.length}`);
        } else {
          console.log(`  Rerank scores: none available`);
        }

        // Show first 3 sources
        console.log(`  Top sources:`);
        result.sources.slice(0, 3).forEach((s, i) => {
          const score = s.rerankScore !== undefined ? ` (score: ${s.rerankScore.toFixed(3)})` : '';
          console.log(`    ${i+1}. ${s.filename}${score}`);
        });
      }
    } catch (error: any) {
      const elapsed = Date.now() - start;
      console.error(`❌ Error after ${elapsed}ms: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n')[1]}`);
      }
    }

    console.log('-'.repeat(60));
  }

  console.log('\n✓ Test completed\n');
}

testRetrieval().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
