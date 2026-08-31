import csv
import json
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer


ROOT = Path(__file__).resolve().parents[2]

DATA = (
    ROOT
    / "evaluation/nlp/independent_test_v1"
    / "independent_test_v1.jsonl"
)

MODEL_DIR = (
    ROOT
    / "artifacts/nlp/kamara_bertimbau_v2"
)

OUT = (
    ROOT
    / "evaluation/nlp/independent_test_v1"
    / "kamara_bertimbau_v2"
)

OUT.mkdir(parents=True, exist_ok=True)

MAX_LENGTH = 128
BATCH_SIZE = 32


# ============================================================
# Dados
# ============================================================

rows = [
    json.loads(line)
    for line in DATA.read_text(encoding="utf-8").splitlines()
    if line.strip()
]

texts = [r["text"] for r in rows]
y_true = [r["target_label"] for r in rows]


# ============================================================
# Modelo congelado
# ============================================================

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_DIR,
    local_files_only=True,
)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_DIR,
    local_files_only=True,
)

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

model.to(device)
model.eval()

print("Device:", device)
print("Modelo:", MODEL_DIR)


# ============================================================
# Resolver mapeamento de labels
# ============================================================

def normalize_id2label(config):
    raw = config.id2label

    if not raw:
        return {}

    result = {}

    for k, v in raw.items():
        try:
            k = int(k)
        except (TypeError, ValueError):
            pass

        result[k] = v

    return result


id2label = normalize_id2label(model.config)

print("id2label:", id2label)

if not id2label:
    raise RuntimeError(
        "config.json do modelo não contém id2label."
    )

num_labels = model.config.num_labels

expected_ids = set(range(num_labels))

if set(id2label) != expected_ids:
    raise RuntimeError(
        "id2label inesperado. "
        f"Esperado IDs {sorted(expected_ids)}, "
        f"recebido {sorted(id2label)}"
    )

labels = [
    id2label[i]
    for i in range(num_labels)
]

dataset_labels = sorted(set(y_true))

if set(labels) != set(dataset_labels):
    raise RuntimeError(
        "\nAs labels do modelo não correspondem às labels "
        "do teste independente.\n"
        f"Modelo: {labels}\n"
        f"Dataset: {dataset_labels}\n"
    )


# ============================================================
# Dataset
# ============================================================

class TextDataset(Dataset):
    def __init__(self, texts):
        self.texts = texts

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        encoded = tokenizer(
            self.texts[idx],
            truncation=True,
            padding="max_length",
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )

        return {
            k: v.squeeze(0)
            for k, v in encoded.items()
        }


loader = DataLoader(
    TextDataset(texts),
    batch_size=BATCH_SIZE,
    shuffle=False,
)


# ============================================================
# Inferência
# ============================================================

all_pred_ids = []
all_probs = []

with torch.inference_mode():
    for batch in loader:
        batch = {
            k: v.to(device)
            for k, v in batch.items()
        }

        outputs = model(**batch)

        probs = torch.softmax(
            outputs.logits,
            dim=-1,
        )

        preds = probs.argmax(dim=-1)

        all_pred_ids.extend(
            preds.cpu().numpy().tolist()
        )

        all_probs.extend(
            probs.cpu().numpy().tolist()
        )


y_pred = [
    id2label[i]
    for i in all_pred_ids
]


# ============================================================
# Métricas
# ============================================================

accuracy = accuracy_score(
    y_true,
    y_pred,
)

macro_precision = precision_score(
    y_true,
    y_pred,
    labels=labels,
    average="macro",
    zero_division=0,
)

macro_recall = recall_score(
    y_true,
    y_pred,
    labels=labels,
    average="macro",
    zero_division=0,
)

macro_f1 = f1_score(
    y_true,
    y_pred,
    labels=labels,
    average="macro",
    zero_division=0,
)

weighted_f1 = f1_score(
    y_true,
    y_pred,
    labels=labels,
    average="weighted",
    zero_division=0,
)

report = classification_report(
    y_true,
    y_pred,
    labels=labels,
    output_dict=True,
    zero_division=0,
)

cm = confusion_matrix(
    y_true,
    y_pred,
    labels=labels,
)

errors = sum(
    true != pred
    for true, pred in zip(y_true, y_pred)
)


# ============================================================
# Salvar métricas
# ============================================================

metrics = {
    "dataset": "independent_test_v1",
    "model": "kamara_bertimbau_v2",
    "n": len(rows),
    "accuracy": accuracy,
    "macro_precision": macro_precision,
    "macro_recall": macro_recall,
    "macro_f1": macro_f1,
    "weighted_f1": weighted_f1,
    "errors": errors,
    "device": str(device),
    "max_length": MAX_LENGTH,
    "batch_size": BATCH_SIZE,
}

(
    OUT / "metrics.json"
).write_text(
    json.dumps(
        metrics,
        indent=2,
        ensure_ascii=False,
    ),
    encoding="utf-8",
)


# ============================================================
# Métricas por classe
# ============================================================

with (
    OUT / "per_class_metrics.csv"
).open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    writer = csv.writer(f)

    writer.writerow([
        "label",
        "precision",
        "recall",
        "f1",
        "support",
    ])

    for label in labels:
        m = report[label]

        writer.writerow([
            label,
            m["precision"],
            m["recall"],
            m["f1-score"],
            int(m["support"]),
        ])


# ============================================================
# Matriz de confusão
# ============================================================

with (
    OUT / "confusion_matrix.csv"
).open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    writer = csv.writer(f)

    writer.writerow(
        ["true/pred"] + labels
    )

    for label, row in zip(labels, cm):
        writer.writerow(
            [label] + row.tolist()
        )


# ============================================================
# Predições
# ============================================================

with (
    OUT / "predictions.csv"
).open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    fieldnames = [
        "sample_id",
        "text",
        "target_label",
        "predicted_label",
        "correct",
        "confidence",
    ]

    writer = csv.DictWriter(
        f,
        fieldnames=fieldnames,
    )

    writer.writeheader()

    for r, pred, pred_id, probs in zip(
        rows,
        y_pred,
        all_pred_ids,
        all_probs,
    ):
        writer.writerow({
            "sample_id": r["sample_id"],
            "text": r["text"],
            "target_label": r["target_label"],
            "predicted_label": pred,
            "correct": (
                r["target_label"] == pred
            ),
            "confidence": float(
                probs[pred_id]
            ),
        })


# ============================================================
# Erros
# ============================================================

with (
    OUT / "errors.csv"
).open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    fieldnames = [
        "sample_id",
        "text",
        "target_label",
        "predicted_label",
        "confidence",
    ]

    writer = csv.DictWriter(
        f,
        fieldnames=fieldnames,
    )

    writer.writeheader()

    for r, pred, pred_id, probs in zip(
        rows,
        y_pred,
        all_pred_ids,
        all_probs,
    ):
        if r["target_label"] == pred:
            continue

        writer.writerow({
            "sample_id": r["sample_id"],
            "text": r["text"],
            "target_label": r["target_label"],
            "predicted_label": pred,
            "confidence": float(
                probs[pred_id]
            ),
        })


# ============================================================
# Saída
# ============================================================

print()
print("BERTimbau / independent_test_v1")
print("=" * 45)

print(
    f"n................: {len(rows)}"
)
print(
    f"accuracy.........: {accuracy:.6f}"
)
print(
    f"macro precision..: {macro_precision:.6f}"
)
print(
    f"macro recall.....: {macro_recall:.6f}"
)
print(
    f"macro F1.........: {macro_f1:.6f}"
)
print(
    f"weighted F1......: {weighted_f1:.6f}"
)
print(
    f"errors...........: {errors}"
)

print()
print("Resultados:", OUT)
