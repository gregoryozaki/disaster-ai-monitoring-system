#!/usr/bin/env python3
"""
Auditoria global do dataset sintético de NLP do KAMARA.

Entrada padrão:
    ml/data/interim/nlp/synthetic_occurrences_v1.jsonl

Saídas:
    ml/data/interim/nlp/audit_report_v1.json
    ml/evaluation/nlp/near_duplicate_candidates_v1.csv

Objetivo:
- validar integridade estrutural dos 9.000 registros;
- verificar equilíbrio de classes, perfis e dificuldade;
- medir comprimento e diversidade lexical;
- detectar vazamento explícito de códigos/labels no texto;
- localizar frases/prefixos excessivamente repetidos;
- apontar termos/ngramas fortemente associados a uma classe;
- auditar parte dos metadados noise_features;
- procurar candidatos a quase-duplicata via TF-IDF de caracteres
  quando scikit-learn estiver disponível.

O script NÃO altera o dataset e NÃO cria train/validation/test.

Uso, a partir da raiz do repositório:
    python ml/preprocessing/nlp/audit_dataset.py

Opcional:
    python ml/preprocessing/nlp/audit_dataset.py --near-threshold 0.90
    python ml/preprocessing/nlp/audit_dataset.py --skip-near-duplicates
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


EXPECTED_TOTAL = 9000
EXPECTED_PER_CLASS = 1000

EXPECTED_LABEL_TO_CODE: dict[str, str | None] = {
    "COBRADE_1_2_1_0_0": "1.2.1.0.0",
    "COBRADE_1_2_2_0_0": "1.2.2.0.0",
    "COBRADE_1_2_3_0_0": "1.2.3.0.0",
    "COBRADE_1_4_1_3_1": "1.4.1.3.1",
    "COBRADE_1_4_1_3_2": "1.4.1.3.2",
    "COBRADE_2_3_1_1_0": "2.3.1.1.0",
    "COBRADE_2_3_1_2_0": "2.3.1.2.0",
    "OTHER": None,
    "INSUFFICIENT_INFO": None,
}

EXPECTED_PROFILE_COUNTS_PER_CLASS = {
    "neutral": 200,
    "formal": 100,
    "informal": 200,
    "chat_abbreviated": 150,
    "slang": 80,
    "typo_no_accents": 100,
    "profanity_emotional": 50,
    "indirect": 70,
    "mixed_noisy": 50,
}

EXPECTED_DIFFICULTY_COUNTS_PER_CLASS = {
    "typical": 500,
    "intermediate": 300,
    "hard": 200,
}

REQUIRED_FIELDS = {
    "sample_id",
    "text",
    "target_label",
    "cobrade_code",
    "scenario_family",
    "linguistic_profile",
    "noise_features",
    "difficulty",
    "generation_batch",
    "prompt_version",
    "generator_model",
    "synthetic",
    "review_status",
    "review_notes",
}

COBRADE_CODES = {
    code for code in EXPECTED_LABEL_TO_CODE.values() if code is not None
}

CANONICAL_TERMS = {
    "COBRADE_1_2_1_0_0": ["inundação", "inundacao"],
    "COBRADE_1_2_2_0_0": ["enxurrada"],
    "COBRADE_1_2_3_0_0": ["alagamento"],
    "COBRADE_1_4_1_3_1": ["incêndio florestal", "incendio florestal"],
    "COBRADE_1_4_1_3_2": ["incêndio florestal", "incendio florestal"],
    "COBRADE_2_3_1_1_0": ["incêndio industrial", "incendio industrial"],
    "COBRADE_2_3_1_2_0": [
        "aglomerado residencial",
        "aglomerados residenciais",
    ],
    "OTHER": [],
    "INSUFFICIENT_INFO": [],
}

# Stopwords curtas para que a análise de atalhos lexicais não seja dominada
# por artigos/preposições. Não há stemming nem remoção do texto original.
STOPWORDS = {
    "a", "o", "as", "os", "um", "uma", "uns", "umas",
    "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos",
    "por", "para", "pra", "pro", "com", "sem", "e", "ou",
    "que", "q", "se", "mais", "muito", "muita", "muitos", "muitas",
    "ja", "já", "aqui", "ali", "la", "lá", "ao", "aos",
    "esta", "está", "estao", "estão", "ta", "tao", "tem", "teve",
    "foi", "foram", "fica", "ficou", "ficando", "depois", "antes",
    "agora", "agr", "aq", "d", "c", "n", "pq",
}

TOKEN_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9_]+", re.UNICODE)

ABBREVIATION_RE = re.compile(
    r"\b(?:aq|agr|mt|n|pq|vc|tbm|tb|dps|c|pra|pro|q)\b",
    re.IGNORECASE,
)

PROFANITY_RE = re.compile(
    r"\b(?:pqp|porra|caralho|krl|merda|foda|fdp)\b",
    re.IGNORECASE,
)

EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "]",
    flags=re.UNICODE,
)


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "ml").is_dir():
            return candidate
    raise RuntimeError(
        "Não foi possível localizar a raiz do repositório. "
        "Execute o script dentro de disaster-ai-monitoring-system."
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def tokenize(text: str) -> list[str]:
    return [token.casefold() for token in TOKEN_RE.findall(text)]


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    k = (len(ordered) - 1) * p
    floor = math.floor(k)
    ceil = math.ceil(k)
    if floor == ceil:
        return float(ordered[floor])
    return float(
        ordered[floor] * (ceil - k)
        + ordered[ceil] * (k - floor)
    )


def summarize_numeric(values: list[int]) -> dict[str, float | int]:
    return {
        "count": len(values),
        "min": min(values) if values else 0,
        "p25": round(percentile(values, 0.25), 2),
        "median": round(percentile(values, 0.50), 2),
        "mean": round(statistics.mean(values), 2) if values else 0.0,
        "p75": round(percentile(values, 0.75), 2),
        "p95": round(percentile(values, 0.95), 2),
        "max": max(values) if values else 0,
    }


def load_dataset(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    with path.open("r", encoding="utf-8") as file:
        for line_number, raw_line in enumerate(file, start=1):
            line = raw_line.strip()
            if not line:
                raise ValueError(f"Linha vazia em {path}:{line_number}")

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

            missing = REQUIRED_FIELDS - row.keys()
            if missing:
                raise ValueError(
                    f"{path}:{line_number} sem campos: {sorted(missing)}"
                )

            rows.append(row)

    return rows


def structural_audit(rows: list[dict[str, Any]]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if len(rows) != EXPECTED_TOTAL:
        errors.append(
            f"Total={len(rows)}; esperado={EXPECTED_TOTAL}."
        )

    ids = [row["sample_id"] for row in rows]
    duplicate_ids = [
        sample_id
        for sample_id, count in Counter(ids).items()
        if count > 1
    ]
    if duplicate_ids:
        errors.append(
            f"Há {len(duplicate_ids)} sample_id duplicados."
        )

    normalized = [normalize_text(row["text"]) for row in rows]
    duplicate_text_groups = [
        text
        for text, count in Counter(normalized).items()
        if count > 1
    ]
    if duplicate_text_groups:
        errors.append(
            "Há "
            f"{len(duplicate_text_groups)} grupos de textos exatamente duplicados."
        )

    label_counts = Counter(row["target_label"] for row in rows)

    unknown_labels = set(label_counts) - set(EXPECTED_LABEL_TO_CODE)
    if unknown_labels:
        errors.append(f"Labels desconhecidos: {sorted(unknown_labels)}")

    for label in EXPECTED_LABEL_TO_CODE:
        count = label_counts.get(label, 0)
        if count != EXPECTED_PER_CLASS:
            errors.append(
                f"{label}: {count} registros; esperado {EXPECTED_PER_CLASS}."
            )

    wrong_codes: list[str] = []
    invalid_synthetic: list[str] = []
    empty_texts: list[str] = []
    empty_scenarios: list[str] = []

    for row in rows:
        expected_code = EXPECTED_LABEL_TO_CODE.get(row["target_label"])

        if row["cobrade_code"] != expected_code:
            wrong_codes.append(row["sample_id"])

        if row["synthetic"] is not True:
            invalid_synthetic.append(row["sample_id"])

        if not isinstance(row["text"], str) or not row["text"].strip():
            empty_texts.append(row["sample_id"])

        if (
            not isinstance(row["scenario_family"], str)
            or not row["scenario_family"].strip()
        ):
            empty_scenarios.append(row["sample_id"])

    if wrong_codes:
        errors.append(
            f"{len(wrong_codes)} registros com cobrade_code incompatível."
        )
    if invalid_synthetic:
        errors.append(
            f"{len(invalid_synthetic)} registros sem synthetic=true."
        )
    if empty_texts:
        errors.append(f"{len(empty_texts)} textos vazios.")
    if empty_scenarios:
        errors.append(
            f"{len(empty_scenarios)} scenario_family vazios."
        )

    code_leaks: list[dict[str, str]] = []
    label_leaks: list[dict[str, str]] = []

    for row in rows:
        text_cf = row["text"].casefold()

        for code in COBRADE_CODES:
            if code in row["text"]:
                code_leaks.append(
                    {
                        "sample_id": row["sample_id"],
                        "code": code,
                    }
                )

        label_literal = row["target_label"].casefold()
        if label_literal in text_cf:
            label_leaks.append(
                {
                    "sample_id": row["sample_id"],
                    "label": row["target_label"],
                }
            )

    if code_leaks:
        errors.append(
            f"{len(code_leaks)} textos contêm código COBRADE literal."
        )
    if label_leaks:
        warnings.append(
            f"{len(label_leaks)} textos contêm target_label literal."
        )

    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "warnings": warnings,
        "total_records": len(rows),
        "unique_sample_ids": len(set(ids)),
        "unique_normalized_texts": len(set(normalized)),
        "duplicate_sample_id_count": len(duplicate_ids),
        "exact_duplicate_text_group_count": len(duplicate_text_groups),
        "label_counts": dict(label_counts),
        "wrong_code_count": len(wrong_codes),
        "code_leak_count": len(code_leaks),
        "label_literal_leak_count": len(label_leaks),
    }


def distribution_audit(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_class_profiles: dict[str, Counter[str]] = defaultdict(Counter)
    by_class_difficulty: dict[str, Counter[str]] = defaultdict(Counter)
    by_class_scenarios: dict[str, Counter[str]] = defaultdict(Counter)

    profile_mismatches: list[dict[str, Any]] = []
    difficulty_mismatches: list[dict[str, Any]] = []

    for row in rows:
        label = row["target_label"]
        by_class_profiles[label][row["linguistic_profile"]] += 1
        by_class_difficulty[label][row["difficulty"]] += 1
        by_class_scenarios[label][row["scenario_family"]] += 1

    for label in EXPECTED_LABEL_TO_CODE:
        actual_profiles = by_class_profiles[label]
        actual_difficulty = by_class_difficulty[label]

        if dict(actual_profiles) != EXPECTED_PROFILE_COUNTS_PER_CLASS:
            profile_mismatches.append(
                {
                    "label": label,
                    "actual": dict(actual_profiles),
                    "expected": EXPECTED_PROFILE_COUNTS_PER_CLASS,
                }
            )

        if dict(actual_difficulty) != EXPECTED_DIFFICULTY_COUNTS_PER_CLASS:
            difficulty_mismatches.append(
                {
                    "label": label,
                    "actual": dict(actual_difficulty),
                    "expected": EXPECTED_DIFFICULTY_COUNTS_PER_CLASS,
                }
            )

    scenario_summary = {}
    for label, counts in by_class_scenarios.items():
        scenario_summary[label] = {
            "unique_scenario_families": len(counts),
            "top_10": counts.most_common(10),
            "min_count": min(counts.values()) if counts else 0,
            "max_count": max(counts.values()) if counts else 0,
        }

    return {
        "profile_distribution_by_class": {
            label: dict(counts)
            for label, counts in by_class_profiles.items()
        },
        "difficulty_distribution_by_class": {
            label: dict(counts)
            for label, counts in by_class_difficulty.items()
        },
        "profile_mismatch_count": len(profile_mismatches),
        "difficulty_mismatch_count": len(difficulty_mismatches),
        "profile_mismatches": profile_mismatches,
        "difficulty_mismatches": difficulty_mismatches,
        "scenario_summary_by_class": scenario_summary,
    }


def text_statistics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_class_chars: dict[str, list[int]] = defaultdict(list)
    by_class_tokens: dict[str, list[int]] = defaultdict(list)
    by_class_vocab: dict[str, set[str]] = defaultdict(set)

    global_tokens: list[str] = []

    for row in rows:
        label = row["target_label"]
        tokens = tokenize(row["text"])

        by_class_chars[label].append(len(row["text"]))
        by_class_tokens[label].append(len(tokens))
        by_class_vocab[label].update(tokens)
        global_tokens.extend(tokens)

    result = {
        "global": {
            "char_length": summarize_numeric(
                [len(row["text"]) for row in rows]
            ),
            "token_length": summarize_numeric(
                [len(tokenize(row["text"])) for row in rows]
            ),
            "vocabulary_size": len(set(global_tokens)),
            "total_tokens": len(global_tokens),
            "type_token_ratio": round(
                len(set(global_tokens)) / len(global_tokens), 6
            )
            if global_tokens
            else 0.0,
        },
        "by_class": {},
    }

    for label in EXPECTED_LABEL_TO_CODE:
        result["by_class"][label] = {
            "char_length": summarize_numeric(by_class_chars[label]),
            "token_length": summarize_numeric(by_class_tokens[label]),
            "vocabulary_size": len(by_class_vocab[label]),
        }

    return result


def canonical_term_audit(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_label: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        by_label[row["target_label"]].append(row)

    result: dict[str, Any] = {}

    for label, terms in CANONICAL_TERMS.items():
        label_rows = by_label[label]

        count = 0
        term_counts = Counter()

        for row in label_rows:
            text_cf = row["text"].casefold()

            matched = False
            for term in terms:
                if term.casefold() in text_cf:
                    term_counts[term] += 1
                    matched = True
            if matched:
                count += 1

        result[label] = {
            "records": len(label_rows),
            "records_with_any_canonical_term": count,
            "share": round(count / len(label_rows), 4)
            if label_rows
            else 0.0,
            "term_counts": dict(term_counts),
        }

    return result


def prefix_signature_audit(
    rows: list[dict[str, Any]],
    n_tokens: int = 4,
    top_n: int = 20,
) -> dict[str, Any]:
    per_class: dict[str, Counter[str]] = defaultdict(Counter)

    for row in rows:
        tokens = tokenize(row["text"])
        if len(tokens) >= n_tokens:
            prefix = " ".join(tokens[:n_tokens])
            per_class[row["target_label"]][prefix] += 1

    result = {}

    for label in EXPECTED_LABEL_TO_CODE:
        counts = per_class[label]
        top = counts.most_common(top_n)
        max_share = (
            top[0][1] / EXPECTED_PER_CLASS
            if top
            else 0.0
        )

        result[label] = {
            "prefix_length_tokens": n_tokens,
            "unique_prefixes": len(counts),
            "top_prefixes": [
                {"prefix": prefix, "count": count}
                for prefix, count in top
            ],
            "most_common_prefix_share": round(max_share, 4),
        }

    return result


def iter_ngrams(tokens: list[str], n: int) -> Iterable[str]:
    if len(tokens) < n:
        return
    for i in range(len(tokens) - n + 1):
        yield " ".join(tokens[i:i+n])


def lexical_shortcut_audit(
    rows: list[dict[str, Any]],
    min_support: int = 25,
    purity_threshold: float = 0.90,
    max_items: int = 150,
) -> dict[str, Any]:
    """
    Reporta tokens, bigramas e trigramas que aparecem com suporte razoável e
    estão concentrados em uma única classe.

    Isso NÃO significa automaticamente vazamento. Ex.: "bueiro" pode ser um
    marcador semanticamente legítimo de alagamento. A lista serve para revisão.
    """
    result: dict[str, Any] = {}

    for n in (1, 2, 3):
        global_counts: Counter[str] = Counter()
        class_counts: dict[str, Counter[str]] = defaultdict(Counter)

        for row in rows:
            tokens = [
                token for token in tokenize(row["text"])
                if token not in STOPWORDS
            ]

            # presença por documento, não frequência bruta, para reduzir
            # influência de repetições no mesmo texto.
            if n == 1:
                features = set(tokens)
            else:
                features = set(iter_ngrams(tokens, n))

            for feature in features:
                global_counts[feature] += 1
                class_counts[feature][row["target_label"]] += 1

        suspicious = []

        for feature, support in global_counts.items():
            if support < min_support:
                continue

            counts = class_counts[feature]
            top_label, top_count = counts.most_common(1)[0]
            purity = top_count / support

            if purity >= purity_threshold:
                suspicious.append(
                    {
                        "feature": feature,
                        "n": n,
                        "support": support,
                        "top_label": top_label,
                        "top_label_count": top_count,
                        "class_purity": round(purity, 4),
                        "class_distribution": dict(counts),
                    }
                )

        suspicious.sort(
            key=lambda item: (
                item["class_purity"],
                item["support"],
            ),
            reverse=True,
        )

        result[f"{n}gram"] = {
            "min_support": min_support,
            "purity_threshold": purity_threshold,
            "candidate_count": len(suspicious),
            "top_candidates": suspicious[:max_items],
        }

    return result


def detectable_noise_features(text: str) -> set[str]:
    features: set[str] = set()

    if ABBREVIATION_RE.search(text):
        features.add("abbreviation")

    if PROFANITY_RE.search(text):
        features.add("profanity")

    if EMOJI_RE.search(text):
        features.add("emoji")

    letters = [char for char in text if char.isalpha()]
    if len(letters) >= 8:
        upper_ratio = sum(char.isupper() for char in letters) / len(letters)
        if upper_ratio >= 0.80:
            features.add("all_caps")

    if not any(
        unicodedata.combining(char)
        for char in unicodedata.normalize("NFD", text)
    ):
        features.add("no_accents")

    # Pontuação final simples. Não tenta julgar toda a gramática.
    if text and text[-1] not in ".!?":
        features.add("missing_punctuation")

    return features


def noise_metadata_audit(rows: list[dict[str, Any]]) -> dict[str, Any]:
    detectable = {
        "abbreviation",
        "profanity",
        "emoji",
        "all_caps",
        "no_accents",
        "missing_punctuation",
    }

    mismatches: list[dict[str, Any]] = []
    mismatch_by_profile = Counter()
    mismatch_by_feature = Counter()

    for row in rows:
        claimed = set(row["noise_features"]) & detectable
        observed = detectable_noise_features(row["text"])

        false_positive = sorted(claimed - observed)
        false_negative = sorted(observed - claimed)

        if false_positive or false_negative:
            mismatch_by_profile[row["linguistic_profile"]] += 1
            for feature in false_positive:
                mismatch_by_feature[f"claimed_not_detected:{feature}"] += 1
            for feature in false_negative:
                mismatch_by_feature[f"detected_not_claimed:{feature}"] += 1

            if len(mismatches) < 100:
                mismatches.append(
                    {
                        "sample_id": row["sample_id"],
                        "linguistic_profile": row["linguistic_profile"],
                        "claimed_detectable": sorted(claimed),
                        "observed_detectable": sorted(observed),
                        "claimed_not_detected": false_positive,
                        "detected_not_claimed": false_negative,
                        "text": row["text"],
                    }
                )

    return {
        "note": (
            "A checagem é heurística. Ela não avalia typo, slang ou "
            "informal_grammar automaticamente."
        ),
        "mismatch_record_count": sum(mismatch_by_profile.values()),
        "mismatch_share": round(
            sum(mismatch_by_profile.values()) / len(rows), 4
        )
        if rows
        else 0.0,
        "mismatch_by_profile": dict(mismatch_by_profile),
        "mismatch_by_feature": dict(mismatch_by_feature),
        "first_100_examples": mismatches,
    }


def near_duplicate_audit(
    rows: list[dict[str, Any]],
    output_csv: Path,
    threshold: float,
    neighbors: int,
) -> dict[str, Any]:
    """
    Usa TF-IDF de n-gramas de caracteres e vizinhos por cosseno.

    Se scikit-learn não estiver instalado, a auditoria principal continua e
    esta etapa é marcada como SKIPPED.
    """
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.neighbors import NearestNeighbors
    except ImportError:
        return {
            "status": "SKIPPED",
            "reason": (
                "scikit-learn não está instalado no ambiente. "
                "As demais auditorias foram executadas."
            ),
            "candidate_count": None,
            "cross_class_candidate_count": None,
        }

    texts = [normalize_text(row["text"]) for row in rows]

    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        min_df=2,
        max_features=120_000,
        sublinear_tf=True,
        norm="l2",
    )

    matrix = vectorizer.fit_transform(texts)

    n_neighbors = min(neighbors + 1, len(rows))

    model = NearestNeighbors(
        n_neighbors=n_neighbors,
        metric="cosine",
        algorithm="brute",
        n_jobs=-1,
    )
    model.fit(matrix)

    distances, indices = model.kneighbors(matrix)

    pairs: dict[tuple[int, int], float] = {}

    for i in range(len(rows)):
        for distance, j in zip(distances[i], indices[i]):
            if i == j:
                continue

            similarity = 1.0 - float(distance)

            if similarity < threshold:
                continue

            a, b = sorted((i, int(j)))
            key = (a, b)

            if key not in pairs or similarity > pairs[key]:
                pairs[key] = similarity

    candidates = []

    for (i, j), similarity in sorted(
        pairs.items(),
        key=lambda item: item[1],
        reverse=True,
    ):
        row_a = rows[i]
        row_b = rows[j]

        candidates.append(
            {
                "similarity": round(similarity, 6),
                "same_class": (
                    row_a["target_label"] == row_b["target_label"]
                ),
                "sample_id_a": row_a["sample_id"],
                "label_a": row_a["target_label"],
                "sample_id_b": row_b["sample_id"],
                "label_b": row_b["target_label"],
                "text_a": row_a["text"],
                "text_b": row_b["text"],
            }
        )

    output_csv.parent.mkdir(parents=True, exist_ok=True)

    with output_csv.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "similarity",
                "same_class",
                "sample_id_a",
                "label_a",
                "sample_id_b",
                "label_b",
                "text_a",
                "text_b",
            ],
        )
        writer.writeheader()
        writer.writerows(candidates)

    cross_class = [
        candidate for candidate in candidates
        if not candidate["same_class"]
    ]

    return {
        "status": "DONE",
        "method": (
            "TF-IDF char_wb 3-5 grams + cosine nearest neighbors"
        ),
        "threshold": threshold,
        "neighbors_per_record": neighbors,
        "candidate_count": len(candidates),
        "same_class_candidate_count": (
            len(candidates) - len(cross_class)
        ),
        "cross_class_candidate_count": len(cross_class),
        "max_similarity": (
            candidates[0]["similarity"]
            if candidates
            else None
        ),
        "output_csv": str(output_csv),
    }


def build_summary(
    structural: dict[str, Any],
    distributions: dict[str, Any],
    prefixes: dict[str, Any],
    shortcuts: dict[str, Any],
    noise: dict[str, Any],
    near: dict[str, Any],
) -> dict[str, Any]:
    warnings: list[str] = []

    if structural["status"] != "PASS":
        warnings.append(
            "Falha estrutural: o dataset não deve seguir para split."
        )

    if distributions["profile_mismatch_count"] > 0:
        warnings.append(
            "Há classes com distribuição de linguistic_profile diferente "
            "do plano."
        )

    if distributions["difficulty_mismatch_count"] > 0:
        warnings.append(
            "Há classes com distribuição de difficulty diferente do plano."
        )

    high_prefix_classes = [
        label
        for label, info in prefixes.items()
        if info["most_common_prefix_share"] >= 0.05
    ]
    if high_prefix_classes:
        warnings.append(
            "Há classes em que um mesmo prefixo de 4 tokens aparece em "
            ">=5% dos registros; revisar assinatura do gerador."
        )

    shortcut_count = sum(
        section["candidate_count"]
        for section in shortcuts.values()
    )
    if shortcut_count:
        warnings.append(
            "Foram encontrados termos/ngramas com alta pureza de classe. "
            "Isso pode ser semântico ou um atalho sintético; revisar."
        )

    if noise["mismatch_record_count"] > 0:
        warnings.append(
            "noise_features possui inconsistências heurísticas. "
            "Não tratar esse metadado como ground truth sem revisão."
        )

    if near["status"] == "DONE":
        if near["cross_class_candidate_count"] > 0:
            warnings.append(
                "Há candidatos a quase-duplicata entre classes diferentes; "
                "revisar antes do split."
            )
        if near["candidate_count"] > 0:
            warnings.append(
                "Há candidatos a quase-duplicata; usar agrupamento por "
                "similaridade no split para evitar leakage."
            )
    else:
        warnings.append(
            "Auditoria de quase-duplicatas não foi executada."
        )

    ready_for_split = (
        structural["status"] == "PASS"
        and near.get("status") == "DONE"
    )

    return {
        "structural_status": structural["status"],
        "ready_for_split": ready_for_split,
        "warning_count": len(warnings),
        "warnings": warnings,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audita o dataset consolidado de NLP do KAMARA."
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Raiz do repositório; autodetectada quando omitida.",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help=(
            "Arquivo JSONL consolidado. O padrão é "
            "ml/data/interim/nlp/synthetic_occurrences_v1.jsonl"
        ),
    )
    parser.add_argument(
        "--near-threshold",
        type=float,
        default=0.90,
        help="Similaridade mínima para candidato a quase-duplicata.",
    )
    parser.add_argument(
        "--near-neighbors",
        type=int,
        default=5,
        help="Número de vizinhos examinados por registro.",
    )
    parser.add_argument(
        "--skip-near-duplicates",
        action="store_true",
        help="Pula a etapa de similaridade com scikit-learn.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    repo_root = (
        args.repo_root.resolve()
        if args.repo_root
        else find_repo_root(Path.cwd())
    )

    input_path = (
        args.input.resolve()
        if args.input
        else (
            repo_root
            / "ml"
            / "data"
            / "interim"
            / "nlp"
            / "synthetic_occurrences_v1.jsonl"
        )
    )

    report_path = (
        repo_root
        / "ml"
        / "data"
        / "interim"
        / "nlp"
        / "audit_report_v1.json"
    )

    near_csv = (
        repo_root
        / "ml"
        / "evaluation"
        / "nlp"
        / "near_duplicate_candidates_v1.csv"
    )

    if not input_path.is_file():
        raise FileNotFoundError(
            f"Dataset consolidado não encontrado: {input_path}"
        )

    print(f"Lendo: {input_path}")
    rows = load_dataset(input_path)

    print("1/8 Integridade estrutural...")
    structural = structural_audit(rows)

    print("2/8 Distribuições de classe/perfil/dificuldade...")
    distributions = distribution_audit(rows)

    print("3/8 Estatísticas de comprimento e vocabulário...")
    text_stats = text_statistics(rows)

    print("4/8 Uso dos nomes canônicos das classes...")
    canonical = canonical_term_audit(rows)

    print("5/8 Assinaturas repetidas no início dos textos...")
    prefixes = prefix_signature_audit(rows)

    print("6/8 Possíveis atalhos lexicais...")
    shortcuts = lexical_shortcut_audit(rows)

    print("7/8 Consistência heurística de noise_features...")
    noise = noise_metadata_audit(rows)

    print("8/8 Candidatos a quase-duplicata...")
    if args.skip_near_duplicates:
        near = {
            "status": "SKIPPED",
            "reason": "Ignorado por --skip-near-duplicates.",
            "candidate_count": None,
            "cross_class_candidate_count": None,
        }
    else:
        near = near_duplicate_audit(
            rows=rows,
            output_csv=near_csv,
            threshold=args.near_threshold,
            neighbors=args.near_neighbors,
        )

    summary = build_summary(
        structural=structural,
        distributions=distributions,
        prefixes=prefixes,
        shortcuts=shortcuts,
        noise=noise,
        near=near,
    )

    report = {
        "dataset": {
            "path": str(input_path),
            "sha256": sha256_file(input_path),
            "records": len(rows),
        },
        "summary": summary,
        "structural_audit": structural,
        "distribution_audit": distributions,
        "text_statistics": text_stats,
        "canonical_term_audit": canonical,
        "prefix_signature_audit": prefixes,
        "lexical_shortcut_audit": shortcuts,
        "noise_metadata_audit": noise,
        "near_duplicate_audit": near,
    }

    report_path.parent.mkdir(parents=True, exist_ok=True)

    with report_path.open("w", encoding="utf-8") as file:
        json.dump(
            report,
            file,
            ensure_ascii=False,
            indent=2,
        )
        file.write("\n")

    print("\nAuditoria concluída.")
    print(f"Relatório: {report_path}")

    if near.get("status") == "DONE":
        print(f"Quase-duplicatas: {near_csv}")

    print(f"Status estrutural: {summary['structural_status']}")
    print(
        "Pronto para split (critério automático mínimo): "
        f"{summary['ready_for_split']}"
    )

    print("\nAvisos:")
    if summary["warnings"]:
        for warning in summary["warnings"]:
            print(f"  - {warning}")
    else:
        print("  Nenhum aviso.")

    print("\nResumo de quase-duplicatas:")
    print(f"  status: {near.get('status')}")
    print(f"  candidatos: {near.get('candidate_count')}")
    print(
        "  candidatos entre classes diferentes: "
        f"{near.get('cross_class_candidate_count')}"
    )

    # Código 2 apenas quando há falha estrutural.
    if structural["status"] != "PASS":
        return 2

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrompido pelo usuário.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"\n[ERRO] {exc}", file=sys.stderr)
        raise SystemExit(1)
