from __future__ import annotations
from kafka import KafkaProducer, KafkaConsumer
from typing import Iterable, Optional
from plagcode.config import settings
from plagcode.serde import dumps, loads

def producer() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        client_id=settings.kafka_client_id,
        value_serializer=dumps,
        key_serializer=lambda k: k.encode("utf-8") if isinstance(k, str) else k,
        acks="all",
        retries=5,
    )

def consumer(topic: str, group_id: str) -> KafkaConsumer:
    return KafkaConsumer(
        topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        client_id=settings.kafka_client_id,
        group_id=group_id,
        value_deserializer=loads,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
        max_poll_records=200,
    )
