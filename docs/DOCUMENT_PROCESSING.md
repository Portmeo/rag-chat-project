# Procesamiento de Documentos y Sistema de Templates

Este documento explica en detalle cómo funciona el pipeline de ingesta de documentos, incluyendo el splitting inteligente, el sistema de templates para metadata y la estrategia de recuperación jerárquica (Parent-Child).

## 📋 Índice

1. [Flujo Completo (Parent-Child)](#flujo-completo-parent-child)
2. [Text Splitting Inteligente](#text-splitting-inteligente)
3. [Estrategia Parent-Child (Small-to-Big)](#estrategia-parent-child-small-to-big)
4. [Sistema de Templates y Metadata](#sistema-de-templates)
5. [Almacenamiento en Qdrant](#almacenamiento-en-qdrant)

## Flujo Completo (Parent-Child)

```
      archivo.md
          ↓
[1. Procesamiento Inicial]
          ↓
[2. Doble Splitting Inteligente]
    ↙           ↘
Hijos (128 chars) Padres (1000 chars)
    ↓               ↓
[3. Extracción de Metadata]
    ↓               ↓
[4. Indexación en Qdrant]
    ↓               ↓
Con Vector       Vector NULO (Storage)
```

## Text Splitting Inteligente

### Splitters Especializados

El sistema usa diferentes splitters según el tipo de documento para garantizar la integridad de la información técnica:

- **MarkdownTextSplitter**: Respeta headers, tablas y bloques de código.
- **RecursiveCharacterTextSplitter**: Para HTML y otros formatos, priorizando saltos de párrafo y oraciones.

## Estrategia Parent-Child (Small-to-Big)

Esta técnica separa la **unidad de búsqueda** de la **unidad de razonamiento**.

### 1. Generación de Chunks (`parentChildChunker.ts`)
El sistema procesa el documento dos veces en paralelo:
- **Hijos (Children)**: Fragmentos pequeños (ej: 128 caracteres). Son óptimos para que el motor de búsqueda (Vectorial y BM25) encuentre coincidencias exactas.
- **Padres (Parents)**: Fragmentos grandes (ej: 1000 caracteres). Contienen el contexto completo, código circundante y explicaciones detalladas.

### 2. Vinculación
Cada hijo se indexa con un ID de referencia `parent_doc_id`. Esto permite que, al encontrar un hijo relevante, el sistema "salte" automáticamente al bloque padre antes de enviar la información al LLM o al Reranker.

## Sistema de Templates

### Metadata Técnica
Ubicación: `apps/backend/src/services/documentProcessor/templates/technical.ts`

Cada fragmento (ya sea padre o hijo) es analizado para extraer:
- **Section Path**: Ruta jerárquica (ej: "Arquitectura > Auth > JWT").
- **Framework/Library**: Detección de Angular, Ionic, NgRx, etc.
- **Versión**: Extracción de números de versión de texto y JSON.
- **Content Type**: Identificación de si el fragmento es código, tabla o texto.

## Almacenamiento en Qdrant

### Estrategia de Vectores Nulos
Para optimizar Qdrant y evitar ruido en la búsqueda vectorial:

1.  **Hijos**: Se almacenan con sus **embeddings reales** (1024 dimensiones). Son los únicos que responden a búsquedas de similitud.
2.  **Padres**: Se almacenan con un **vector de ceros** (`[0, 0, 0, ...]`).
    - Son invisibles para la búsqueda vectorial.
    - **Filtrado BM25**: El motor BM25 también los ignora mediante filtros de metadatos (`is_parent: false`).
    - Solo se recuperan mediante su ID único cuando un hijo los referencia.

### Estructura de un Punto (Hijo)
```json
{
  "id": "uuid-hijo",
  "vector": [0.12, -0.45, ...],
  "payload": {
    "text": "Fragmento corto...",
    "metadata": {
      "parent_child": {
        "parent_doc_id": "id-del-padre",
        "is_parent": false
      }
    }
  }
}
```

### Estructura de un Punto (Padre)
```json
{
  "id": "id-del-padre",
  "vector": [0, 0, 0, ...], // Vector nulo
  "payload": {
    "text": "Bloque de contexto completo (1000 chars)...",
    "metadata": {
      "parent_child": {
        "is_parent": true
      }
    }
  }
}
```

## Ventajas de esta Implementación
- **Alta Precisión**: Los fragmentos pequeños reducen el ruido en el cálculo de similitud.
- **Contexto Rico**: El LLM nunca recibe frases cortadas; siempre ve el bloque lógico completo.
- **Eficiencia**: La recuperación de padres se hace en una sola consulta por lote (`Match Any ID`), minimizando la latencia.
