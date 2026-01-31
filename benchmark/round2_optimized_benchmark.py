#!/usr/bin/env python3
"""
Round 2 - Benchmark Optimizado
===============================

Compara los top 3 modelos con sus configuraciones ÓPTIMAS:
1. nomic-embed-text (con prefijos obligatorios)
2. mxbai-embed-large (con instrucción oficial)
3. snowflake-arctic-embed (texto plano)

Objetivo: Ver el máximo potencial de cada modelo.
"""

import json
import subprocess
import time
import os
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime

# =============================================================================
# CONFIGURACIÓN
# =============================================================================

MODELS_TO_TEST = [
    # 1. Nomic (necesita prefijos)
    {
        "name": "nomic-embed-text",
        "query_prefix": "search_query: ",
        "doc_prefix": "search_document: ",
        "vector_size": 768,
        "description": "Con prefijos obligatorios"
    },
    # 2. Mxbai (instrucción oficial)
    {
        "name": "mxbai-embed-large",
        "query_prefix": "Represent this sentence for searching relevant passages: ",
        "doc_prefix": "",  # Documentos en texto plano
        "vector_size": 1024,
        "description": "Con instrucción oficial optimizada"
    },
    # 3. Snowflake (texto plano)
    {
        "name": "snowflake-arctic-embed:335m",
        "query_prefix": "",
        "doc_prefix": "",
        "vector_size": 1024,
        "description": "Texto plano (configuración natural)"
    },
]

# Directorio con documentos .md
DOCS_DIR = Path("/Users/alejandro.exposito/Projects/rag-chat-project/files")

# Configuración Qdrant
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "documents"

# Configuración Ollama
OLLAMA_URL = "http://localhost:11434"

# Queries de prueba (las mismas que Round 1)
TEST_QUERIES = [
    # ===== BÁSICAS (4) =====
    {
        "query": "Angular Ionic version",
        "target_file": "01-arquitectura-general.md",
        "category": "Básica"
    },
    {
        "query": "versión de Angular",
        "target_file": "01-arquitectura-general.md",
        "category": "Básica"
    },
    {
        "query": "¿Qué versión de Ionic se usa?",
        "target_file": "01-arquitectura-general.md",
        "category": "Básica"
    },
    {
        "query": "stack tecnológico del proyecto",
        "target_file": "01-arquitectura-general.md",
        "category": "Básica"
    },

    # ===== CONCEPTUALES (3) =====
    {
        "query": "¿Por qué se usa NgRx para gestionar el estado?",
        "target_file": "02-gestion-estado-ngrx.md",
        "category": "Conceptual"
    },
    {
        "query": "¿Cuáles son las ventajas de usar microfrontends?",
        "target_file": "03-microfrontends-web-components.md",
        "category": "Conceptual"
    },
    {
        "query": "¿Qué beneficios tiene el patrón container-presenter?",
        "target_file": "08-patron-container-presenter.md",
        "category": "Conceptual"
    },

    # ===== DE RELACIÓN (3) =====
    {
        "query": "¿Cómo se integran los web components en Angular?",
        "target_file": "03-microfrontends-web-components.md",
        "category": "Relación"
    },
    {
        "query": "¿Qué relación hay entre NgRx y la arquitectura de la app?",
        "target_file": "02-gestion-estado-ngrx.md",
        "category": "Relación"
    },
    {
        "query": "¿Cómo se conectan los microfrontends con el proyecto principal?",
        "target_file": "03-microfrontends-web-components.md",
        "category": "Relación"
    },

    # ===== DE PROCESO/FLUJO (3) =====
    {
        "query": "¿Cómo funciona el flujo de autenticación con JWT?",
        "target_file": "04-autenticacion-guards.md",
        "category": "Proceso"
    },
    {
        "query": "¿Qué pasa cuando un usuario hace login?",
        "target_file": "04-autenticacion-guards.md",
        "category": "Proceso"
    },
    {
        "query": "¿Cómo se gestionan las llamadas asíncronas en NgRx?",
        "target_file": "02-gestion-estado-ngrx.md",
        "category": "Proceso"
    },

    # ===== COMPARATIVAS (3) =====
    {
        "query": "diferencia entre container y presenter components",
        "target_file": "08-patron-container-presenter.md",
        "category": "Comparativa"
    },
    {
        "query": "¿Cuándo usar guards vs interceptors?",
        "target_file": "04-autenticacion-guards.md",
        "category": "Comparativa"
    },
    {
        "query": "ventajas de JWT vs sesiones tradicionales",
        "target_file": "04-autenticacion-guards.md",
        "category": "Comparativa"
    },
]

# =============================================================================
# FUNCIONES DE QDRANT
# =============================================================================

def delete_collection():
    """Elimina la colección si existe."""
    subprocess.run(
        ['curl', '-s', '-X', 'DELETE', f'{QDRANT_URL}/collections/{COLLECTION_NAME}'],
        capture_output=True
    )
    time.sleep(1)


def create_collection(vector_size: int):
    """Crea la colección con el tamaño de vector especificado."""
    collection_config = {
        "vectors": {
            "size": vector_size,
            "distance": "Cosine"
        }
    }

    subprocess.run(
        ['curl', '-s', '-X', 'PUT', f'{QDRANT_URL}/collections/{COLLECTION_NAME}',
         '-H', 'Content-Type: application/json',
         '-d', json.dumps(collection_config)],
        capture_output=True
    )
    time.sleep(1)


def get_model_vector_size(model_name: str) -> int:
    """Detecta el tamaño del vector de un modelo."""
    result = subprocess.run(
        ['curl', '-s', '-X', 'POST', f'{OLLAMA_URL}/api/embeddings',
         '-d', json.dumps({"model": model_name, "prompt": "test"})],
        capture_output=True,
        text=True
    )

    data = json.loads(result.stdout)
    embedding = data.get('embedding', [])
    return len(embedding)


# =============================================================================
# FUNCIONES DE EMBEDDINGS CON PREFIJOS/INSTRUCCIONES
# =============================================================================

def get_embedding(model_config: Dict, text: str, is_query: bool = True) -> List[float]:
    """
    Obtiene el embedding de un texto CON PREFIJOS/INSTRUCCIONES CORRECTOS.

    Args:
        model_config: Dict con name, query_prefix, doc_prefix
        text: El texto a embedear
        is_query: True si es una query, False si es un documento
    """
    prefix = model_config["query_prefix"] if is_query else model_config["doc_prefix"]
    prefixed_text = f"{prefix}{text}"

    result = subprocess.run(
        ['curl', '-s', '-X', 'POST', f'{OLLAMA_URL}/api/embeddings',
         '-d', json.dumps({"model": model_config["name"], "prompt": prefixed_text})],
        capture_output=True,
        text=True
    )

    data = json.loads(result.stdout)
    return data.get('embedding', [])


def index_documents(model_config: Dict) -> int:
    """Indexa todos los documentos con el modelo especificado."""
    md_files = sorted(DOCS_DIR.glob("*.md"))
    total_chunks = 0

    for md_file in md_files:
        content = md_file.read_text(encoding='utf-8')

        # Chunking simple (1000 chars, 200 overlap)
        chunks = []
        chunk_size = 1000
        overlap = 200

        for i in range(0, len(content), chunk_size - overlap):
            chunk_text = content[i:i + chunk_size]
            if chunk_text.strip():
                chunks.append(chunk_text)

        # Indexar cada chunk
        for chunk_idx, chunk_text in enumerate(chunks):
            # Embedear con prefijo de documento
            embedding = get_embedding(model_config, chunk_text, is_query=False)

            point = {
                "id": total_chunks,
                "vector": embedding,
                "payload": {
                    "text": chunk_text,
                    "metadata": {
                        "filename": md_file.name,
                        "chunk_index": chunk_idx
                    }
                }
            }

            # Insertar en Qdrant
            subprocess.run(
                ['curl', '-s', '-X', 'PUT',
                 f'{QDRANT_URL}/collections/{COLLECTION_NAME}/points',
                 '-H', 'Content-Type: application/json',
                 '-d', json.dumps({"points": [point]})],
                capture_output=True
            )

            total_chunks += 1

    time.sleep(2)  # Esperar a que Qdrant procese
    return total_chunks


def search_qdrant(embedding: List[float], limit: int = 10) -> List[Dict]:
    """Busca en Qdrant usando un embedding."""
    search_data = {
        'vector': embedding,
        'limit': limit,
        'with_payload': True
    }

    result = subprocess.run(
        ['curl', '-s', '-X', 'POST',
         f'{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search',
         '-H', 'Content-Type: application/json',
         '-d', json.dumps(search_data)],
        capture_output=True,
        text=True
    )

    response = json.loads(result.stdout)
    return response.get('result', [])


# =============================================================================
# EVALUACIÓN
# =============================================================================

def find_target_rank(target_file: str, results: List[Dict]) -> Tuple[int, float]:
    """
    Encuentra la posición del archivo objetivo.
    Returns: (rank, score) donde rank=-1 si no se encuentra
    """
    for idx, result in enumerate(results):
        filename = result['payload']['metadata'].get('filename', '')
        if target_file in filename:
            return idx + 1, result['score']

    return -1, 0.0


def calculate_metrics(ranks: List[int]) -> Dict:
    """Calcula métricas de evaluación."""
    valid_ranks = [r for r in ranks if r > 0]

    return {
        'recall@1': sum(1 for r in ranks if r == 1) / len(ranks) if ranks else 0,
        'recall@3': sum(1 for r in ranks if 0 < r <= 3) / len(ranks) if ranks else 0,
        'recall@5': sum(1 for r in ranks if 0 < r <= 5) / len(ranks) if ranks else 0,
        'recall@10': sum(1 for r in ranks if 0 < r <= 10) / len(ranks) if ranks else 0,
        'mrr': sum(1/r for r in valid_ranks) / len(ranks) if ranks else 0,
        'avg_rank': sum(valid_ranks) / len(valid_ranks) if valid_ranks else -1,
        'found': len(valid_ranks),
        'total': len(ranks)
    }


# =============================================================================
# BENCHMARK
# =============================================================================

def run_benchmark(model_config: Dict) -> Dict:
    """Ejecuta benchmark para un modelo."""
    print(f"\n{'='*70}")
    print(f"🧪 {model_config['name']}")
    print(f"   {model_config['description']}")
    print(f"   Query prefix: '{model_config['query_prefix'][:50]}...' " if len(model_config['query_prefix']) > 50 else f"   Query prefix: '{model_config['query_prefix']}'")
    print(f"{'='*70}")

    # Detectar vector size
    vector_size = get_model_vector_size(model_config['name'])
    print(f"   Vector size: {vector_size}")

    # Re-crear colección
    delete_collection()
    create_collection(vector_size)
    print(f"   ✓ Colección creada")

    # Indexar documentos
    total_chunks = index_documents(model_config)
    print(f"   ✓ {total_chunks} chunks indexados")

    # Probar queries
    results_by_category = {
        'Básica': [],
        'Conceptual': [],
        'Relación': [],
        'Proceso': [],
        'Comparativa': []
    }

    all_ranks = []

    for i, test in enumerate(TEST_QUERIES, 1):
        query = test['query']
        target = test['target_file']
        category = test['category']

        # Obtener embedding de query CON PREFIJO/INSTRUCCIÓN
        embedding = get_embedding(model_config, query, is_query=True)

        # Buscar
        search_results = search_qdrant(embedding, limit=10)

        # Evaluar
        rank, score = find_target_rank(target, search_results)
        all_ranks.append(rank)
        results_by_category[category].append(rank)

        # Log conciso
        status = f"✅ Rank {rank}" if rank > 0 else "❌ Not found"
        print(f"   [{i:2d}/16] {status:15s} | {query[:40]}")

    # Calcular métricas
    overall_metrics = calculate_metrics(all_ranks)

    category_metrics = {}
    for cat, ranks in results_by_category.items():
        category_metrics[cat] = calculate_metrics(ranks)

    return {
        'model': model_config['name'],
        'description': model_config['description'],
        'overall': overall_metrics,
        'by_category': category_metrics,
        'all_ranks': all_ranks
    }


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("\n" + "="*70)
    print("🚀 ROUND 2 - BENCHMARK OPTIMIZADO")
    print("="*70)
    print(f"\nModelos: {len(MODELS_TO_TEST)}")
    print(f"Queries: {len(TEST_QUERIES)}")
    print(f"\nObjetivo: Ver el máximo potencial de cada modelo")
    print("  - nomic: Con prefijos obligatorios")
    print("  - mxbai: Con instrucción oficial")
    print("  - snowflake: Texto plano natural")

    if not DOCS_DIR.exists():
        print(f"\n❌ ERROR: {DOCS_DIR} no existe")
        return

    all_results = []

    # Ejecutar benchmark para cada modelo
    for model_config in MODELS_TO_TEST:
        try:
            result = run_benchmark(model_config)
            all_results.append(result)
        except Exception as e:
            print(f"\n❌ Error con {model_config['name']}: {e}")
            continue

    # Guardar resultados
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"round2_optimized_results_{timestamp}.json"

    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2)

    print(f"\n💾 Guardado en: {output_file}")

    # Mostrar tabla comparativa
    print("\n" + "="*70)
    print("📊 RESULTADOS COMPARATIVOS - ROUND 2")
    print("="*70)

    # Tabla general
    print(f"\n{'Model':<30} {'R@1':>6} {'R@3':>6} {'R@5':>6} {'R@10':>6} {'MRR':>6} {'Found':>7}")
    print("-" * 70)

    for result in all_results:
        m = result['overall']
        print(f"{result['model']:<30} "
              f"{m['recall@1']*100:>5.0f}% "
              f"{m['recall@3']*100:>5.0f}% "
              f"{m['recall@5']*100:>5.0f}% "
              f"{m['recall@10']*100:>5.0f}% "
              f"{m['mrr']:>6.3f} "
              f"{m['found']:>2d}/{m['total']:>2d}")

    # Comparación con Round 1
    print("\n" + "="*70)
    print("📈 COMPARACIÓN: Round 1 vs Round 2")
    print("="*70)

    round1_results = {
        'nomic-embed-text': {'mrr': 0.608, 'recall@5': 0.81},
        'mxbai-embed-large': {'mrr': 0.844, 'recall@5': 0.94},
        'snowflake-arctic-embed:335m': {'mrr': 0.392, 'recall@5': 0.69},
    }

    for result in all_results:
        model = result['model']
        if model in round1_results:
            r1 = round1_results[model]
            r2 = result['overall']

            mrr_diff = (r2['mrr'] - r1['mrr']) / r1['mrr'] * 100 if r1['mrr'] > 0 else 0
            r5_diff = (r2['recall@5'] - r1['recall@5']) / r1['recall@5'] * 100 if r1['recall@5'] > 0 else 0

            print(f"\n{model}:")
            print(f"  MRR:       {r1['mrr']:.3f} → {r2['mrr']:.3f} ({mrr_diff:+.1f}%)")
            print(f"  Recall@5:  {r1['recall@5']*100:.0f}% → {r2['recall@5']*100:.0f}% ({r5_diff:+.1f}%)")

    # Ganador
    print("\n" + "="*70)
    best = max(all_results, key=lambda x: x['overall']['mrr'])
    print(f"🏆 GANADOR: {best['model']}")
    print(f"   {best['description']}")
    print(f"   MRR: {best['overall']['mrr']:.3f}")
    print(f"   Recall@5: {best['overall']['recall@5']*100:.0f}%")
    print(f"   Encontradas: {best['overall']['found']}/{best['overall']['total']}")

    print("\n✅ Round 2 completado\n")


if __name__ == "__main__":
    main()
