#!/usr/bin/env python3
"""
Split group-aware + estratificado do dataset sintético de NLP do KAMARA.

CORREÇÃO EM RELAÇÃO À VERSÃO ANTERIOR
-------------------------------------
A versão anterior preservava:
- tamanho exato por classe;
- grupos de quase-duplicatas no mesmo split;

mas podia criar forte desbalanceamento de linguistic_profile entre
train/validation/test.

Esta versão usa otimização inteira (MILP, via scipy.optimize.milp) para manter:
1. cada grupo de quase-duplicatas inteiro em um único split;
2. exatamente 700/150/150 registros por classe;
3. linguistic_profile o mais próximo possível da proporção 70/15/15;
4. difficulty o mais próximo possível da proporção 70/15/15;
5. scenario_family aproximadamente distribuído, com peso menor.

IMPORTANTE
----------
Os alvos de linguistic_profile e difficulty são calculados a partir da
distribuição REAL de cada classe. Portanto, esta etapa não altera nem "corrige"
metadados de geração; apenas evita que o split introduza um novo desbalanceamento.

Entrada:
    ml/data/interim/nlp/synthetic_occurrences_v1.jsonl
    ml/evaluation/nlp/near_duplicate_candidates_v1.csv

Saídas:
    ml/data/processed/nlp/train.jsonl
    ml/data/processed/nlp/validation.jsonl
    ml/data/processed/nlp/test.jsonl
    ml/evaluation/nlp/split_manifest_v2.csv
    ml/evaluation/nlp/split_summary_v2.json

Uso:
    python ml/preprocessing/nlp/split_dataset.py --force

Requer:
    scipy com scipy.optimize.milp
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

try:
    from scipy.optimize import Bounds, LinearConstraint, milp
    from scipy.sparse import coo_matrix
except ImportError as exc:
    raise RuntimeError(
        "Esta versão do split requer scipy com scipy.optimize.milp. "
        "Instale/registre scipy no ambiente de ML."
    ) from exc


EXPECTED_TOTAL = 9000
EXPECTED_PER_CLASS = 1000

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

SPLITS = ("train", "validation", "test")

# Prioridades da otimização.
# Perfil linguístico recebe prioridade máxima porque foi justamente o ponto
# problemático observado na primeira versão do split.
WEIGHTS = {
    "linguistic_profile": 10_000.0,
    "difficulty": 1_000.0,
    "scenario_family": 1.0,
}

TIE_BREAK_EPSILON = 1e-6


class UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}
        self.rank: dict[str, int] = {}

    def add(self, value: str) -> None:
        if value not in self.parent:
            self.parent[value] = value
            self.rank[value] = 0

    def find(self, value: str) -> str:
        self.add(value)
        if self.parent[value] != value:
            self.parent[value] = self.find(self.parent[value])
        return self.parent[value]

    def union(self, a: str, b: str) -> None:
        root_a = self.find(a)
        root_b = self.find(b)

        if root_a == root_b:
            return

        if self.rank[root_a] < self.rank[root_b]:
            root_a, root_b = root_b, root_a

        self.parent[root_b] = root_a

        if self.rank[root_a] == self.rank[root_b]:
            self.rank[root_a] += 1


@dataclass
class SimilarityGroup:
    group_id: str
    label: str
    sample_ids: list[str]
    linguistic_profile: Counter[str]
    difficulty: Counter[str]
    scenario_family: Counter[str]

    @property
    def size(self) -> int:
        return len(self.sample_ids)


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

            rows.append(row)

    return rows


def largest_remainder_targets(
    total: int,
    ratios: dict[str, float],
) -> dict[str, int]:
    """
    Converte proporções em contagens inteiras cuja soma continua sendo total.
    """
    raw = {
        split: total * ratios[split]
        for split in SPLITS
    }

    targets = {
        split: int(math.floor(raw[split]))
        for split in SPLITS
    }

    remaining = total - sum(targets.values())

    order = sorted(
        SPLITS,
        key=lambda split: (
            raw[split] - targets[split],
            -SPLITS.index(split),
        ),
        reverse=True,
    )

    for split in order[:remaining]:
        targets[split] += 1

    return targets


def load_similarity_edges(
    path: Path,
    threshold: float,
) -> list[tuple[str, str, str, str, float]]:
    edges: list[tuple[str, str, str, str, float]] = []

    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)

        required = {
            "similarity",
            "sample_id_a",
            "label_a",
            "sample_id_b",
            "label_b",
        }

        missing = required - set(reader.fieldnames or [])

        if missing:
            raise ValueError(
                f"CSV de similaridade sem colunas: {sorted(missing)}"
            )

        for row in reader:
            similarity = float(row["similarity"])

            if similarity < threshold:
                continue

            edges.append(
                (
                    row["sample_id_a"],
                    row["label_a"],
                    row["sample_id_b"],
                    row["label_b"],
                    similarity,
                )
            )

    return edges


def build_similarity_groups(
    rows: list[dict[str, Any]],
    edges: list[tuple[str, str, str, str, float]],
) -> tuple[
    dict[str, list[SimilarityGroup]],
    dict[str, str],
]:
    by_id = {
        row["sample_id"]: row
        for row in rows
    }

    if len(by_id) != len(rows):
        raise ValueError(
            "Há sample_id duplicado no dataset."
        )

    uf = UnionFind()

    for sample_id in by_id:
        uf.add(sample_id)

    cross_class_edges = []

    for id_a, label_a, id_b, label_b, similarity in edges:
        if id_a not in by_id or id_b not in by_id:
            raise ValueError(
                "CSV de similaridade referencia sample_id inexistente."
            )

        actual_a = by_id[id_a]["target_label"]
        actual_b = by_id[id_b]["target_label"]

        if actual_a != label_a or actual_b != label_b:
            raise ValueError(
                "Label no CSV de similaridade não corresponde ao dataset."
            )

        if label_a != label_b:
            cross_class_edges.append(
                {
                    "sample_id_a": id_a,
                    "label_a": label_a,
                    "sample_id_b": id_b,
                    "label_b": label_b,
                    "similarity": similarity,
                }
            )
            continue

        uf.union(id_a, id_b)

    if cross_class_edges:
        raise ValueError(
            "Há quase-duplicatas entre classes diferentes. "
            "Revisão manual necessária antes do split. "
            f"Exemplos: {cross_class_edges[:5]}"
        )

    components: dict[str, list[str]] = defaultdict(list)

    for sample_id in by_id:
        components[uf.find(sample_id)].append(sample_id)

    groups_by_label: dict[str, list[SimilarityGroup]] = defaultdict(list)
    sample_to_group: dict[str, str] = {}
    counters = Counter()

    # Ordenação para tornar os IDs dos grupos reproduzíveis.
    ordered_components = sorted(
        components.values(),
        key=lambda ids: min(ids),
    )

    for sample_ids in ordered_components:
        sample_ids = sorted(sample_ids)

        labels = {
            by_id[sample_id]["target_label"]
            for sample_id in sample_ids
        }

        if len(labels) != 1:
            raise ValueError(
                "Um componente de similaridade contém múltiplas classes."
            )

        label = next(iter(labels))
        counters[label] += 1

        group_id = (
            f"{label.lower()}_simgrp_{counters[label]:04d}"
        )

        group_rows = [
            by_id[sample_id]
            for sample_id in sample_ids
        ]

        group = SimilarityGroup(
            group_id=group_id,
            label=label,
            sample_ids=sample_ids,
            linguistic_profile=Counter(
                row["linguistic_profile"]
                for row in group_rows
            ),
            difficulty=Counter(
                row["difficulty"]
                for row in group_rows
            ),
            scenario_family=Counter(
                row["scenario_family"]
                for row in group_rows
            ),
        )

        groups_by_label[label].append(group)

        for sample_id in sample_ids:
            sample_to_group[sample_id] = group_id

    return groups_by_label, sample_to_group


def deterministic_tie_break(
    group_id: str,
    split: str,
) -> float:
    raw = hashlib.sha256(
        f"{group_id}|{split}".encode("utf-8")
    ).digest()

    integer = int.from_bytes(raw[:8], "big")

    return (
        (integer / float(2**64 - 1))
        * TIE_BREAK_EPSILON
    )


def optimize_class_assignment(
    class_rows: list[dict[str, Any]],
    groups: list[SimilarityGroup],
    ratios: dict[str, float],
    time_limit: float,
) -> tuple[dict[str, str], dict[str, Any]]:
    """
    Resolve o split de UMA classe como problema MILP.

    Variáveis:
        x[group, split] em {0,1}

    Restrições duras:
        - todo grupo pertence exatamente a um split;
        - cada split recebe o tamanho exato esperado.

    Objetivo:
        minimizar desvios absolutos das distribuições de:
        1. linguistic_profile
        2. difficulty
        3. scenario_family
    """
    if not class_rows:
        raise ValueError("Classe sem registros.")

    label = class_rows[0]["target_label"]

    if any(row["target_label"] != label for row in class_rows):
        raise ValueError(
            "optimize_class_assignment recebeu múltiplas classes."
        )

    group_count = len(groups)
    split_count = len(SPLITS)

    size_targets = largest_remainder_targets(
        len(class_rows),
        ratios,
    )

    field_values: dict[str, list[str]] = {}

    for field in WEIGHTS:
        field_values[field] = sorted(
            {
                str(row[field])
                for row in class_rows
            }
        )

    # Índices das variáveis x[group, split].
    def x_index(group_idx: int, split_idx: int) -> int:
        return group_idx * split_count + split_idx

    objective: list[float] = []
    integrality: list[int] = []
    lower_bounds: list[float] = []
    upper_bounds: list[float] = []

    for group in groups:
        for split in SPLITS:
            objective.append(
                deterministic_tie_break(
                    group.group_id,
                    split,
                )
            )
            integrality.append(1)
            lower_bounds.append(0.0)
            upper_bounds.append(1.0)

    # Cada desvio recebe duas variáveis contínuas:
    # positive_deviation e negative_deviation.
    deviation_specs: list[
        tuple[str, str, int, int, int, int]
    ] = []

    for field, values in field_values.items():
        for value in values:
            total_value = sum(
                str(row[field]) == value
                for row in class_rows
            )

            targets = largest_remainder_targets(
                total_value,
                ratios,
            )

            for split_idx, split in enumerate(SPLITS):
                positive_idx = len(objective)

                objective.append(WEIGHTS[field])
                integrality.append(0)
                lower_bounds.append(0.0)
                upper_bounds.append(np.inf)

                negative_idx = len(objective)

                objective.append(WEIGHTS[field])
                integrality.append(0)
                lower_bounds.append(0.0)
                upper_bounds.append(np.inf)

                deviation_specs.append(
                    (
                        field,
                        value,
                        split_idx,
                        targets[split],
                        positive_idx,
                        negative_idx,
                    )
                )

    number_of_variables = len(objective)

    row_indices: list[int] = []
    column_indices: list[int] = []
    coefficients: list[float] = []
    constraint_lower: list[float] = []
    constraint_upper: list[float] = []

    constraint_idx = 0

    # Restrição 1:
    # cada grupo vai para exatamente um split.
    for group_idx in range(group_count):
        for split_idx in range(split_count):
            row_indices.append(constraint_idx)
            column_indices.append(
                x_index(group_idx, split_idx)
            )
            coefficients.append(1.0)

        constraint_lower.append(1.0)
        constraint_upper.append(1.0)
        constraint_idx += 1

    # Restrição 2:
    # tamanho de cada split exatamente 700/150/150 por classe.
    for split_idx, split in enumerate(SPLITS):
        for group_idx, group in enumerate(groups):
            row_indices.append(constraint_idx)
            column_indices.append(
                x_index(group_idx, split_idx)
            )
            coefficients.append(float(group.size))

        target = float(size_targets[split])

        constraint_lower.append(target)
        constraint_upper.append(target)
        constraint_idx += 1

    # Restrições de desvio absoluto:
    #
    # actual - positive + negative = target
    #
    # Como positive/negative entram no objetivo com peso positivo,
    # o solver minimiza |actual - target|.
    for (
        field,
        value,
        split_idx,
        target,
        positive_idx,
        negative_idx,
    ) in deviation_specs:
        for group_idx, group in enumerate(groups):
            group_counter: Counter[str] = getattr(
                group,
                field,
            )

            count = group_counter.get(value, 0)

            if count:
                row_indices.append(constraint_idx)
                column_indices.append(
                    x_index(group_idx, split_idx)
                )
                coefficients.append(float(count))

        row_indices.append(constraint_idx)
        column_indices.append(positive_idx)
        coefficients.append(-1.0)

        row_indices.append(constraint_idx)
        column_indices.append(negative_idx)
        coefficients.append(1.0)

        target_float = float(target)

        constraint_lower.append(target_float)
        constraint_upper.append(target_float)
        constraint_idx += 1

    matrix = coo_matrix(
        (
            coefficients,
            (row_indices, column_indices),
        ),
        shape=(
            constraint_idx,
            number_of_variables,
        ),
    ).tocsr()

    result = milp(
        c=np.asarray(objective, dtype=float),
        integrality=np.asarray(
            integrality,
            dtype=int,
        ),
        bounds=Bounds(
            np.asarray(lower_bounds, dtype=float),
            np.asarray(upper_bounds, dtype=float),
        ),
        constraints=LinearConstraint(
            matrix,
            np.asarray(
                constraint_lower,
                dtype=float,
            ),
            np.asarray(
                constraint_upper,
                dtype=float,
            ),
        ),
        options={
            "time_limit": time_limit,
            "mip_rel_gap": 0.0,
        },
    )

    if result.x is None:
        raise RuntimeError(
            f"O solver não encontrou solução para {label}. "
            f"Mensagem: {result.message}"
        )

    assignments_matrix = result.x[
        : group_count * split_count
    ].reshape(group_count, split_count)

    assignment: dict[str, str] = {}

    for group_idx, group in enumerate(groups):
        chosen_idx = int(
            np.argmax(assignments_matrix[group_idx])
        )

        chosen_value = assignments_matrix[
            group_idx,
            chosen_idx,
        ]

        if chosen_value < 0.5:
            raise RuntimeError(
                f"Solução inválida para grupo {group.group_id}."
            )

        assignment[group.group_id] = SPLITS[
            chosen_idx
        ]

    solver_info = {
        "success": bool(result.success),
        "status": int(result.status),
        "message": str(result.message),
        "objective": (
            round(float(result.fun), 6)
            if result.fun is not None
            else None
        ),
    }

    return assignment, solver_info


def write_jsonl(
    path: Path,
    rows: list[dict[str, Any]],
) -> None:
    with path.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file:
        for row in rows:
            file.write(
                json.dumps(
                    row,
                    ensure_ascii=False,
                )
                + "\n"
            )


def distribution_targets_for_class(
    class_rows: list[dict[str, Any]],
    field: str,
    ratios: dict[str, float],
) -> dict[str, dict[str, int]]:
    counts = Counter(
        str(row[field])
        for row in class_rows
    )

    result = {
        split: {}
        for split in SPLITS
    }

    for value, total in counts.items():
        targets = largest_remainder_targets(
            total,
            ratios,
        )

        for split in SPLITS:
            result[split][value] = targets[split]

    return result


def absolute_deviation(
    actual: dict[str, int],
    target: dict[str, int],
) -> int:
    keys = set(actual) | set(target)

    return sum(
        abs(
            int(actual.get(key, 0))
            - int(target.get(key, 0))
        )
        for key in keys
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Cria split group-aware estratificado "
            "do dataset NLP KAMARA."
        )
    )

    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
    )
    parser.add_argument(
        "--near-threshold",
        type=float,
        default=0.90,
    )
    parser.add_argument(
        "--train-ratio",
        type=float,
        default=0.70,
    )
    parser.add_argument(
        "--validation-ratio",
        type=float,
        default=0.15,
    )
    parser.add_argument(
        "--test-ratio",
        type=float,
        default=0.15,
    )
    parser.add_argument(
        "--solver-time-limit",
        type=float,
        default=60.0,
        help="Limite em segundos por classe.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    repo_root = (
        args.repo_root.resolve()
        if args.repo_root
        else find_repo_root(Path.cwd())
    )

    ratios = {
        "train": args.train_ratio,
        "validation": args.validation_ratio,
        "test": args.test_ratio,
    }

    if not math.isclose(
        sum(ratios.values()),
        1.0,
        abs_tol=1e-9,
    ):
        raise ValueError(
            f"As proporções precisam somar 1.0: {ratios}"
        )

    if any(
        value <= 0
        for value in ratios.values()
    ):
        raise ValueError(
            "Todas as proporções precisam ser > 0."
        )

    input_path = (
        repo_root
        / "ml"
        / "data"
        / "interim"
        / "nlp"
        / "synthetic_occurrences_v1.jsonl"
    )

    similarity_path = (
        repo_root
        / "ml"
        / "evaluation"
        / "nlp"
        / "near_duplicate_candidates_v1.csv"
    )

    processed_dir = (
        repo_root
        / "ml"
        / "data"
        / "processed"
        / "nlp"
    )

    evaluation_dir = (
        repo_root
        / "ml"
        / "evaluation"
        / "nlp"
    )

    output_paths = {
        "train": processed_dir / "train.jsonl",
        "validation": processed_dir / "validation.jsonl",
        "test": processed_dir / "test.jsonl",
    }

    manifest_path = (
        evaluation_dir
        / "split_manifest_v2.csv"
    )

    summary_path = (
        evaluation_dir
        / "split_summary_v2.json"
    )

    required_files = [
        input_path,
        similarity_path,
    ]

    for path in required_files:
        if not path.is_file():
            raise FileNotFoundError(
                f"Arquivo obrigatório não encontrado: {path}"
            )

    existing = [
        path
        for path in [
            *output_paths.values(),
            manifest_path,
            summary_path,
        ]
        if path.exists()
    ]

    if existing and not args.force:
        raise FileExistsError(
            "Já existem arquivos de split. "
            "Use --force para recriá-los:\n"
            + "\n".join(
                str(path)
                for path in existing
            )
        )

    print(f"Lendo dataset: {input_path}")
    rows = load_jsonl(input_path)

    if len(rows) != EXPECTED_TOTAL:
        raise ValueError(
            f"Dataset possui {len(rows)} registros; "
            f"esperado {EXPECTED_TOTAL}."
        )

    label_counts = Counter(
        row["target_label"]
        for row in rows
    )

    if set(label_counts) != set(EXPECTED_LABELS):
        raise ValueError(
            "Conjunto de labels inesperado: "
            f"{sorted(label_counts)}"
        )

    for label in EXPECTED_LABELS:
        if label_counts[label] != EXPECTED_PER_CLASS:
            raise ValueError(
                f"{label}: {label_counts[label]}; "
                f"esperado {EXPECTED_PER_CLASS}."
            )

    print(
        "Lendo quase-duplicatas "
        f">= {args.near_threshold:.2f}: "
        f"{similarity_path}"
    )

    edges = load_similarity_edges(
        similarity_path,
        threshold=args.near_threshold,
    )

    print(
        f"Arestas usadas para agrupamento: {len(edges)}"
    )

    groups_by_label, sample_to_group = (
        build_similarity_groups(
            rows=rows,
            edges=edges,
        )
    )

    by_id = {
        row["sample_id"]: row
        for row in rows
    }

    assignment_by_group: dict[str, str] = {}
    solver_by_class: dict[str, Any] = {}

    print(
        "\nOtimizando splits por classe "
        "(group-aware + stratificação)..."
    )

    for label in EXPECTED_LABELS:
        class_rows = [
            row
            for row in rows
            if row["target_label"] == label
        ]

        groups = groups_by_label[label]

        assignment, solver_info = (
            optimize_class_assignment(
                class_rows=class_rows,
                groups=groups,
                ratios=ratios,
                time_limit=args.solver_time_limit,
            )
        )

        assignment_by_group.update(
            assignment
        )

        solver_by_class[label] = solver_info

        group_sizes = [
            group.size
            for group in groups
        ]

        print(
            f"[OK] {label:<28} "
            f"groups={len(groups):>4}  "
            f"multi={sum(size > 1 for size in group_sizes):>3}  "
            f"max_group={max(group_sizes):>2}  "
            f"solver_status={solver_info['status']}"
        )

    split_rows: dict[str, list[dict[str, Any]]] = {
        split: []
        for split in SPLITS
    }

    manifest_rows: list[dict[str, Any]] = []

    for row in rows:
        group_id = sample_to_group[
            row["sample_id"]
        ]

        split = assignment_by_group[
            group_id
        ]

        processed_row = dict(row)

        # Esses campos são metadados de particionamento,
        # não devem virar input textual do modelo.
        processed_row["split"] = split
        processed_row[
            "similarity_group_id"
        ] = group_id

        split_rows[split].append(
            processed_row
        )

        manifest_rows.append(
            {
                "sample_id": row["sample_id"],
                "target_label": row["target_label"],
                "split": split,
                "similarity_group_id": group_id,
                "scenario_family": row["scenario_family"],
                "linguistic_profile": row["linguistic_profile"],
                "difficulty": row["difficulty"],
            }
        )

    # ---------------------------------------------------------
    # Validação dos tamanhos
    # ---------------------------------------------------------
    all_ids = [
        row["sample_id"]
        for split in SPLITS
        for row in split_rows[split]
    ]

    if len(all_ids) != EXPECTED_TOTAL:
        raise ValueError(
            f"Split contém {len(all_ids)} registros."
        )

    if len(set(all_ids)) != EXPECTED_TOTAL:
        raise ValueError(
            "Há sample_id repetido entre os splits."
        )

    expected_global_sizes = (
        largest_remainder_targets(
            EXPECTED_TOTAL,
            ratios,
        )
    )

    actual_global_sizes = {
        split: len(split_rows[split])
        for split in SPLITS
    }

    if actual_global_sizes != expected_global_sizes:
        raise ValueError(
            "Tamanhos globais incorretos.\n"
            f"Obtido: {actual_global_sizes}\n"
            f"Esperado: {expected_global_sizes}"
        )

    expected_per_class = (
        largest_remainder_targets(
            EXPECTED_PER_CLASS,
            ratios,
        )
    )

    class_split_counts: dict[
        str,
        dict[str, int],
    ] = {}

    for label in EXPECTED_LABELS:
        class_split_counts[label] = {}

        for split in SPLITS:
            count = sum(
                row["target_label"] == label
                for row in split_rows[split]
            )

            class_split_counts[
                label
            ][split] = count

            if count != expected_per_class[split]:
                raise ValueError(
                    f"{label}/{split}: "
                    f"{count}; esperado "
                    f"{expected_per_class[split]}."
                )

    # ---------------------------------------------------------
    # Validação de leakage das arestas de similaridade
    # ---------------------------------------------------------
    split_by_id = {
        row["sample_id"]: split
        for split in SPLITS
        for row in split_rows[split]
    }

    crossing_edges = []

    for (
        id_a,
        _label_a,
        id_b,
        _label_b,
        similarity,
    ) in edges:
        if (
            split_by_id[id_a]
            != split_by_id[id_b]
        ):
            crossing_edges.append(
                {
                    "sample_id_a": id_a,
                    "sample_id_b": id_b,
                    "similarity": similarity,
                    "split_a": split_by_id[id_a],
                    "split_b": split_by_id[id_b],
                }
            )

    if crossing_edges:
        raise ValueError(
            f"{len(crossing_edges)} arestas "
            "de quase-duplicatas cruzaram splits."
        )

    # ---------------------------------------------------------
    # Resumo das distribuições
    # ---------------------------------------------------------
    distribution_summary: dict[str, Any] = {}

    for label in EXPECTED_LABELS:
        class_rows = [
            row
            for row in rows
            if row["target_label"] == label
        ]

        distribution_summary[label] = {}

        for field in (
            "linguistic_profile",
            "difficulty",
            "scenario_family",
        ):
            targets = (
                distribution_targets_for_class(
                    class_rows,
                    field,
                    ratios,
                )
            )

            actual: dict[
                str,
                dict[str, int],
            ] = {}

            deviations: dict[
                str,
                int,
            ] = {}

            for split in SPLITS:
                counts = Counter(
                    str(row[field])
                    for row in split_rows[split]
                    if row["target_label"] == label
                )

                actual[split] = dict(counts)

                deviations[split] = (
                    absolute_deviation(
                        actual=dict(counts),
                        target=targets[split],
                    )
                )

            distribution_summary[label][field] = {
                "targets": targets,
                "actual": actual,
                "absolute_deviation_by_split": deviations,
                "total_absolute_deviation": sum(
                    deviations.values()
                ),
            }

    # ---------------------------------------------------------
    # Escrita
    # ---------------------------------------------------------
    processed_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    evaluation_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    for split in SPLITS:
        split_rows[split].sort(
            key=lambda row: (
                row["target_label"],
                row["sample_id"],
            )
        )

        write_jsonl(
            output_paths[split],
            split_rows[split],
        )

    manifest_rows.sort(
        key=lambda row: (
            row["split"],
            row["target_label"],
            row["sample_id"],
        )
    )

    with manifest_path.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "sample_id",
                "target_label",
                "split",
                "similarity_group_id",
                "scenario_family",
                "linguistic_profile",
                "difficulty",
            ],
        )

        writer.writeheader()
        writer.writerows(
            manifest_rows
        )

    group_sizes = [
        group.size
        for groups in groups_by_label.values()
        for group in groups
    ]

    summary = {
        "version": 2,
        "method": (
            "MILP group-aware split with exact class sizes "
            "and soft stratification targets"
        ),
        "input_dataset": {
            "path": str(input_path),
            "sha256": sha256_file(
                input_path
            ),
            "records": len(rows),
        },
        "near_duplicate_source": {
            "path": str(similarity_path),
            "sha256": sha256_file(
                similarity_path
            ),
            "threshold": args.near_threshold,
            "edge_count_used": len(edges),
        },
        "split_parameters": {
            "ratios": ratios,
            "solver_time_limit_per_class_seconds": (
                args.solver_time_limit
            ),
            "weights": WEIGHTS,
        },
        "solver_by_class": solver_by_class,
        "split_sizes": actual_global_sizes,
        "expected_per_class_split": expected_per_class,
        "class_split_counts": class_split_counts,
        "similarity_groups": {
            "total_groups": len(group_sizes),
            "non_singleton_groups": sum(
                size > 1
                for size in group_sizes
            ),
            "max_group_size": max(
                group_sizes
            ),
            "cross_split_similarity_edges": (
                len(crossing_edges)
            ),
        },
        "distribution_summary": (
            distribution_summary
        ),
        "files": {
            split: {
                "path": str(
                    output_paths[split]
                ),
                "sha256": sha256_file(
                    output_paths[split]
                ),
            }
            for split in SPLITS
        },
        "manifest": {
            "path": str(manifest_path),
            "sha256": sha256_file(
                manifest_path
            ),
        },
        "note": (
            "test.jsonl é um teste sintético interno. "
            "Não substitui avaliação manual/externa independente."
        ),
    }

    with summary_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            summary,
            file,
            ensure_ascii=False,
            indent=2,
        )
        file.write("\n")

    # ---------------------------------------------------------
    # Saída resumida no terminal
    # ---------------------------------------------------------
    print("\nSplit v2 concluído com sucesso.")
    print(
        f"train={len(split_rows['train'])}, "
        f"validation={len(split_rows['validation'])}, "
        f"test={len(split_rows['test'])}"
    )

    print(
        "Por classe: "
        f"{expected_per_class['train']}/"
        f"{expected_per_class['validation']}/"
        f"{expected_per_class['test']}"
    )

    print(
        "Arestas de quase-duplicatas "
        "cruzando splits: "
        f"{len(crossing_edges)}"
    )

    print(
        "\nDesvio total de linguistic_profile "
        "por classe (menor é melhor):"
    )

    for label in EXPECTED_LABELS:
        deviation = (
            distribution_summary[label]
            ["linguistic_profile"]
            ["total_absolute_deviation"]
        )

        print(
            f"  {label:<30} "
            f"{deviation}"
        )

    print(
        "\nDesvio total de difficulty "
        "por classe (menor é melhor):"
    )

    for label in EXPECTED_LABELS:
        deviation = (
            distribution_summary[label]
            ["difficulty"]
            ["total_absolute_deviation"]
        )

        print(
            f"  {label:<30} "
            f"{deviation}"
        )

    print(f"\nManifesto v2: {manifest_path}")
    print(f"Resumo v2: {summary_path}")

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
