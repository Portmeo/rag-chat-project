# Test del Evaluador RAGAS Separado

## Verificación Rápida

### 1. Verificar estructura de archivos

```bash
# Verificar que existe el nuevo proyecto
ls -la apps/evaluation/src/

# Debe mostrar:
# - index.ts
# - types.ts
# - ragasEvaluator.ts
# - errorAnalyzer.ts
# - reportGenerator.ts
# - datasetLoader.ts
```

### 2. Verificar que el backend está limpio

```bash
# No debe existir:
ls apps/backend/src/services/evaluation/
# Error esperado: No such file or directory ✅

# No debe existir:
ls apps/backend/src/controllers/evaluationController.ts
# Error esperado: No such file or directory ✅
```

### 3. Verificar imports

```bash
# Desde raíz del proyecto
bun -e "import { RAGASEvaluator, loadDataset, validateDataset, ReportGenerator } from './apps/evaluation/src/index.ts'; console.log('✅ Imports correctos');"

# Debe mostrar: ✅ Imports correctos
```

### 4. Verificar que no hay contaminación en backend

```bash
# Buscar referencias a evaluación
grep -r "evaluation" apps/backend/src/ 2>/dev/null
# Debe retornar vacío ✅

# Buscar includeAllSources
grep -r "includeAllSources" apps/backend/src/ 2>/dev/null
# Debe retornar vacío ✅

# Buscar campo text? en RAGSource
grep "text?" apps/backend/src/services/rag/types.ts
# Debe retornar vacío ✅
```

## Test End-to-End (Requiere Backend Corriendo)

### Paso 1: Iniciar backend

```bash
cd apps/backend
bun run dev

# Esperar mensaje:
# 🚀 Backend running on http://localhost:3001
```

### Paso 2: Crear test simple

Crear archivo `test_evaluator_http.ts` en raíz:

```typescript
#!/usr/bin/env bun
import { RAGASEvaluator } from './apps/evaluation/src';

console.log('🧪 Testing RAGAS Evaluator with HTTP API...\n');

const evaluator = new RAGASEvaluator('http://localhost:3001');

const testCase = {
  id: 'test_http_api',
  category: 'test',
  question: '¿Qué es NgRx?',
  ground_truth_answer: 'NgRx es una librería de gestión de estado para aplicaciones Angular',
  expected_contexts: ['02-gestion-estado-ngrx.md']
};

try {
  console.log('📡 Calling backend via HTTP API...');
  const result = await evaluator.evaluateSingleCase(testCase);

  console.log('\n✅ Evaluation completed successfully!\n');
  console.log('Metrics:');
  console.log(`  Faithfulness: ${result.faithfulness_score.toFixed(2)}`);
  console.log(`  Answer Relevancy: ${result.answer_relevancy_score.toFixed(2)}`);
  console.log(`  Context Precision: ${result.context_precision_score.toFixed(2)}`);
  console.log(`  Context Recall: ${result.context_recall_score.toFixed(2)}`);
  console.log(`\nAnswer: ${result.generated_answer.substring(0, 200)}...`);
  console.log(`\nSources: ${result.retrieved_sources.join(', ')}`);

  console.log('\n🎉 HTTP API integration works correctly!');
} catch (error: any) {
  console.error('\n❌ Test failed:', error.message);
  console.error('\nMake sure:');
  console.error('  1. Backend is running on http://localhost:3001');
  console.error('  2. You have documents uploaded in uploads/ directory');
  console.error('  3. Ollama is running with llama3.1:8b and mxbai-embed-large');
  process.exit(1);
}
```

### Paso 3: Ejecutar test

```bash
bun test_evaluator_http.ts
```

**Output esperado:**

```
🧪 Testing RAGAS Evaluator with HTTP API...

📡 Calling backend via HTTP API...

🧪 Evaluating: ¿Qué es NgRx?
✅ Core Metrics - F: 0.90, AR: 0.85, CP: 0.75, CR: 1.00
✅ Additional - CRel: 0.60, AC: 0.80, AS: 0.50, ACom: 0.90
✅ Hallucination Score: 0.80 (0 detected)

✅ Evaluation completed successfully!

Metrics:
  Faithfulness: 0.90
  Answer Relevancy: 0.85
  Context Precision: 0.75
  Context Recall: 1.00

Answer: NgRx es una librería de gestión de estado basada en Redux para aplicaciones Angular. Proporciona un store centralizado...

Sources: 02-gestion-estado-ngrx.md

🎉 HTTP API integration works correctly!
```

## Test de Benchmark Completo

### Ejecutar con dataset limitado

```bash
bun run benchmark/evaluation/run_full_benchmark.ts --limit 5
```

**Debe:**
1. ✅ Conectar al backend vía HTTP
2. ✅ Evaluar 5 casos de test
3. ✅ Generar reporte JSON y Markdown
4. ✅ Mostrar métricas agregadas
5. ✅ No mostrar errores de imports

## Posibles Errores y Soluciones

### Error: "Cannot find module"

**Causa:** Imports incorrectos en scripts de benchmark

**Solución:**
```bash
# Verificar que los imports sean:
import { RAGASEvaluator, loadDataset } from '../../apps/evaluation/src';
# NO:
import { RAGASEvaluator } from '../../apps/backend/src/services/evaluation/ragasEvaluator';
```

### Error: "RAG API failed (500)"

**Causa:** Backend no está corriendo

**Solución:**
```bash
cd apps/backend
bun run dev
```

### Error: "Could not read [filename]"

**Causa:** Archivos no están en `uploads/` directory

**Solución:**
```bash
# Verificar que existen documentos
ls uploads/

# Si no hay archivos, subir documentos vía API o frontend
```

### Error: "Connection refused"

**Causa:** Backend no está en puerto 3001

**Solución:**
```typescript
// Cambiar URL en constructor
const evaluator = new RAGASEvaluator('http://localhost:OTRO_PUERTO');
```

## Checklist de Verificación

- [ ] Estructura de archivos correcta en `apps/evaluation/`
- [ ] Backend limpio (no hay `evaluation/` directory)
- [ ] Imports funcionan correctamente
- [ ] No hay referencias a "evaluation" en backend
- [ ] No hay referencias a "includeAllSources" en backend
- [ ] Campo `text?` removido de `RAGSource`
- [ ] Test simple funciona (con backend corriendo)
- [ ] Benchmark completo funciona (--limit 5)
- [ ] Reportes se generan correctamente

## Resultado Esperado

✅ **Separación exitosa:** El evaluador RAGAS está completamente independiente del backend y funciona vía HTTP API.

✅ **Backend puro:** No hay código de evaluación contaminando el servicio RAG de producción.

✅ **Testing realista:** El evaluador testea el stack HTTP completo, no solo la función interna.
