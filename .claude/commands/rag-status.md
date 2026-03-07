# rag-status

Verifica el estado de todos los servicios del stack RAG: backend, Qdrant y Ollama.

```bash
echo "=== Backend ===" && curl -s http://localhost:3001/health | python3 -m json.tool
echo "=== Qdrant ===" && curl -s http://localhost:6333/collections/documents | python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('result',{}); print(f\"Status: {r.get('status','?')} | Vectors: {r.get('vectors_count','?')} | Points: {r.get('points_count','?')}\")"
echo "=== Ollama ===" && curl -s http://localhost:11434/api/tags | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f\"  {m['name']}\") for m in d.get('models',[])]"
```
