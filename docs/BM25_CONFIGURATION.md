# Configuración del Sistema RAG - BM25 Retriever

## Descripción

El sistema RAG ahora soporta configuración flexible del retriever BM25 mediante variables de entorno. Esto permite:

- ✅ Activar/desactivar BM25 keyword search
- ✅ Ajustar pesos entre búsqueda vectorial y búsqueda por keywords
- ✅ Comparar rendimiento entre diferentes configuraciones
- ✅ Optimizar para diferentes tipos de documentación

## Variables de Entorno

Configurar en `.env`:

```bash
# Activar/desactivar BM25 (true/false)
USE_BM25_RETRIEVER=true

# Peso para BM25 keyword search (0.0 - 1.0)
BM25_WEIGHT=0.8

# Peso para búsqueda vectorial semántica (0.0 - 1.0)
# Nota: BM25_WEIGHT + VECTOR_WEIGHT debe sumar 1.0
VECTOR_WEIGHT=0.2
```

## Configuraciones Recomendadas

### 1. Configuración Actual (Recomendada para Docs Técnicos)
```bash
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.8
VECTOR_WEIGHT=0.2
```

**Cuándo usar:**
- Documentación técnica con terminología específica
- Queries sobre versiones, nombres de librerías, comandos
- Cuando las keywords importan más que el contexto

**Ventajas:**
- Excelente para búsquedas exactas ("Angular 15", "Ionic 6")
- Rápido y eficiente
- Funciona bien en español técnico

**Desventajas:**
- Menos efectivo para preguntas conceptuales
- Necesita keywords exactos o similares

### 2. Solo BM25 (Máxima Precisión Keywords)
```bash
USE_BM25_RETRIEVER=true
BM25_WEIGHT=1.0
VECTOR_WEIGHT=0.0
```

**Cuándo usar:**
- Embeddings no funcionan bien para tu dominio
- Prioridad absoluta en matches exactos
- Testing y comparación de rendimiento

**Ventajas:**
- Máxima precisión en keywords
- No depende de calidad de embeddings
- Muy rápido

**Desventajas:**
- Pierde completamente búsqueda semántica
- No encuentra sinónimos o conceptos relacionados

### 3. Solo Vector Search (Máxima Semántica)
```bash
USE_BM25_RETRIEVER=false
BM25_WEIGHT=0.0
VECTOR_WEIGHT=1.0
```

**Cuándo usar:**
- Embeddings de muy alta calidad
- Queries conceptuales más que keywords
- Documentación narrativa/explicativa

**Ventajas:**
- Encuentra resultados por significado
- Funciona con parafraseo
- Bueno para preguntas abiertas

**Desventajas:**
- Puede fallar en keywords técnicos específicos
- Más lento que BM25
- Depende de calidad del modelo de embeddings

### 4. Balance 50/50 (General Purpose)
```bash
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.5
VECTOR_WEIGHT=0.5
```

**Cuándo usar:**
- Documentación mixta (técnica + narrativa)
- No estás seguro qué configuración usar
- Quieres balance entre exactitud y semántica

**Ventajas:**
- Balance entre ambos enfoques
- Versatilidad

**Desventajas:**
- No optimizado para ningún caso específico
- Puede diluir resultados buenos de un retriever con malos del otro

## Cómo Cambiar Configuración

### 1. Editar .env
```bash
cd apps/backend
nano .env  # o tu editor favorito
```

### 2. Modificar valores
```bash
USE_BM25_RETRIEVER=true
BM25_WEIGHT=0.8
VECTOR_WEIGHT=0.2
```

### 3. Reiniciar servidor
El servidor con `--watch` recargará automáticamente al detectar cambios en archivos de código, pero para cambios en `.env` necesitas reiniciar manualmente:

```bash
# Si usas npm run dev --watch, detén (Ctrl+C) y reinicia
npm run dev --watch src/index.ts
```

## Logs y Debugging

El sistema ahora muestra en consola qué configuración está usando:

```bash
# BM25 habilitado
🔧 Using Ensemble Retriever (Vector: 0.2, BM25: 0.8)

# BM25 deshabilitado
🔧 Using Vector-only Retriever (BM25 disabled)

# BM25 habilitado pero falló
⚠️  BM25 cache failed to build, falling back to vector-only search

# BM25 deshabilitado explícitamente
⏭️  BM25 retriever is disabled, skipping cache rebuild
```

## Testing de Configuraciones

### Test Case Básico
```bash
curl -X POST http://localhost:3001/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"question":"¿Qué versión de Angular se usa?"}'
```

### Casos de Prueba Recomendados

1. **Keywords Exactos:**
   - "¿Qué versión de Angular se usa?"
   - "¿Qué versión de Ionic se usa?"
   - Resultado esperado: Debe encontrar "Angular 15" e "Ionic 6"

2. **Búsqueda Conceptual:**
   - "¿Cómo funciona la autenticación?"
   - "¿Qué arquitectura usa el proyecto?"
   - Resultado esperado: Debe devolver info relevante aunque no use keywords exactos

3. **Nombres Técnicos:**
   - "¿Qué web components hay?"
   - "¿Qué plugins de Capacitor se usan?"
   - Resultado esperado: Listas específicas

### Comparar Configuraciones

1. Probar con `BM25_WEIGHT=0.8`:
   ```bash
   curl -X POST http://localhost:3001/api/chat/query \
     -H "Content-Type: application/json" \
     -d '{"question":"Angular version"}' | jq .
   ```

2. Cambiar a `USE_BM25_RETRIEVER=false`

3. Probar misma query y comparar resultados

4. Documentar cuál funciona mejor para tu caso de uso

## Troubleshooting

### Problema: BM25 no se activa
**Síntoma:** Logs muestran "BM25 disabled" aunque `USE_BM25_RETRIEVER=true`

**Solución:**
1. Verificar que `.env` existe en `apps/backend/`
2. Verificar sintaxis: `USE_BM25_RETRIEVER=true` (sin espacios, sin comillas)
3. Reiniciar servidor completamente

### Problema: Weights no suman 1.0
**Síntoma:** Error o advertencia sobre weights

**Solución:**
```bash
# Asegurar que sumen exactamente 1.0
BM25_WEIGHT=0.7
VECTOR_WEIGHT=0.3  # 0.7 + 0.3 = 1.0 ✓
```

### Problema: Performance degradado
**Síntoma:** Queries muy lentas

**Posibles causas:**
1. **BM25 cache no construido:** Verificar logs de "Rebuilding BM25 cache"
2. **Demasiados documentos:** BM25 se reconstruye en cada upload
3. **Pesos mal configurados:** Ensemble puede estar ejecutando ambos retrievers innecesariamente

**Solución:**
- Si solo necesitas keywords: `USE_BM25_RETRIEVER=true`, `BM25_WEIGHT=1.0`
- Si solo necesitas semántica: `USE_BM25_RETRIEVER=false`

## Próximos Pasos

1. **Experimentar con pesos:**
   - Probar diferentes valores para tu caso de uso específico
   - Documentar qué funciona mejor

2. **Métricas:**
   - Llevar registro de recall@5 para diferentes configuraciones
   - Comparar tiempos de respuesta

3. **Optimización:**
   - Considerar modelo de embeddings diferente si vector search falla
   - Ajustar chunk size si BM25 no encuentra matches

## Referencias

- Ver `docs/RAG_FAILURE_ANALYSIS.md` para análisis detallado del problema
- Ver `.env.example` para todas las variables disponibles
- Código: `apps/backend/src/services/rag/config.ts` y `index.ts`
