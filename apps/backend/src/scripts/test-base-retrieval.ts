import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { qdrantClient, COLLECTION_NAME } from '../repositories/qdrantRepository';
import { embeddings } from '../services/rag/config';

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

async function testBaseRetrieval() {
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  let hits = 0;
  let total = 0;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, expected } = QUESTIONS[i];
    console.log(`\n[${i + 1}/${QUESTIONS.length}] ${q}`);
    console.log(`Expected: ${expected.join(', ')}`);
    console.log('-'.repeat(80));

    const results = await vectorStore.similaritySearchWithScore(q, TOP_K + 5);

    // Filter out parent chunks (null vectors - not meaningful for base retrieval)
    const childResults = results.filter(([doc]) => {
      const meta = doc.metadata as any;
      return !meta?.parent_child?.is_parent;
    }).slice(0, TOP_K);

    const retrievedFiles = new Set(childResults.map(([doc]) => (doc.metadata as any).filename));

    for (const [doc, score] of childResults) {
      const filename = (doc.metadata as any).filename || 'unknown';
      const preview = doc.pageContent.replace(/\n/g, ' ').substring(0, 150);
      console.log(`  [${score.toFixed(4)}] ${filename}`);
      console.log(`         ${preview}...`);
    }

    const hit = expected.some(f => retrievedFiles.has(f));
    total++;
    if (hit) hits++;
    console.log(hit ? `  HIT` : `  MISS - got: ${[...retrievedFiles].join(', ')}`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`BASE RETRIEVAL HIT RATE: ${hits}/${total} (${((hits / total) * 100).toFixed(0)}%)`);
  console.log(`(Pure vector search, no BM25, no reranker, no parent-child, no multi-query)`);
}

testBaseRetrieval().catch(console.error);
