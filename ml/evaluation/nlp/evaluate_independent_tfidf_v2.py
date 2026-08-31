import csv
import json
from pathlib import Path

import joblib
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

ROOT = Path(__file__).resolve().parents[2]

DATA = (
    ROOT
    / "evaluation/nlp/independent_test_v1/"
    / "independent_test_v1.jsonl"
)

ARTIFACT = ROOT / "artifacts/nlp/tfidf_logreg_v2"

OUT = (
    ROOT
    / "evaluation/nlp/independent_test_v1/"
    / "tfidf_logreg_v2"
)

OUT.mkdir(parents=True, exist_ok=True)

rows = [
    json.loads(line)
    for line in DATA.read_text(encoding="utf-8").splitlines()
    if line.strip()
]

texts = [r["text"] for r in rows]
y_true = [r["target_label"] for r in rows]

vectorizer = joblib.load(ARTIFACT / "vectorizer.joblib")
classifier = joblib.load(ARTIFACT / "classifier.joblib")

X = vectorizer.transform(texts)

y_pred = classifier.predict(X)
probabilities = classifier.predict_proba(X)

classes = list(classifier.classes_)

accuracy = accuracy_score(y_true, y_pred)

macro_precision = precision_score(
    y_true,
    y_pred,
    average="macro",
    zero_division=0,
)

macro_recall = recall_score(
    y_true,
    y_pred,
    average="macro",
    zero_division=0,
)

macro_f1 = f1_score(
    y_true,
    y_pred,
    average="macro",
    zero_division=0,
)

weighted_f1 = f1_score(
    y_true,
    y_pred,
    average="weighted",
    zero_division=0,
)

metrics = {
    "model": "tfidf_logreg_v2",
    "dataset": "independent_test_v1",
    "n_samples": len(rows),
    "accuracy": accuracy,
    "macro_precision": macro_precision,
    "macro_recall": macro_recall,
    "macro_f1": macro_f1,
    "weighted_f1": weighted_f1,
}

(OUT / "metrics.json").write_text(
    json.dumps(metrics, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

report = classification_report(
    y_true,
    y_pred,
    labels=classes,
    output_dict=True,
    zero_division=0,
)

with (OUT / "per_class_metrics.csv").open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    writer = csv.writer(f)

    writer.writerow(
        [
            "label",
            "precision",
            "recall",
            "f1_score",
            "support",
        ]
    )

    for label in classes:
        d = report[label]

        writer.writerow(
            [
                label,
                d["precision"],
                d["recall"],
                d["f1-score"],
                int(d["support"]),
            ]
        )

cm = confusion_matrix(
    y_true,
    y_pred,
    labels=classes,
)

with (OUT / "confusion_matrix.csv").open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    writer = csv.writer(f)

    writer.writerow(["true/pred"] + classes)

    for label, values in zip(classes, cm):
        writer.writerow([label] + list(values))

with (OUT / "predictions.csv").open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    fieldnames = [
        "sample_id",
        "text",
        "true_label",
        "predicted_label",
        "confidence",
        "correct",
    ]

    writer = csv.DictWriter(
        f,
        fieldnames=fieldnames,
    )

    writer.writeheader()

    for row, true, pred, probs in zip(
        rows,
        y_true,
        y_pred,
        probabilities,
    ):
        confidence = float(max(probs))

        writer.writerow(
            {
                "sample_id": row["sample_id"],
                "text": row["text"],
                "true_label": true,
                "predicted_label": pred,
                "confidence": confidence,
                "correct": true == pred,
            }
        )

with (OUT / "errors.csv").open(
    "w",
    encoding="utf-8",
    newline="",
) as f:
    fieldnames = [
        "sample_id",
        "text",
        "true_label",
        "predicted_label",
        "confidence",
    ]

    writer = csv.DictWriter(
        f,
        fieldnames=fieldnames,
    )

    writer.writeheader()

    for row, true, pred, probs in zip(
        rows,
        y_true,
        y_pred,
        probabilities,
    ):
        if true == pred:
            continue

        writer.writerow(
            {
                "sample_id": row["sample_id"],
                "text": row["text"],
                "true_label": true,
                "predicted_label": pred,
                "confidence": float(max(probs)),
            }
        )

print("\nTF-IDF / independent_test_v1")
print("=" * 45)
print(f"n................: {len(rows)}")
print(f"accuracy.........: {accuracy:.6f}")
print(f"macro precision..: {macro_precision:.6f}")
print(f"macro recall.....: {macro_recall:.6f}")
print(f"macro F1.........: {macro_f1:.6f}")
print(f"weighted F1......: {weighted_f1:.6f}")
print(f"errors...........: {sum(a != b for a, b in zip(y_true, y_pred))}")
print("\nResultados:", OUT)
