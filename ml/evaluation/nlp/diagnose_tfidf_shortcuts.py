#!/usr/bin/env python3
"""
Diagnóstico de shortcuts sintéticos no baseline TF-IDF + Logistic Regression.

Este script NÃO altera dataset, splits ou modelo.
Ele executa um stress test apenas na validation:

1. mede o desempenho original;
2. remove frases/expressões suspeitas de serem assinatura do gerador;
3. mede novamente;
4. registra quais predições mudaram e quanto a confiança caiu.

Objetivo:
verificar se o excelente desempenho do baseline depende de frases artificiais
de geração, principalmente em OTHER e INSUFFICIENT_INFO.

IMPORTANTE:
- isto é um diagnóstico, não um benchmark final;
- test.jsonl NÃO é lido;
- apenas text é usado pelo classificador.

Uso:
    python ml/evaluation/nlp/diagnose_tfidf_shortcuts.py

Saídas:
    ml/evaluation/nlp/tfidf_logreg_v2/
        shortcut_stress_test_validation.json
        shortcut_stress_predictions_validation.csv
        shortcut_stress_flips_validation.csv
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)


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


# ------------------------------------------------------------
# CUES SUSPEITOS
# ------------------------------------------------------------
# O objetivo NÃO é remover sinais semanticamente legítimos como:
# rio, margem, bueiro, correnteza, fábrica, casas, reserva etc.
#
# Também evitamos mascarar expressões centrais à própria semântica
# de INSUFFICIENT_INFO, como "não sabemos" ou "sem informação".
#
# A lista abaixo prioriza frases administrativas/discursivas e estilos
# que apareceram como muito associados a uma classe na auditoria.

SUSPICIOUS_CUES: dict[str, list[str]] = {
    "other_generator_style": [
        r"\bcontinua sendo acompanhada\b",
        r"\bsendo acompanhada\b",
        r"\bequipes (?:estão )?avaliando (?:os )?danos\b",
        r"\bmoradores (?:estão )?evitando (?:o )?local\b",
        r"\bo acesso (?:foi )?interrompido temporariamente\b",
        r"\ba situação foi comunicada às equipes responsáveis\b",
        r"\ba situacao foi comunicada as equipes responsaveis\b",
        r"\bparte da região foi interditada\b",
        r"\bparte da regiao foi interditada\b",
        r"\bo trânsito está sendo desviado\b",
        r"\bo transito esta sendo desviado\b",
        r"\bo trânsito foi desviado\b",
        r"\bo transito foi desviado\b",
        r"\ba área foi isolada por segurança\b",
        r"\ba area foi isolada por seguranca\b",
        r"\brolou\b",
        r"\bdeu\b",
        r"\bteve\b",
        r"\bo pessoal viu\b",
    ],
    "insufficient_generator_style": [
        r"\bo registro preliminar menciona\b",
        r"\bo relato informa que\b",
        r"\ba ocorrência recebida descreve que\b",
        r"\ba ocorrencia recebida descreve que\b",
        r"\ba informação disponível indica que\b",
        r"\ba informacao disponivel indica que\b",
        r"\bo aviso recebido é incompleto\b",
        r"\bo aviso recebido e incompleto\b",
        r"\ba informação chegou sem contexto suficiente\b",
        r"\ba informacao chegou sem contexto suficiente\b",
        r"\bo que foi informado até o momento é apenas que\b",
        r"\bo que foi informado ate o momento e apenas que\b",
        r"\ba situação ainda está sendo verificada\b",
        r"\ba situacao ainda esta sendo verificada\b",
        r"\ba descrição recebida é incompleta\b",
        r"\ba descricao recebida e incompleta\b",
        r"\ba informação disponível ainda é muito vaga\b",
        r"\ba informacao disponivel ainda e muito vaga\b",
    ],
}


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "ml").is_dir():
            return candidate
    raise RuntimeError("Não foi possível localizar a raiz do repositório.")


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                raise ValueError(f"Linha vazia em {path}:{line_number}")
            rows.append(json.loads(line))
    return rows


def compile_cues() -> list[tuple[str, re.Pattern[str]]]:
    compiled = []
    for group, patterns in SUSPICIOUS_CUES.items():
        for pattern in patterns:
            compiled.append(
                (group, re.compile(pattern, flags=re.IGNORECASE))
            )
    return compiled


COMPILED_CUES = compile_cues()


def mask_suspicious_cues(text: str) -> tuple[str, list[str]]:
    masked = text
    matched_groups = []

    for group, pattern in COMPILED_CUES:
        new_text, count = pattern.subn(" ", masked)
        if count:
            matched_groups.extend([group] * count)
            masked = new_text

    masked = re.sub(r"\s+", " ", masked).strip()
    masked = re.sub(r"\s+([,.;:!?])", r"\1", masked)

    # Evita texto vazio em caso extremo.
    if not masked:
        masked = "[sem_conteudo_apos_mascara]"

    return masked, matched_groups


def metrics(y_true: list[str], y_pred: list[str]) -> dict[str, Any]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macro_precision": float(
            precision_score(
                y_true,
                y_pred,
                labels=EXPECTED_LABELS,
                average="macro",
                zero_division=0,
            )
        ),
        "macro_recall": float(
            recall_score(
                y_true,
                y_pred,
                labels=EXPECTED_LABELS,
                average="macro",
                zero_division=0,
            )
        ),
        "macro_f1": float(
            f1_score(
                y_true,
                y_pred,
                labels=EXPECTED_LABELS,
                average="macro",
                zero_division=0,
            )
        ),
    }


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    repo_root = find_repo_root(Path.cwd())

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
        / "tfidf_logreg_v2"
    )

    evaluation_dir = (
        repo_root
        / "ml"
        / "evaluation"
        / "nlp"
        / "tfidf_logreg_v2"
    )

    vectorizer_path = artifact_dir / "vectorizer.joblib"
    classifier_path = artifact_dir / "classifier.joblib"

    for path in (validation_path, vectorizer_path, classifier_path):
        if not path.is_file():
            raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    rows = load_jsonl(validation_path)

    if len(rows) != 1350:
        raise ValueError(
            f"Validation possui {len(rows)} registros; esperado 1350."
        )

    vectorizer = joblib.load(vectorizer_path)
    classifier = joblib.load(classifier_path)

    texts = [row["text"] for row in rows]
    y_true = [row["target_label"] for row in rows]

    original_matrix = vectorizer.transform(texts)
    original_pred = classifier.predict(original_matrix)
    original_proba = classifier.predict_proba(original_matrix)

    masked_texts = []
    cue_groups_per_row = []

    cue_group_record_counts = Counter()
    cue_group_match_counts = Counter()

    for text in texts:
        masked, groups = mask_suspicious_cues(text)
        masked_texts.append(masked)
        cue_groups_per_row.append(groups)

        for group in set(groups):
            cue_group_record_counts[group] += 1
        cue_group_match_counts.update(groups)

    masked_matrix = vectorizer.transform(masked_texts)
    masked_pred = classifier.predict(masked_matrix)
    masked_proba = classifier.predict_proba(masked_matrix)

    class_to_index = {
        label: i
        for i, label in enumerate(classifier.classes_)
    }

    original_metrics = metrics(y_true, original_pred)
    masked_metrics = metrics(y_true, masked_pred)

    original_report = classification_report(
        y_true,
        original_pred,
        labels=EXPECTED_LABELS,
        output_dict=True,
        zero_division=0,
    )

    masked_report = classification_report(
        y_true,
        masked_pred,
        labels=EXPECTED_LABELS,
        output_dict=True,
        zero_division=0,
    )

    output_rows = []
    flip_rows = []

    affected_records = 0
    prediction_flips = 0
    correct_to_wrong = 0
    wrong_to_correct = 0

    confidence_deltas = []

    for (
        row,
        original_text,
        masked_text,
        groups,
        pred_before,
        pred_after,
        proba_before,
        proba_after,
    ) in zip(
        rows,
        texts,
        masked_texts,
        cue_groups_per_row,
        original_pred,
        masked_pred,
        original_proba,
        masked_proba,
    ):
        affected = bool(groups)

        if affected:
            affected_records += 1

        before_conf = float(
            proba_before[class_to_index[pred_before]]
        )
        after_conf = float(
            proba_after[class_to_index[pred_after]]
        )

        true_label = row["target_label"]
        before_correct = pred_before == true_label
        after_correct = pred_after == true_label
        flipped = pred_before != pred_after

        if affected:
            confidence_deltas.append(after_conf - before_conf)

        if flipped:
            prediction_flips += 1

        if before_correct and not after_correct:
            correct_to_wrong += 1

        if not before_correct and after_correct:
            wrong_to_correct += 1

        out = {
            "sample_id": row["sample_id"],
            "true_label": true_label,
            "original_prediction": pred_before,
            "masked_prediction": pred_after,
            "prediction_flipped": int(flipped),
            "original_correct": int(before_correct),
            "masked_correct": int(after_correct),
            "original_confidence": before_conf,
            "masked_confidence": after_conf,
            "confidence_delta": after_conf - before_conf,
            "cue_groups": "|".join(sorted(set(groups))),
            "cue_match_count": len(groups),
            "original_text": original_text,
            "masked_text": masked_text,
        }

        output_rows.append(out)

        if flipped:
            flip_rows.append(out)

    by_class = {}

    for label in EXPECTED_LABELS:
        by_class[label] = {
            "support": int(masked_report[label]["support"]),
            "original": {
                "precision": float(original_report[label]["precision"]),
                "recall": float(original_report[label]["recall"]),
                "f1": float(original_report[label]["f1-score"]),
            },
            "masked": {
                "precision": float(masked_report[label]["precision"]),
                "recall": float(masked_report[label]["recall"]),
                "f1": float(masked_report[label]["f1-score"]),
            },
            "f1_delta": float(
                masked_report[label]["f1-score"]
                - original_report[label]["f1-score"]
            ),
        }

    report = {
        "diagnostic": "synthetic_shortcut_masking_validation_v2",
        "validation_records": len(rows),
        "test_used": False,
        "original_metrics": original_metrics,
        "masked_metrics": masked_metrics,
        "metric_delta": {
            key: masked_metrics[key] - original_metrics[key]
            for key in original_metrics
        },
        "affected_records": affected_records,
        "affected_share": affected_records / len(rows),
        "prediction_flips": prediction_flips,
        "correct_to_wrong": correct_to_wrong,
        "wrong_to_correct": wrong_to_correct,
        "mean_confidence_delta_on_affected": (
            float(np.mean(confidence_deltas))
            if confidence_deltas
            else 0.0
        ),
        "cue_group_record_counts": dict(cue_group_record_counts),
        "cue_group_match_counts": dict(cue_group_match_counts),
        "per_class": by_class,
        "interpretation_note": (
            "Queda grande após mascarar frases administrativas/discursivas "
            "sugere dependência de assinatura sintética. Queda pequena sugere "
            "que o modelo mantém a decisão usando conteúdo semântico restante."
        ),
    }

    evaluation_dir.mkdir(parents=True, exist_ok=True)

    report_path = (
        evaluation_dir
        / "shortcut_stress_test_validation.json"
    )

    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")

    fields = [
        "sample_id",
        "true_label",
        "original_prediction",
        "masked_prediction",
        "prediction_flipped",
        "original_correct",
        "masked_correct",
        "original_confidence",
        "masked_confidence",
        "confidence_delta",
        "cue_groups",
        "cue_match_count",
        "original_text",
        "masked_text",
    ]

    write_csv(
        evaluation_dir
        / "shortcut_stress_predictions_validation.csv",
        output_rows,
        fields,
    )

    write_csv(
        evaluation_dir
        / "shortcut_stress_flips_validation.csv",
        flip_rows,
        fields,
    )

    print("\n=== SHORTCUT STRESS TEST ===")
    print(f"Validation records : {len(rows)}")
    print(f"Registros afetados : {affected_records}")
    print(f"Prediction flips   : {prediction_flips}")
    print(f"Correct -> wrong   : {correct_to_wrong}")
    print(f"Wrong -> correct   : {wrong_to_correct}")

    print("\nOriginal:")
    print(f"  accuracy : {original_metrics['accuracy']:.4f}")
    print(f"  macro_f1 : {original_metrics['macro_f1']:.4f}")

    print("\nMasked:")
    print(f"  accuracy : {masked_metrics['accuracy']:.4f}")
    print(f"  macro_f1 : {masked_metrics['macro_f1']:.4f}")

    print("\nDelta:")
    print(
        f"  accuracy : "
        f"{masked_metrics['accuracy'] - original_metrics['accuracy']:+.4f}"
    )
    print(
        f"  macro_f1 : "
        f"{masked_metrics['macro_f1'] - original_metrics['macro_f1']:+.4f}"
    )

    print("\nPor classe (F1 original -> masked):")
    for label in EXPECTED_LABELS:
        info = by_class[label]
        print(
            f"  {label:<30} "
            f"{info['original']['f1']:.4f} -> "
            f"{info['masked']['f1']:.4f} "
            f"({info['f1_delta']:+.4f})"
        )

    print(f"\nRelatório: {report_path}")
    print("TESTE NÃO FOI UTILIZADO.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"\n[ERRO] {exc}", file=sys.stderr)
        raise SystemExit(1)
