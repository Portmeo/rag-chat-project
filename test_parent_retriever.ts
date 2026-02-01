#!/usr/bin/env bun
import { addDocumentToVectorStore, queryRAG } from './apps/backend/src/services/rag/index';

async function testParentRetriever() {
  console.log('🧪 Testing Parent Document Retriever\n');

  // 1. Agregar documento de prueba
  const testDoc = `
# NgRx Store
NgRx es una librería de gestión de estado para aplicaciones Angular basada en Redux.

## Características Principales
- Store centralizado para toda la aplicación
- Acciones inmutables que describen cambios
- Efectos para side effects y llamadas asíncronas
- Selectors para consultar el estado eficientemente

## Instalación
Para instalar NgRx Store en tu proyecto Angular:
npm install @ngrx/store

## Conceptos Básicos

### State
El estado es un objeto inmutable que representa el estado de tu aplicación.

### Actions
Las acciones son eventos que ocurren en la aplicación.

### Reducers
Los reducers especifican cómo cambia el estado en respuesta a acciones.
  `.repeat(3); // Generar documento más grande

  console.log('📄 Adding test document...');
  const result = await addDocumentToVectorStore(testDoc, 'test-ngrx.md', new Date().toISOString());
  console.log(`✅ Document added: ${result.chunksCount} chunks created\n`);

  // 2. Hacer query
  console.log('🔍 Querying: ¿Qué es NgRx?\n');
  const ragResult = await queryRAG('¿Qué es NgRx?', {});

  console.log('✅ Answer:', ragResult.answer.substring(0, 200) + '...');
  console.log('\n📦 Sources:', ragResult.sources.length);

  // 3. Verificar que se usaron parents
  if (ragResult.sources.length > 0) {
    const firstSource = ragResult.sources[0];
    console.log('\n🔍 First source metadata:');
    console.log('  - filename:', firstSource.filename);
    console.log('  - chunk_index:', firstSource.chunk_index);

    if (firstSource.parent_child) {
      console.log('  - parent_doc_id:', firstSource.parent_child.parent_doc_id);
      console.log('  - is_parent:', firstSource.parent_child.is_parent);
      console.log('  - child_chunk_size:', firstSource.parent_child.child_chunk_size);
      console.log('  - parent_chunk_size:', firstSource.parent_child.parent_chunk_size);
      console.log('  - ✅ Parent Document Retriever ENABLED');
    } else {
      console.log('  - ⚠️  No parent_child metadata (classic mode)');
    }
  }

  console.log('\n🎉 Test completed!');
  process.exit(0);
}

testParentRetriever().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
