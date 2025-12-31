"""Spark Structured Streaming job (optionnel)

Objectif : montrer le volet Big Data.
- Lire `code.submissions.raw` depuis Kafka
- Appliquer normalisation + fingerprints via UDF (micro-batch)
- Écrire dans `code.submissions.normalized` et/ou directement des alertes

NB : pour un projet fin de module, vous pouvez garder ce fichier comme démonstration.
Pour exécuter : il faut un cluster Spark avec paquet kafka.
"""

from __future__ import annotations

def main():
    print("TODO: Configure Spark session + Kafka connector, then implement micro-batch processing.")
    print("For the module project, keep Python services running + show this as scaling option.")

if __name__ == "__main__":
    main()
