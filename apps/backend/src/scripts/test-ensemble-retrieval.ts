// Silence all RAG logs during this test
process.env.RAG_LOGS = 'false';

import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository';
import { embeddings } from '../services/rag/config';
import { BM25Retriever } from '../services/rag/bm25Retriever';
import { EnsembleRetriever } from '../services/rag/ensembleRetriever';
import { getAllDocumentsFromQdrant } from '../services/rag/helpers';

const QUESTIONS = [
  // --- Simples (un documento) ---
  { q: "¿Qué versiones de Angular e Ionic se usan en el proyecto?", expected: ["01-arquitectura-general.md"] },
  { q: "¿Qué tipo de autenticación se usa?", expected: ["04-autenticacion-guards.md"] },
  { q: "¿Por qué se usa NgRx para gestionar el estado?", expected: ["02-gestion-estado-ngrx.md"] },
  { q: "¿Cuáles son las ventajas de usar microfrontends?", expected: ["03-microfrontends-web-components.md"] },
  { q: "¿Cómo se integran los web components en Angular?", expected: ["03-microfrontends-web-components.md"] },
  { q: "¿Cómo funciona el flujo de autenticación con JWT?", expected: ["04-autenticacion-guards.md"] },
  { q: "¿Cuál es la diferencia entre Container y Presenter components?", expected: ["08-patron-container-presenter.md"] },
  { q: "¿Qué versión de React se usa?", expected: ["01-arquitectura-general.md"] },
  { q: "¿Cuál es el ciclo completo de un cambio de estado en NgRx?", expected: ["02-gestion-estado-ngrx.md"] },

  // --- Complejas (multi-documento) ---
  { q: "Describe el flujo completo desde que un usuario hace click en login hasta que ve la página protegida", expected: ["02-gestion-estado-ngrx.md", "04-autenticacion-guards.md"] },
  { q: "¿Cómo se sincroniza el estado de autenticación entre el AuthService y el store de NgRx, y qué acciones se dispatching durante el login?", expected: ["04-autenticacion-guards.md", "02-gestion-estado-ngrx.md"] },
  { q: "¿Cómo un Container component obtiene los datos del usuario autenticado del store y los pasa a un Presenter para mostrarlos en pantalla?", expected: ["08-patron-container-presenter.md", "02-gestion-estado-ngrx.md"] },
  { q: "¿Qué pasos hay desde que se desarrolla un nuevo microfrontend hasta que está desplegado en producción mediante Jenkins?", expected: ["03-microfrontends-web-components.md", "07-ci-cd-deployment.md"] },
  { q: "¿Cómo varía la URL de la API y la configuración de seguridad entre el entorno dev, pre y pro, y cómo lo gestiona el pipeline de CI/CD?", expected: ["05-configuracion-entornos.md", "07-ci-cd-deployment.md"] },
  { q: "Si un web component necesita mostrar información del usuario autenticado, ¿qué mecanismo usa para acceder al token JWT y cómo se lo pasa la app principal?", expected: ["03-microfrontends-web-components.md", "04-autenticacion-guards.md"] },
  { q: "¿Cómo afecta el uso de Capacitor a la gestión del token JWT y al almacenamiento local en dispositivos móviles iOS y Android?", expected: ["06-desarrollo-movil-capacitor.md", "04-autenticacion-guards.md"] },
  { q: "¿Qué ocurre en el store de NgRx y en los guards de ruta cuando el token JWT expira mientras el usuario navega por la aplicación?", expected: ["02-gestion-estado-ngrx.md", "04-autenticacion-guards.md"] },
  { q: "Explica cómo el patrón Container-Presenter y NgRx trabajan juntos para mantener la UI reactiva ante cambios de estado, evitando mutaciones directas", expected: ["08-patron-container-presenter.md", "02-gestion-estado-ngrx.md"] },
  { q: "¿Cuántos web components hay en el proyecto?", expected: ["01-arquitectura-general.md", "03-microfrontends-web-components.md"] },
  { q: "¿Cuántos web components hay en el proyecto y cuáles son? Lístalos todos", expected: ["03-microfrontends-web-components.md", "01-arquitectura-general.md"] },
];

const TOP_K = 5;

function hit(retrieved: Set<string>, expected: string[]): boolean {
  return expected.some(f => retrieved.has(f));
}

async function testEnsembleRetrieval() {
  console.log('Loading Qdrant vector store...');
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  console.log('Loading all documents for BM25...');
  const allDocuments = await getAllDocumentsFromQdrant();
  const childDocs = allDocuments.filter((doc: any) => {
    const meta = doc.metadata as any;
    return !meta?.parent_child?.is_parent;
  });
  console.log(`BM25 index: ${childDocs.length} child docs\n`);

  const vectorRetriever = vectorStore.asRetriever({ k: TOP_K + 5 });
  const bm25Retriever = new BM25Retriever({ documents: childDocs, k: TOP_K + 5 });
  const ensembleRetriever = new EnsembleRetriever({
    retrievers: [vectorRetriever as any, bm25Retriever as any],
    weights: [0.5, 0.5],
  });

  const vectorHits: boolean[] = [];
  const bm25Hits: boolean[] = [];
  const ensembleHits: boolean[] = [];

  const header = `${'#'.padStart(2)} ${'Question'.padEnd(70)} ${'VECTOR'.padEnd(7)} ${'BM25'.padEnd(6)} ${'ENSEMBLE'}`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, expected } = QUESTIONS[i];

    const [vectorResults, bm25Results, ensembleResults] = await Promise.all([
      vectorRetriever.invoke(q),
      bm25Retriever.invoke(q),
      ensembleRetriever.invoke(q),
    ]);

    const getFiles = (docs: any[]) => new Set(
      docs
        .filter(d => !d.metadata?.parent_child?.is_parent)
        .slice(0, TOP_K)
        .map(d => d.metadata?.filename as string)
    );

    const vectorFiles = getFiles(vectorResults);
    const bm25Files = getFiles(bm25Results);
    const ensembleFiles = getFiles(ensembleResults);

    const vHit = hit(vectorFiles, expected);
    const bHit = hit(bm25Files, expected);
    const eHit = hit(ensembleFiles, expected);

    vectorHits.push(vHit);
    bm25Hits.push(bHit);
    ensembleHits.push(eHit);

    const qShort = q.length > 69 ? q.substring(0, 66) + '...' : q;
    console.log(
      `${String(i + 1).padStart(2)} ${qShort.padEnd(70)} ${(vHit ? 'HIT' : 'MISS').padEnd(7)} ${(bHit ? 'HIT' : 'MISS').padEnd(6)} ${eHit ? 'HIT' : 'MISS'}`
    );
  }

  const total = QUESTIONS.length;
  const vTotal = vectorHits.filter(Boolean).length;
  const bTotal = bm25Hits.filter(Boolean).length;
  const eTotal = ensembleHits.filter(Boolean).length;

  console.log('\n' + '='.repeat(100));
  console.log('HIT RATE COMPARISON');
  console.log('='.repeat(100));
  console.log(`  Vector only:  ${vTotal}/${total} (${((vTotal / total) * 100).toFixed(0)}%)`);
  console.log(`  BM25 only:    ${bTotal}/${total} (${((bTotal / total) * 100).toFixed(0)}%)`);
  console.log(`  Ensemble:     ${eTotal}/${total} (${((eTotal / total) * 100).toFixed(0)}%)`);
  console.log('='.repeat(100));

  // Show MISS analysis
  const misses = QUESTIONS.filter((_, i) => !ensembleHits[i]);
  if (misses.length > 0) {
    console.log(`\nEnsemble MISSES (${misses.length}):`);
    misses.forEach(({ q, expected }) => {
      console.log(`  - "${q.substring(0, 70)}" → expected: ${expected.join(', ')}`);
    });
  }
}

testEnsembleRetrieval().catch(console.error);
