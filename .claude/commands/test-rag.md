# test-rag

Hace una query de prueba rápida al RAG para verificar que el backend responde correctamente.

```bash
curl -s -X POST http://localhost:3001/api/chat/query \
  -H 'Content-Type: application/json' \
  -d '{"question": "¿Qué versión de Angular se usa en el proyecto?"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('Answer:', d.get('answer','ERROR')[:200]); print('Sources:', [s.get('filename') for s in d.get('sources',[])])"
```
