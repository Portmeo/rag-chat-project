# Scripts de Testing y Benchmarks

Scripts para probar, evaluar y optimizar el sistema RAG.

## 💪 Stress Test

**`./stress-test.sh [concurrent] [total]`**

Prueba bajo carga:
- Queries concurrentes (default: 10)
- Total queries (default: 50)
- Métricas: latencia p95, success rate, CPU/memoria
- Throughput (queries/sec)

Ejemplos:
```bash
./stress-test.sh           # 10 concurrent, 50 total
./stress-test.sh 20 100    # 20 concurrent, 100 total
```

**Úsalo antes de producción.**