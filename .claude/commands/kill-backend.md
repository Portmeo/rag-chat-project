# kill-backend

Mata el proceso que esté usando el puerto 3001 (backend RAG).

```bash
lsof -i :3001 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null && echo "Puerto 3001 liberado" || echo "Nada en el puerto 3001"
```
