# switch-llm

Muestra la configuración LLM actual del backend y las opciones disponibles.

Configuración actual en apps/backend/.env:
- `USE_CLAUDE=true/false` — usar Claude API o Ollama local
- `CLAUDE_MODEL` — modelo Claude (claude-haiku-4-5-20251001 recomendado)
- `OLLAMA_MODEL` — modelo local (qwen2.5:14b, llama3.1:8b, phi4:14b)

Para cambiar: editar .env y reiniciar el backend.

Modelos locales disponibles en Ollama:
```bash
curl -s http://localhost:11434/api/tags | python3 -c "import json,sys; [print(m['name']) for m in json.load(sys.stdin).get('models',[])]"
```

Resultados de evaluación por modelo (juez Sonnet, Comparativa+Multi-Hop):
- Claude Haiku: Faithfulness 0.42, Hallucination 0.76
- llama3.1:8b: Faithfulness 0.29, Hallucination 0.33
- qwen2.5:14b: pendiente de evaluación
