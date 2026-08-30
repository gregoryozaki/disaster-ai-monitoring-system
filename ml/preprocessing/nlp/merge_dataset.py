#!/usr/bin/env python3
"""
Consolida os 9 arquivos brutos do dataset sintético de NLP do KAMARA.

Entrada:
    ml/data/raw/nlp/*.jsonl

Saída:
    ml/data/interim/nlp/synthetic_occurrences_v1.jsonl

O script NÃO faz split de treino/validação/teste.
Antes de escrever a saída, valida:
- existência dos 9 arquivos;
- exatamente 1000 registros por arquivo;
- JSON válido;
- campos obrigatórios;
- target_label e cobrade_code esperados;
- synthetic == true;
- sample_id não vazio e globalmente único;
- texto não vazio;
- ausência de duplicatas exatas após normalização simples;
- total final de exatamente 9000 registros.

Uso, a partir da raiz do repositório:
    python ml/preprocessing/nlp/merge_dataset.py

Para sobrescrever uma saída já existente:
    python ml/preprocessing/nlp/merge_dataset.py --force
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


EXPECTED_FILES: dict[str, tuple[str, str | None]] = {
    "inundacoes_v1.jsonl": ("COBRADE_1_2_1_0_0", "1.2.1.0.0"),
    "enxurradas_v1.jsonl": ("COBRADE_1_2_2_0_0", "1.2.2.0.0"),
    "alagamentos_v1.jsonl": ("COBRADE_1_2_3_0_0", "1.2.3.0.0"),
    "incendio_florestal_protegido_v1.jsonl": (
        "COBRADE_1_4_1_3_1",
        "1.4.1.3.1",
    ),
    "incendio_florestal_nao_protegido_v1.jsonl": (
        "COBRADE_1_4_1_3_2",
        "1.4.1.3.2",
    ),
    "incendio_industrial_v1.jsonl": (
        "COBRADE_2_3_1_1_0",
        "2.3.1.1.0",
    ),
    "incendio_aglomerado_residencial_v1.jsonl": (
        "COBRADE_2_3_1_2_0",
        "2.3.1.2.0",
    ),
    "other_v1.jsonl": ("OTHER", None),
    "insufficient_info_v1.jsonl": ("INSUFFICIENT_INFO", None),
}

EXPECTED_PER_FILE = 1000
EXPECTED_TOTAL = 9000

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

ALLOWED_DIFFICULTIES = {"typical", "intermediate", "hard"}

ALLOWED_PROFILES = {
    "neutral",
    "formal",
    "informal",
    "chat_abbreviated",
    "slang",
    "typo_no_accents",
    "profanity_emotional",
    "indirect",
    "mixed_noisy",
}


def normalize_text(text: str) -> str:
    """Normalização SOMENTE para detecção de duplicata exata."""
    return re.sub(r"\s+", " ", text).strip().casefold()


def find_repo_root(start: Path) -> Path:
    """
    Procura a raiz do repositório subindo diretórios.
    A raiz esperada contém o diretório ml/.
    """
    current = start.resolve()

    for candidate in [current, *current.parents]:
        if (candidate / "ml").is_dir():
            return candidate

    raise RuntimeError(
        "Não foi possível localizar a raiz do repositório. "
        "Execute o script dentro de disaster-ai-monitoring-system."
    )


def load_jsonl(
    path: Path,
    expected_label: str,
    expected_code: str | None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    with path.open("r", encoding="utf-8") as file:
        for line_number, raw_line in enumerate(file, start=1):
            line = raw_line.strip()

            if not line:
                raise ValueError(
                    f"{path}: linha {line_number} está vazia."
                )

            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"{path}: JSON inválido na linha {line_number}: {exc}"
                ) from exc

            if not isinstance(row, dict):
                raise ValueError(
                    f"{path}: linha {line_number} não contém um objeto JSON."
                )

            missing_fields = REQUIRED_FIELDS - row.keys()
            if missing_fields:
                raise ValueError(
                    f"{path}: linha {line_number} sem campos obrigatórios: "
                    f"{sorted(missing_fields)}"
                )

            sample_id = row["sample_id"]
            text = row["text"]

            if not isinstance(sample_id, str) or not sample_id.strip():
                raise ValueError(
                    f"{path}: sample_id inválido na linha {line_number}."
                )

            if not isinstance(text, str) or not text.strip():
                raise ValueError(
                    f"{path}: text vazio/inválido na linha {line_number}."
                )

            if row["target_label"] != expected_label:
                raise ValueError(
                    f"{path}: linha {line_number} possui target_label="
                    f"{row['target_label']!r}; esperado {expected_label!r}."
                )

            if row["cobrade_code"] != expected_code:
                raise ValueError(
                    f"{path}: linha {line_number} possui cobrade_code="
                    f"{row['cobrade_code']!r}; esperado {expected_code!r}."
                )

            if row["synthetic"] is not True:
                raise ValueError(
                    f"{path}: linha {line_number} deve possuir synthetic=true."
                )

            if row["difficulty"] not in ALLOWED_DIFFICULTIES:
                raise ValueError(
                    f"{path}: difficulty inválido na linha {line_number}: "
                    f"{row['difficulty']!r}."
                )

            if row["linguistic_profile"] not in ALLOWED_PROFILES:
                raise ValueError(
                    f"{path}: linguistic_profile inválido na linha {line_number}: "
                    f"{row['linguistic_profile']!r}."
                )

            if not isinstance(row["noise_features"], list):
                raise ValueError(
                    f"{path}: noise_features deve ser lista na linha {line_number}."
                )

            if not isinstance(row["scenario_family"], str) or not row["scenario_family"].strip():
                raise ValueError(
                    f"{path}: scenario_family inválido na linha {line_number}."
                )

            rows.append(row)

    if len(rows) != EXPECTED_PER_FILE:
        raise ValueError(
            f"{path}: possui {len(rows)} registros; "
            f"esperado exatamente {EXPECTED_PER_FILE}."
        )

    local_ids = [row["sample_id"] for row in rows]
    if len(local_ids) != len(set(local_ids)):
        counts = Counter(local_ids)
        duplicates = [value for value, count in counts.items() if count > 1]
        raise ValueError(
            f"{path}: sample_id duplicado dentro do arquivo. "
            f"Exemplos: {duplicates[:10]}"
        )

    return rows


def validate_global(rows: list[dict[str, Any]]) -> None:
    if len(rows) != EXPECTED_TOTAL:
        raise ValueError(
            f"Total consolidado inválido: {len(rows)}; esperado {EXPECTED_TOTAL}."
        )

    sample_ids = [row["sample_id"] for row in rows]
    if len(sample_ids) != len(set(sample_ids)):
        counts = Counter(sample_ids)
        duplicates = [value for value, count in counts.items() if count > 1]
        raise ValueError(
            "Há sample_id duplicado entre arquivos. "
            f"Exemplos: {duplicates[:10]}"
        )

    normalized_to_ids: dict[str, list[str]] = {}

    for row in rows:
        key = normalize_text(row["text"])
        normalized_to_ids.setdefault(key, []).append(row["sample_id"])

    duplicate_groups = {
        text: ids
        for text, ids in normalized_to_ids.items()
        if len(ids) > 1
    }

    if duplicate_groups:
        examples = list(duplicate_groups.values())[:10]
        raise ValueError(
            "Foram encontradas duplicatas exatas de texto após "
            f"casefold/normalização de espaços. Exemplos de IDs: {examples}"
        )

    label_counts = Counter(row["target_label"] for row in rows)

    expected_labels = {
        label: EXPECTED_PER_FILE
        for label, _ in EXPECTED_FILES.values()
    }

    if dict(label_counts) != expected_labels:
        raise ValueError(
            "Distribuição final de classes diferente da esperada.\n"
            f"Obtido: {dict(label_counts)}\n"
            f"Esperado: {expected_labels}"
        )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Consolida os 9 arquivos brutos do dataset NLP KAMARA."
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help=(
            "Raiz do repositório. Se omitida, o script tenta detectá-la "
            "automaticamente."
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Permite sobrescrever o arquivo consolidado existente.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    repo_root = (
        args.repo_root.resolve()
        if args.repo_root
        else find_repo_root(Path.cwd())
    )

    raw_dir = repo_root / "ml" / "data" / "raw" / "nlp"
    output_dir = repo_root / "ml" / "data" / "interim" / "nlp"
    output_path = output_dir / "synthetic_occurrences_v1.jsonl"

    if not raw_dir.is_dir():
        raise FileNotFoundError(
            f"Diretório de entrada não encontrado: {raw_dir}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    if output_path.exists() and not args.force:
        raise FileExistsError(
            f"A saída já existe: {output_path}\n"
            "Use --force somente se quiser recriá-la."
        )

    all_rows: list[dict[str, Any]] = []

    print("Validando arquivos brutos...\n")

    for filename, (expected_label, expected_code) in EXPECTED_FILES.items():
        path = raw_dir / filename

        if not path.is_file():
            raise FileNotFoundError(
                f"Arquivo obrigatório não encontrado: {path}"
            )

        rows = load_jsonl(
            path=path,
            expected_label=expected_label,
            expected_code=expected_code,
        )

        all_rows.extend(rows)

        print(
            f"[OK] {filename:<48} "
            f"{len(rows):>4} registros  "
            f"{expected_label}"
        )

    print("\nExecutando validações globais...")
    validate_global(all_rows)

    # A ordem de saída é determinística:
    # ordem dos arquivos definida em EXPECTED_FILES e ordem interna de cada JSONL.
    with output_path.open("w", encoding="utf-8", newline="\n") as file:
        for row in all_rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")

    output_sha256 = sha256_file(output_path)
    label_counts = Counter(row["target_label"] for row in all_rows)

    print("\nDataset consolidado criado com sucesso.")
    print(f"Saída: {output_path}")
    print(f"Total: {len(all_rows)}")
    print("Classes:")

    for label, count in label_counts.items():
        print(f"  {label:<30} {count}")

    print(f"SHA-256: {output_sha256}")
    print("\nNenhum split foi criado nesta etapa.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"\n[ERRO] {exc}", file=sys.stderr)
        raise SystemExit(1)
