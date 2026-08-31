from __future__ import annotations

import json

from pathlib import Path
from types import SimpleNamespace

import pytest
import torch

import app.models.text_classifier as text_classifier_module

from app.models.text_classifier import (
    BertimbauTextClassifier,
)


LABELS = [
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


class FakeTokenizer:
    def __init__(
        self,
    ) -> None:
        self.last_text: str | None = None

        self.last_kwargs: dict[
            str,
            object,
        ] | None = None

    def __call__(
        self,
        text: str,
        **kwargs: object,
    ) -> dict[str, torch.Tensor]:
        self.last_text = text

        self.last_kwargs = kwargs

        return {
            "input_ids": torch.tensor(
                [
                    [
                        101,
                        102,
                    ]
                ],
                dtype=torch.long,
            ),

            "attention_mask": torch.tensor(
                [
                    [
                        1,
                        1,
                    ]
                ],
                dtype=torch.long,
            ),
        }


class FakeModel:
    def __init__(
        self,
        *,
        logits: torch.Tensor,
        fail_inference: bool = False,
    ) -> None:
        self.config = SimpleNamespace(
            id2label={
                index: label
                for index, label
                in enumerate(
                    LABELS
                )
            },

            num_labels=len(
                LABELS
            ),

            max_position_embeddings=512,
        )

        self._logits = logits

        self._fail_inference = (
            fail_inference
        )

        self.device: torch.device | None = (
            None
        )

        self.eval_called = False

    def to(
        self,
        device: torch.device,
    ) -> FakeModel:
        self.device = device

        return self

    def eval(
        self,
    ) -> FakeModel:
        self.eval_called = True

        return self

    def __call__(
        self,
        **kwargs: torch.Tensor,
    ) -> SimpleNamespace:
        if self._fail_inference:
            raise RuntimeError(
                "erro artificial de inferência"
            )

        assert "input_ids" in kwargs

        assert "attention_mask" in kwargs

        return SimpleNamespace(
            logits=self._logits
        )


def write_run_metadata(
    path: Path,
) -> None:
    path.write_text(
        json.dumps(
            {
                "run_name": (
                    "kamara_bertimbau_v2"
                ),

                "dataset_iteration": "v2",

                "max_length": 128,
            }
        ),
        encoding="utf-8",
    )


def build_classifier(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    *,
    predicted_index: int,
    fail_inference: bool = False,
) -> tuple[
    BertimbauTextClassifier,
    FakeTokenizer,
    FakeModel,
]:
    run_metadata_path = (
        tmp_path
        / "run_metadata.json"
    )

    write_run_metadata(
        run_metadata_path
    )

    fake_tokenizer = (
        FakeTokenizer()
    )

    logits = torch.zeros(
        (
            1,
            len(
                LABELS
            ),
        ),
        dtype=torch.float32,
    )

    logits[
        0,
        predicted_index,
    ] = 8.0

    fake_model = FakeModel(
        logits=logits,
        fail_inference=(
            fail_inference
        ),
    )

    monkeypatch.setattr(
        text_classifier_module.AutoTokenizer,
        "from_pretrained",
        lambda *args, **kwargs: (
            fake_tokenizer
        ),
    )

    monkeypatch.setattr(
        text_classifier_module
        .AutoModelForSequenceClassification,
        "from_pretrained",
        lambda *args, **kwargs: (
            fake_model
        ),
    )

    classifier = (
        BertimbauTextClassifier(
            model_dir=tmp_path,
            run_metadata_path=(
                run_metadata_path
            ),
            device="cpu",
        )
    )

    return (
        classifier,
        fake_tokenizer,
        fake_model,
    )


def test_text_classifier_returns_cobrade_label(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    (
        classifier,
        tokenizer,
        model,
    ) = build_classifier(
        tmp_path,
        monkeypatch,
        predicted_index=2,
    )

    text = (
        "Depois da chuva, os bueiros "
        "não deram vazão."
    )

    result = classifier.classify(
        text=text
    )

    assert (
        result.result_status
        == "AVAILABLE"
    )

    assert (
        result.predicted_label
        == "COBRADE_1_2_3_0_0"
    )

    assert result.confidence is not None

    assert result.confidence > 0.99

    assert (
        set(
            result.probabilities
        )
        == set(
            LABELS
        )
    )

    assert tokenizer.last_text == text

    assert tokenizer.last_kwargs == {
        "truncation": True,
        "padding": "max_length",
        "max_length": 128,
        "return_tensors": "pt",
    }

    assert model.eval_called is True

    assert model.device == torch.device(
        "cpu"
    )


@pytest.mark.parametrize(
    (
        "predicted_index",
        "expected_label",
    ),
    [
        (
            7,
            "OTHER",
        ),
        (
            8,
            "INSUFFICIENT_INFO",
        ),
    ],
)
def test_text_classifier_preserves_control_labels(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    predicted_index: int,
    expected_label: str,
) -> None:
    classifier, _, _ = (
        build_classifier(
            tmp_path,
            monkeypatch,
            predicted_index=(
                predicted_index
            ),
        )
    )

    result = classifier.classify(
        text=(
            "Texto usado para testar "
            "uma classe de controle."
        )
    )

    assert (
        result.result_status
        == "AVAILABLE"
    )

    assert (
        result.predicted_label
        == expected_label
    )

    assert result.confidence is not None


def test_text_classifier_returns_unavailable_for_blank_text(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    classifier, tokenizer, _ = (
        build_classifier(
            tmp_path,
            monkeypatch,
            predicted_index=0,
        )
    )

    result = classifier.classify(
        text="   "
    )

    assert (
        result.result_status
        == "UNAVAILABLE"
    )

    assert result.predicted_label is None

    assert result.confidence is None

    assert result.probabilities == {}

    assert tokenizer.last_text is None


def test_text_classifier_returns_error_on_inference_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    classifier, _, _ = (
        build_classifier(
            tmp_path,
            monkeypatch,
            predicted_index=0,
            fail_inference=True,
        )
    )

    result = classifier.classify(
        text=(
            "Texto utilizado para "
            "provocar erro artificial."
        )
    )

    assert (
        result.result_status
        == "ERROR"
    )

    assert result.predicted_label is None

    assert result.confidence is None

    assert result.probabilities == {}