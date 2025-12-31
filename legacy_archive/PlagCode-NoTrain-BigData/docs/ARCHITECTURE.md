# Architecture détaillée (sans entraînement)

## Flux
1. **Producer** (API ou script) → Kafka `code.submissions.raw`
2. **Normalizer** (consumer) :
   - parse Python
   - normalise (identifiants, littéraux, espaces)
   - calcule fingerprints Winnowing + features AST
   → Kafka `code.submissions.normalized`
3. **Candidate Retrieval** :
   - index Redis : fingerprint_hash → set(submission_id)
   - calcule la liste de candidats (top-k par overlap)
   → Kafka `code.similarity.candidates`
4. **Scoring Engine** :
   - calcule score final (pondération fixe)
   - génère explications (segments alignés + stats)
   - écrit alertes en Postgres
   - stocke rapports JSON dans MinIO
   → Kafka `code.similarity.alerts`

## Big Data
- Kafka = ingestion streaming + découplage.
- Index Redis = retrieval rapide (démo).
- Spark (option) : job Structured Streaming (micro-batch) pour scale-out.

## Pourquoi Winnowing ?
- Détecte des similarités malgré reformatage, renommage, et petits changements.
- Fournit des **segments** qui peuvent servir d’explications.
