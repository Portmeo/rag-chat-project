/**
 * Test script para verificar reranking
 *
 * Usage: bun test-reranker.ts
 */

import { rerankDocuments } from './src/services/rag/reranker';

const testQuery = "diferencia entre container y presenter components";

const testDocuments = [
  {
    pageContent: "# Patrón Container-Presenter\n\nEl patrón Container-Presenter separa la lógica de negocio de la presentación visual. Los containers manejan el estado y la lógica, mientras que los presenters solo se encargan de la UI.",
    metadata: { filename: '08-patron-container-presenter.md', chunk_index: 0 }
  },
  {
    pageContent: "Los microfrontends permiten desarrollar, deployar y mantener funcionalidades de forma independiente.",
    metadata: { filename: '03-microfrontends.md', chunk_index: 1 }
  },
  {
    pageContent: "# Autenticación con JWT\n\nEl sistema de autenticación utiliza JSON Web Tokens para gestionar sesiones de usuario de forma segura y stateless.",
    metadata: { filename: '04-autenticacion.md', chunk_index: 0 }
  },
  {
    pageContent: "Los containers se conectan con el Store (NgRx) y manejan la lógica de negocio. Los presenters son componentes stateless que solo reciben props.",
    metadata: { filename: '08-patron-container-presenter.md', chunk_index: 3 }
  },
  {
    pageContent: "NgRx proporciona gestión de estado centralizada usando el patrón Flux en Angular.",
    metadata: { filename: '02-ngrx.md', chunk_index: 0 }
  },
];

console.log('🧪 Testing Reranker...\n');
console.log(`Query: "${testQuery}"\n`);
console.log(`Input documents: ${testDocuments.length}\n`);

try {
  const reranked = await rerankDocuments(testQuery, testDocuments, 3);

  console.log('\n📊 Reranking Results:\n');
  reranked.forEach((doc, idx) => {
    console.log(`${idx + 1}. Score: ${doc.rerankScore.toFixed(4)} | ${doc.metadata.filename}`);
    console.log(`   Preview: ${doc.pageContent.substring(0, 80)}...\n`);
  });

  console.log('✅ Reranking test completed successfully!');
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
