# Benchmarks de Modelos de Embeddings

Benchmarks exhaustivos para seleccionar el mejor modelo de embeddings para el sistema RAG.

## 📁 Archivos

### Scripts de Benchmark

- **`fair_benchmark.py`** - Round 1: Benchmark justo con prefijos específicos por modelo
- **`round2_optimized_benchmark.py`** - Round 2: Benchmark optimizado con instrucciones oficiales
- **`QUERIES_PROFUNDAS.md`** - Documentación de las 16 queries de prueba

### Resultados

#### Round 1 - Fair Benchmark
- **Archivo**: `fair_benchmark_results_20260131_090432.json`
- **Log**: `fair_benchmark_run.log`
- **Objetivo**: Comparación justa aplicando configuración específica por modelo

**Resultados**:
```
Model                    R@1    R@5    MRR   Found
-------------------------------------------------------
mxbai-embed-large       75%    94%   0.844  15/16  ✅
bge-m3                  56%    81%   0.625  15/16
nomic-embed-text        50%    81%   0.608  15/16
snowflake-arctic        19%    69%   0.393  14/16
```

#### Round 2 - Optimized Benchmark
- **Archivo**: `round2_optimized_results_20260131_093142.json`
- **Log**: `round2_run.log`
- **Objetivo**: Máximo potencial con instrucciones oficiales

**Mejora Round 1 → Round 2**:
- mxbai: **MRR 0.844 → 0.875** (+3.7%) con instrucción oficial

**Resultados Finales**:
```
Model                    R@1    R@5    MRR   Found
-------------------------------------------------------
mxbai-embed-large       81%    94%   0.875  15/16  🏆
nomic-embed-text        50%    81%   0.608  15/16
snowflake-arctic        12%    69%   0.392  14/16
```

## 🏆 Ganador: mxbai-embed-large

**Por qué ganó:**
- 81% Recall@1 (respuesta correcta en primera posición)
- 94% Recall@5 (encuentra respuesta en top 5)
- MRR 0.875 (ranking promedio: 1.14)
- Excelente comprensión semántica
- 1024 dimensiones (más información)

**Configuración ganadora:**
```python
{
    "name": "mxbai-embed-large",
    "query_prefix": "Represent this sentence for searching relevant passages: ",
    "doc_prefix": "",
    "vector_size": 1024
}
```

## 📊 Métricas Explicadas

- **Recall@K**: % de queries donde la respuesta correcta está en top K
- **MRR (Mean Reciprocal Rank)**: Promedio de 1/rank (1.0 = siempre en posición 1)
- **Found**: Cuántas queries encontraron el documento correcto

## 🧪 Tipos de Queries

Las 16 queries cubren 5 categorías (ver `QUERIES_PROFUNDAS.md`):

1. **Básicas** (Keywords exactas)
   - "Angular Ionic version"
   - "versión de Angular"

2. **Conceptuales** (Comprensión semántica)
   - "¿Por qué se usa NgRx?"
   - "¿Cuáles son las ventajas de microfrontends?"

3. **Relacionales** (Conectar conceptos)
   - "¿Cómo se integran web components en Angular?"

4. **Proceso** (Flujos y secuencias)
   - "¿Cómo funciona el flujo de autenticación con JWT?"

5. **Comparativas** (Diferencias)
   - "diferencia entre container y presenter components"

## 🔧 Cómo Ejecutar los Benchmarks

### Requisitos
```bash
pip install qdrant-client ollama requests
```

### Round 1 (Fair)
```bash
python fair_benchmark.py
```

### Round 2 (Optimized)
```bash
python round2_optimized_benchmark.py
```

## 📈 Lecciones Aprendidas

1. **Configuración específica importa**: Cada modelo tiene requisitos únicos
   - nomic necesita prefijos (`search_query:`, `search_document:`)
   - mxbai mejora +3.7% con instrucción oficial

2. **Dimensionalidad ayuda**: 1024d (mxbai) > 768d (nomic)

3. **Queries diversas son críticas**: Necesitas probar diferentes tipos de preguntas

4. **Ground truth simplificado**: Verificar solo archivo correcto (no términos exactos)

## 🎯 Decisión Final

**Modelo elegido**: `mxbai-embed-large`
- Usado en producción con configuración optimizada
- Combinado con BM25 (70/30) y reranking
- Resultado final: 85.7% accuracy end-to-end
