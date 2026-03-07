# eval-hard

Lanza evaluación solo sobre las categorías problemáticas (Comparativa y Multi-Hop) con Sonnet como juez. Útil para medir el impacto de cambios en el pipeline sin esperar el eval completo.

```bash
cd /Users/alejandro.exposito/Projects/rag-chat-project/apps/evaluation && npm run eval -- --judge sonnet --categories "Comparativa,Multi-Hop"
```
