# Queries Profundas para Benchmark

**Actualizado:** 2026-01-31
**Total queries:** 17 (antes: 9)
**Nuevas queries:** 13 queries profundas

---

## 📊 Distribución de Queries

| Tipo | Cantidad | % |
|------|----------|---|
| **Básicas** (keywords directos) | 4 | 24% |
| **Conceptuales** (¿por qué? ¿qué es?) | 3 | 18% |
| **De Relación** (conectar conceptos) | 3 | 18% |
| **De Proceso/Flujo** (¿cómo funciona?) | 3 | 18% |
| **Comparativas** (diferencias) | 3 | 18% |
| **SIN ground truth** | 1 | 6% |

---

## 🎯 Queries Básicas (4)

Buscan datos explícitos y directos usando keywords.

| Query | Target File | Must Contain |
|-------|-------------|--------------|
| "Angular Ionic version" | 01-arquitectura-general.md | Ionic 6, Angular 15 |
| "versión de Angular" | 01-arquitectura-general.md | Angular 15 |
| "¿Qué versión de Ionic se usa?" | 01-arquitectura-general.md | Ionic 6 |
| "stack tecnológico del proyecto" | 01-arquitectura-general.md | Stack Tecnológico |

**Objetivo:** Estas deberían ser fáciles. Modelos con keyword matching (BM25) deberían tener 100% recall.

---

## 💡 Queries Conceptuales (3)

Requieren entender **conceptos**, **razones** y **beneficios**.

### 1. "¿Por qué se usa NgRx para gestionar el estado?"

**Target:** `02-gestion-estado-ngrx.md`
**Must contain:** Estado Centralizado, Flujo Unidireccional, Trazabilidad

**Dificultad:** 🔴🔴 Alta
**Por qué es difícil:**
- La query usa lenguaje natural ("¿por qué?")
- Requiere entender que "estado" → "NgRx" → "ventajas"
- No usa las palabras exactas del documento
- Necesita semántica profunda

**Chunk objetivo:**
```markdown
### ¿Por qué NgRx?

- **Estado Centralizado:** Una única fuente de verdad
- **Flujo Unidireccional:** Predecible y fácil de debuggear
- **Trazabilidad:** Historial completo de cambios de estado
```

---

### 2. "¿Cuáles son las ventajas de usar microfrontends?"

**Target:** `03-microfrontends-web-components.md`
**Must contain:** Independencia, Deploy Independiente, Escalabilidad

**Dificultad:** 🔴🔴 Alta
**Por qué es difícil:**
- "ventajas" es sinónimo de "beneficios" en el documento
- Requiere entender arquitectura de microfrontends
- Concepto complejo

**Chunk objetivo:**
```markdown
### Ventajas de la Arquitectura

- **Independencia Tecnológica:** Cada microfrontend puede usar su stack
- **Deploy Independiente:** Actualizar sin redeployar la app completa
- **Escalabilidad:** Añadir features sin afectar el core
```

---

### 3. "¿Qué beneficios tiene el patrón container-presenter?"

**Target:** `08-patron-container-presenter.md`
**Must contain:** Separación de Responsabilidades, Testabilidad, Reutilización

**Dificultad:** 🔴🔴 Alta
**Por qué es difícil:**
- Patrón de diseño (concepto abstracto)
- "beneficios" puede no aparecer textualmente
- Requiere comprensión de arquitectura

---

## 🔗 Queries de Relación (3)

Conectan **múltiples conceptos** o tecnologías.

### 4. "¿Cómo se integran los web components en Angular?"

**Target:** `03-microfrontends-web-components.md`
**Must contain:** CUSTOM_ELEMENTS_SCHEMA, import

**Dificultad:** 🔴🔴🔴 Muy Alta
**Por qué es difícil:**
- Conecta 2 tecnologías: Angular + Web Components
- Requiere entender el proceso técnico
- Respuesta es código, no texto narrativo

**Chunk objetivo:**
```typescript
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';

// Importar el Web Component
import '@wc-sca/citation-hub';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // Importante para usar custom elements
})
```

---

### 5. "¿Qué relación hay entre NgRx y la arquitectura de la app?"

**Target:** `02-gestion-estado-ngrx.md` O `08-patron-container-presenter.md`
**Must contain:** Store, Estado

**Dificultad:** 🔴🔴🔴 Muy Alta
**Por qué es difícil:**
- Query muy abstracta
- Puede estar en múltiples documentos
- "relación" es concepto implícito

---

### 6. "¿Cómo se conectan los microfrontends con el proyecto principal?"

**Target:** `03-microfrontends-web-components.md`
**Must contain:** npm install, import

**Dificultad:** 🔴🔴 Alta
**Por qué es difícil:**
- "conectan" es metafórico
- Respuesta técnica: npm install + import
- Requiere entender el flujo de integración

---

## 🔄 Queries de Proceso/Flujo (3)

Requieren entender **cómo funciona algo paso a paso**.

### 7. "¿Cómo funciona el flujo de autenticación con JWT?"

**Target:** `04-autenticacion-guards.md`
**Must contain:** JWT, Login, LocalStorage

**Dificultad:** 🔴🔴🔴 Muy Alta
**Por qué es difícil:**
- Requiere entender un flujo completo
- Múltiples pasos conectados
- "flujo" es concepto de proceso

**Chunk objetivo:**
```
Usuario → Login → API → JWT Token → LocalStorage → Headers HTTP → API Requests
```

---

### 8. "¿Qué pasa cuando un usuario hace login?"

**Target:** `04-autenticacion-guards.md`
**Must contain:** login, token, setSession

**Dificultad:** 🔴🔴 Alta
**Por qué es difícil:**
- Lenguaje casual ("qué pasa")
- Requiere entender secuencia de eventos
- Respuesta está en código

---

### 9. "¿Cómo se gestionan las llamadas asíncronas en NgRx?"

**Target:** `02-gestion-estado-ngrx.md`
**Must contain:** Effects, Side Effects

**Dificultad:** 🔴🔴🔴 Muy Alta
**Por qué es difícil:**
- Concepto técnico avanzado (Effects)
- "llamadas asíncronas" → "Side Effects" (no es obvio)
- Requiere conocimiento de NgRx

---

## ⚖️ Queries Comparativas (3)

Requieren entender **diferencias** y **cuándo usar cada opción**.

### 10. "diferencia entre container y presenter components"

**Target:** `08-patron-container-presenter.md`
**Must contain:** Container, Presenter, Store

**Dificultad:** 🔴🔴🔴 Muy Alta
**Por qué es difícil:**
- Comparación implícita (no hay sección "diferencias")
- Información distribuida en el documento
- Requiere sintetizar de múltiples secciones

---

### 11. "¿Cuándo usar guards vs interceptors?"

**Target:** `04-autenticacion-guards.md`
**Must contain:** Guard, canActivate

**Dificultad:** 🔴🔴🔴 Muy Alta
**Por qué es difícil:**
- "cuándo usar" requiere entender casos de uso
- Comparación explícita entre 2 conceptos
- Puede que documento no tenga sección de "interceptors"

---

### 12. "ventajas de JWT vs sesiones tradicionales"

**Target:** `04-autenticacion-guards.md`
**Must contain:** JWT, stateless

**Dificultad:** 🔴🔴🔴 Muy Alta
**Por qué es difícil:**
- Comparación técnica compleja
- "sesiones tradicionales" puede no aparecer
- Requiere entender arquitectura stateless

---

## 📈 Métricas Esperadas

### Para Modelos de Embeddings (Vector Search)

| Modelo | Recall@5 Básicas | Recall@5 Profundas | Recall@5 Global |
|--------|------------------|--------------------| ----------------|
| **nomic-embed-text** | ~25% | ~5-10% | ~15% |
| **mxbai-embed-large** | ~75% | ~25-40% | ~45-55% |
| **bge-m3** | ~50% | ~20-30% | ~35% |

**Hipótesis:**
- Queries profundas son MUCHO más difíciles
- mxbai debería tener mejor comprensión semántica
- Ningún modelo llegará a >60% en queries profundas solo con vector search

### Para Sistema Hybrid (70% BM25 + 30% Vector)

| Tipo Query | Recall@5 Estimado |
|------------|-------------------|
| **Básicas** (keywords) | ~95% (BM25 domina) |
| **Conceptuales** | ~40-50% |
| **De Relación** | ~30-40% |
| **De Proceso** | ~40-50% |
| **Comparativas** | ~20-30% |
| **GLOBAL** | ~55-65% |

---

## 🎯 Objetivo del Benchmark Actualizado

1. **Validar que mxbai es mejor** incluso en queries profundas
2. **Identificar límites de vector search puro** (sin BM25)
3. **Documentar qué tipo de queries fallan** para mejorar chunking/indexing
4. **Justificar necesidad de hybrid retrieval** (BM25 + Vector)

---

## 🔧 Próximos Pasos

1. ✅ Actualizar script con queries profundas
2. ⏳ Re-indexar con `mxbai-embed-large`
3. ⏳ Ejecutar benchmark completo
4. ⏳ Analizar resultados por tipo de query
5. ⏳ Documentar hallazgos

---

*Creado: 2026-01-31*
*Queries totales: 17*
*Documentos objetivo: 5*
