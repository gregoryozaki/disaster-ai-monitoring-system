#!/usr/bin/env python3
"""
Baseline NLP do KAMARA: TF-IDF (palavras) + Logistic Regression.

Objetivo
--------
Treinar um baseline clássico e simples usando SOMENTE:
    text -> target_label

Nenhum metadado de geração (scenario_family, linguistic_profile, difficulty,
noise_features, split, similarity_group_id etc.) entra como feature.

Entrada
-------
ml/data/processed/nlp/train.jsonl
ml/data/processed/nlp/validation.jsonl

Saídas
------
ml/artifacts/nlp/tfidf_logreg_v1/
    vectorizer.joblib
    classifier.joblib
    run_metadata.json

ml/evaluation/nlp/tfidf_logreg_v1/
    metrics_validation.json
    per_class_metrics_validation.csv
    confusion_matrix_validation.csv
    confusion_matrix_validation.png
    predictions_validation.csv
    errors_validation.csv
    top_features_per_class.csv

Importante
----------
Este script NÃO lê test.jsonl. O conjunto de teste permanece intocado nesta
etapa. Ele será usado somente depois que os modelos/hyperparâmetros forem
congelados.

Uso
---
python ml/training/nlp/train_tfidf_logreg.py
"""

from __future__ import annotations

import hashlib
import json
import platform
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import matplotlib.pyplot as plt
import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


MODEL_NAME = "tfidf_logreg"
MODEL_VERSION = "1.0.0"
RUN_NAME = "tfidf_logreg_v1"

EXPECTED_LABELS = [
    "COBRADE_1_2_1_0_0",
    "COBRADE_1_2_2_0_0",
    "COBRADE_1_2_3_0_0",
    "COBRADE_1_4_1_3_1",
    "COBRADE_1_4_1_3_2",
    "COBRADE_2_3_1_1_0",
    "COBRADE_2_3_1_2_0",
    "OTHER",
    "INSUFFICIENT_INFO",
]

RANDOM_STATE = 20260830


def find_repo_root(start: Path) -> Path:
    current = start.resolve()

    for candidate in [current, *current.parents]:
        if (candidate / "ml").is_dir():
            return candidate

    raise RuntimeError(
        "Não foi possível localizar a raiz do repositório."
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    with path.open("r", encoding="utf-8") as file:
        for line_number, raw_line in enumerate(file, start=1):
            line = raw_line.strip()

            if not line:
                raise ValueError(
                    f"Linha vazia em {path}:{line_number}"
                )

            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"JSON inválido em {path}:{line_number}: {exc}"
                ) from exc

            if not isinstance(row, dict):
                raise ValueError(
                    f"Registro não é objeto JSON em {path}:{line_number}"
                )

            for required in ("sample_id", "text", "target_label"):
                if required not in row:
                    raise ValueError(
                        f"{path}:{line_number} sem campo {required!r}"
                    )

            if not isinstance(row["text"], str) or not row["text"].strip():
                raise ValueError(
                    f"Texto vazio em {path}:{line_number}"
                )

            rows.append(row)

    return rows


def validate_split(
    rows: list[dict[str, Any]],
    expected_size: int,
    split_name: str,
) -> None:
    if len(rows) != expected_size:
        raise ValueError(
            f"{split_name}: {len(rows)} registros; esperado {expected_size}."
        )

    ids = [row["sample_id"] for row in rows]

    if len(ids) != len(set(ids)):
        raise ValueError(
            f"{split_name}: sample_id duplicado."
        )

    labels = Counter(
        row["target_label"]
        for row in rows
    )

    if set(labels) != set(EXPECTED_LABELS):
        raise ValueError(
            f"{split_name}: conjunto de labels inesperado: {dict(labels)}"
        )


def write_csv(
    path: Path,
    header: list[str],
    rows: list[list[Any]],
) -> None:
    import csv

    with path.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as file:
        writer = csv.writer(file)
        writer.writerow(header)
        writer.writerows(rows)


def main() -> int:
    repo_root = find_repo_root(Path.cwd())

    train_path = (
        repo_root
        / "ml"
        / "data"
        / "processed"
        / "nlp"
        / "train.jsonl"
    )

    validation_path = (
        repo_root
        / "ml"
        / "data"
        / "processed"
        / "nlp"
        / "validation.jsonl"
    )

    artifact_dir = (
        repo_root
        / "ml"
        / "artifacts"
        / "nlp"
        / RUN_NAME
    )

    evaluation_dir = (
        repo_root
        / "ml"
        / "evaluation"
        / "nlp"
        / RUN_NAME
    )

    for path in (train_path, validation_path):
        if not path.is_file():
            raise FileNotFoundError(
                f"Arquivo obrigatório não encontrado: {path}"
            )

    print("Carregando splits...")
    train_rows = load_jsonl(train_path)
    validation_rows = load_jsonl(validation_path)

    validate_split(
        train_rows,
        expected_size=6300,
        split_name="train",
    )
    validate_split(
        validation_rows,
        expected_size=1350,
        split_name="validation",
    )

    train_ids = {
        row["sample_id"]
        for row in train_rows
    }
    validation_ids = {
        row["sample_id"]
        for row in validation_rows
    }

    overlap = train_ids & validation_ids

    if overlap:
        raise ValueError(
            f"Há {len(overlap)} sample_id em train e validation."
        )

    X_train = [
        row["text"]
        for row in train_rows
    ]
    y_train = [
        row["target_label"]
        for row in train_rows
    ]

    X_validation = [
        row["text"]
        for row in validation_rows
    ]
    y_validation = [
        row["target_label"]
        for row in validation_rows
    ]

    print(
        f"Train: {len(X_train)} | Validation: {len(X_validation)}"
    )

    # Não removemos acentos, stopwords, pontuação ou "ruído" manualmente.
    # Lowercase é a única normalização lexical aplicada pelo baseline.
    vectorizer = TfidfVectorizer(
        lowercase=True,
        strip_accents=None,
        analyzer="word",
        ngram_range=(1, 2),
        min_df=2,
        max_df=1.0,
        max_features=50_000,
        sublinear_tf=True,
        norm="l2",
    )

    print("Ajustando TF-IDF...")
    X_train_tfidf = vectorizer.fit_transform(
        X_train
    )

    X_validation_tfidf = vectorizer.transform(
        X_validation
    )

    print(
        "Vocabulário TF-IDF:",
        len(vectorizer.get_feature_names_out()),
    )

    classifier = LogisticRegression(
        C=1.0,
        max_iter=3000,
        solver="lbfgs",
        class_weight=None,
        random_state=RANDOM_STATE,
    )

    print("Treinando Logistic Regression...")
    classifier.fit(
        X_train_tfidf,
        y_train,
    )

    print("Avaliando validation...")
    y_pred = classifier.predict(
        X_validation_tfidf
    )

    y_proba = classifier.predict_proba(
        X_validation_tfidf
    )

    accuracy = accuracy_score(
        y_validation,
        y_pred,
    )

    macro_precision = precision_score(
        y_validation,
        y_pred,
        labels=EXPECTED_LABELS,
        average="macro",
        zero_division=0,
    )

    macro_recall = recall_score(
        y_validation,
        y_pred,
        labels=EXPECTED_LABELS,
        average="macro",
        zero_division=0,
    )

    macro_f1 = f1_score(
        y_validation,
        y_pred,
        labels=EXPECTED_LABELS,
        average="macro",
        zero_division=0,
    )

    weighted_f1 = f1_score(
        y_validation,
        y_pred,
        labels=EXPECTED_LABELS,
        average="weighted",
        zero_division=0,
    )

    report = classification_report(
        y_validation,
        y_pred,
        labels=EXPECTED_LABELS,
        output_dict=True,
        zero_division=0,
    )

    cm = confusion_matrix(
        y_validation,
        y_pred,
        labels=EXPECTED_LABELS,
    )

    artifact_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    evaluation_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    vectorizer_path = (
        artifact_dir
        / "vectorizer.joblib"
    )

    classifier_path = (
        artifact_dir
        / "classifier.joblib"
    )

    joblib.dump(
        vectorizer,
        vectorizer_path,
    )

    joblib.dump(
        classifier,
        classifier_path,
    )

    metrics = {
        "split": "validation",
        "records": len(validation_rows),
        "accuracy": round(float(accuracy), 6),
        "macro_precision": round(float(macro_precision), 6),
        "macro_recall": round(float(macro_recall), 6),
        "macro_f1": round(float(macro_f1), 6),
        "weighted_f1": round(float(weighted_f1), 6),
        "labels": EXPECTED_LABELS,
    }

    metrics_path = (
        evaluation_dir
        / "metrics_validation.json"
    )

    with metrics_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            metrics,
            file,
            ensure_ascii=False,
            indent=2,
        )
        file.write("\n")

    # Métricas por classe.
    per_class_rows = []

    for label in EXPECTED_LABELS:
        class_metrics = report[label]

        per_class_rows.append(
            [
                label,
                class_metrics["precision"],
                class_metrics["recall"],
                class_metrics["f1-score"],
                int(class_metrics["support"]),
            ]
        )

    write_csv(
        evaluation_dir
        / "per_class_metrics_validation.csv",
        [
            "target_label",
            "precision",
            "recall",
            "f1_score",
            "support",
        ],
        per_class_rows,
    )

    # Matriz de confusão em CSV.
    cm_rows = []

    for label, row_values in zip(
        EXPECTED_LABELS,
        cm,
    ):
        cm_rows.append(
            [label, *row_values.tolist()]
        )

    write_csv(
        evaluation_dir
        / "confusion_matrix_validation.csv",
        [
            "true_label",
            *EXPECTED_LABELS,
        ],
        cm_rows,
    )

    # Matriz de confusão em PNG.
    fig, ax = plt.subplots(
        figsize=(13, 11)
    )

    image = ax.imshow(cm)

    ax.set_title(
        "KAMARA NLP — TF-IDF + Logistic Regression\nValidation confusion matrix"
    )
    ax.set_xlabel("Predicted label")
    ax.set_ylabel("True label")

    ax.set_xticks(
        np.arange(len(EXPECTED_LABELS))
    )
    ax.set_yticks(
        np.arange(len(EXPECTED_LABELS))
    )

    ax.set_xticklabels(
        EXPECTED_LABELS,
        rotation=90,
        fontsize=8,
    )
    ax.set_yticklabels(
        EXPECTED_LABELS,
        fontsize=8,
    )

    threshold = (
        cm.max() / 2.0
        if cm.size
        else 0
    )

    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j,
                i,
                str(cm[i, j]),
                ha="center",
                va="center",
                fontsize=8,
            )

    fig.colorbar(
        image,
        ax=ax,
        fraction=0.046,
        pad=0.04,
    )
    fig.tight_layout()
    fig.savefig(
        evaluation_dir
        / "confusion_matrix_validation.png",
        dpi=180,
        bbox_inches="tight",
    )
    plt.close(fig)

    # Predições individuais.
    class_to_index = {
        label: index
        for index, label in enumerate(
            classifier.classes_
        )
    }

    prediction_rows = []

    for row, true_label, predicted_label, probabilities in zip(
        validation_rows,
        y_validation,
        y_pred,
        y_proba,
    ):
        confidence = float(
            probabilities[
                class_to_index[predicted_label]
            ]
        )

        prediction_rows.append(
            [
                row["sample_id"],
                true_label,
                predicted_label,
                int(true_label == predicted_label),
                confidence,
                row["linguistic_profile"],
                row["difficulty"],
                row["scenario_family"],
                row["text"],
            ]
        )

    write_csv(
        evaluation_dir
        / "predictions_validation.csv",
        [
            "sample_id",
            "true_label",
            "predicted_label",
            "correct",
            "predicted_probability",
            "linguistic_profile",
            "difficulty",
            "scenario_family",
            "text",
        ],
        prediction_rows,
    )

    error_rows = [
        row
        for row in prediction_rows
        if row[3] == 0
    ]

    write_csv(
        evaluation_dir
        / "errors_validation.csv",
        [
            "sample_id",
            "true_label",
            "predicted_label",
            "correct",
            "predicted_probability",
            "linguistic_profile",
            "difficulty",
            "scenario_family",
            "text",
        ],
        error_rows,
    )

    # Termos com maior coeficiente positivo por classe.
    # Isto é particularmente importante neste projeto para investigar
    # atalhos lexicais e assinaturas do gerador sintético.
    feature_names = np.asarray(
        vectorizer.get_feature_names_out()
    )

    top_feature_rows = []
    top_k = 40

    for class_index, label in enumerate(
        classifier.classes_
    ):
        coefficients = classifier.coef_[
            class_index
        ]

        top_indices = np.argsort(
            coefficients
        )[-top_k:][::-1]

        for rank, feature_index in enumerate(
            top_indices,
            start=1,
        ):
            top_feature_rows.append(
                [
                    label,
                    rank,
                    feature_names[feature_index],
                    float(
                        coefficients[
                            feature_index
                        ]
                    ),
                ]
            )

    write_csv(
        evaluation_dir
        / "top_features_per_class.csv",
        [
            "target_label",
            "rank",
            "feature",
            "coefficient",
        ],
        top_feature_rows,
    )

    run_metadata = {
        "run_name": RUN_NAME,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "created_at_utc": datetime.now(
            timezone.utc
        ).isoformat(),
        "python_version": platform.python_version(),
        "scikit_learn_version": sklearn.__version__,
        "train": {
            "path": str(train_path),
            "sha256": sha256_file(
                train_path
            ),
            "records": len(train_rows),
        },
        "validation": {
            "path": str(validation_path),
            "sha256": sha256_file(
                validation_path
            ),
            "records": len(
                validation_rows
            ),
        },
        "feature_input": [
            "text",
        ],
        "target": "target_label",
        "vectorizer": {
            "type": "TfidfVectorizer",
            "lowercase": True,
            "strip_accents": None,
            "analyzer": "word",
            "ngram_range": [1, 2],
            "min_df": 2,
            "max_df": 1.0,
            "max_features": 50_000,
            "sublinear_tf": True,
            "vocabulary_size": len(
                vectorizer.get_feature_names_out()
            ),
        },
        "classifier": {
            "type": "LogisticRegression",
            "C": 1.0,
            "max_iter": 3000,
            "solver": "lbfgs",
            "class_weight": None,
            "random_state": RANDOM_STATE,
            "classes": classifier.classes_.tolist(),
        },
        "validation_metrics": metrics,
        "test_evaluated": False,
        "notes": [
            "Somente o campo text foi usado como feature.",
            "Metadados de geração e split foram excluídos da entrada do modelo.",
            "O conjunto test.jsonl não foi lido nesta execução.",
            "O teste sintético não substitui avaliação manual/externa independente.",
        ],
    }

    run_metadata_path = (
        artifact_dir
        / "run_metadata.json"
    )

    with run_metadata_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            run_metadata,
            file,
            ensure_ascii=False,
            indent=2,
        )
        file.write("\n")

    print("\nBaseline concluído.")
    print(f"Accuracy         : {accuracy:.4f}")
    print(f"Macro precision  : {macro_precision:.4f}")
    print(f"Macro recall     : {macro_recall:.4f}")
    print(f"Macro F1         : {macro_f1:.4f}")
    print(f"Weighted F1      : {weighted_f1:.4f}")
    print(f"Erros validation : {len(error_rows)}")

    print(f"\nArtefatos: {artifact_dir}")
    print(f"Avaliação: {evaluation_dir}")
    print("\nTESTE NÃO FOI UTILIZADO.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print(
            "\nInterrompido pelo usuário.",
            file=sys.stderr,
        )
        raise SystemExit(130)
    except Exception as exc:
        print(
            f"\n[ERRO] {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
