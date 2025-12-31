# PlagCode-NoTrain-BigData (Python, Kafka, Spark) — Détection de plagiat de code *sans entraînement*

Projet de fin de module **Big Data** (étudiant ingénieur IA) : pipeline streaming **Kafka → normalisation → index fingerprints → scoring → alertes**
pour détecter du **plagiat de code** (Python ciblé par défaut), **sans entraînement** (pas de modèle supervisé).

## Idée principale (sans entraînement)
1. **Normaliser** le code (retire commentaires, normalise espaces, remplace identifiants/littéraux).
2. Extraire des **features** robustes :
   - **Fingerprints Winnowing** sur tokens (très robuste à reformatage/petits edits)
   - **n-grams tokens** (cosine TF-IDF option)
   - **AST “bag-of-nodes”** (structure)
3. **Récupérer des candidats** via un index inversé fingerprints (Redis).
4. **Scorer** avec une pondération fixe (règles).

## Architecture
- **Kafka topics**
  - `code.submissions.raw` : soumissions brutes
  - `code.submissions.normalized` : normalisées + features
  - `code.similarity.candidates` : top candidats
  - `code.similarity.alerts` : alertes + explications
  - `code.deadletter` : erreurs

- **Services Python**
  - `services/api_gateway` : FastAPI (submit + lire alertes)
  - `services/normalizer` : consomme raw → produit normalized
  - `services/candidate_retrieval` : normalized → candidates (via Redis)
  - `services/scoring_engine` : candidates → alerts + rapports (MinIO) + Postgres

- **Big Data**
  - Optionnel : un job `spark_streaming/streaming_job.py` (Structured Streaming) pour traiter Kafka en micro-batch.

## Démarrage rapide (Docker)
Pré-requis : Docker + Docker Compose

```bash
docker compose up -d --build
```

Ensuite :
- API : http://localhost:8000/docs
 - Mini UI (démo) : http://localhost:8000/
   - Soumission via formulaire
   - Consultation alertes + lien JSON report : http://localhost:8000/report/{alert_id}
- Kafka : localhost:9092
- Redis : localhost:6379
- Postgres : localhost:5432 (user/pass/db : plag/plag/plagdb)
- MinIO : http://localhost:9001 (minio/minio123)

### Envoyer une soumission (exemple)
```bash
python -m tools.send_submission --assignment A1 --student S1 --file samples/student1.py
python -m tools.send_submission --assignment A1 --student S2 --file samples/student2.py
```

Puis consulter les alertes :
```bash
python -m tools.poll_alerts --assignment A1
```

## Sans Spark (mode simple)
Les services `normalizer`, `candidate_retrieval`, `scoring_engine` tournent en Python pur via `kafka-python`.
Spark est fourni pour le volet **Big Data** (micro-batch + scaling).

## Configuration
Variables principales (voir `.env.example`) :
- `KAFKA_BOOTSTRAP_SERVERS`
- `REDIS_URL`
- `POSTGRES_DSN`
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `PLAGCODE_TOPK`, `PLAGCODE_THRESHOLD`

## Limitations (acceptables pour un projet fin de module)
- Langage : Python par défaut (extensible via Tree-sitter).
- Similarité AST : approximative (bag-of-nodes).
- Index Redis : démo. En prod : Cassandra/Scylla/ES.

---

### Structure
Voir `docs/ARCHITECTURE.md` pour les détails.
