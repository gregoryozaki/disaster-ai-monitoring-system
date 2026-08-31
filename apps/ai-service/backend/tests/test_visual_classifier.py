from __future__ import annotations

import json

from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from PIL import Image

import app.models.visual_classifier as visual_classifier_module

from app.models.visual_classifier import (
    OnnxVisualClassifier,
)


class FakeOnnxSession:
    def __init__(
        self,
        logits: np.ndarray,
    ) -> None:
        self._logits = logits

        self.last_feed: dict[
            str,
            np.ndarray,
        ] | None = None

    def get_inputs(
        self,
    ) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                name="image",
            )
        ]

    def get_outputs(
        self,
    ) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                name="logits",
            )
        ]

    def run(
        self,
        output_names: list[str],
        input_feed: dict[
            str,
            np.ndarray,
        ],
    ) -> list[np.ndarray]:
        self.last_feed = (
            input_feed
        )

        assert output_names == [
            "logits"
        ]

        return [
            self._logits
        ]


def create_mapping(
    path: Path,
    *,
    threshold: float = 0.80,
) -> None:
    mapping = {
        "modelType": "VISUAL",

        "modelName": (
            "test-mobilenet"
        ),

        "modelVersion": "test-1.0.0",

        "indexToLabel": {
            "0": "FLOOD_WATER",
            "1": "FIRE_SMOKE",
            "2": "OTHER",
        },

        "labelToIndex": {
            "FLOOD_WATER": 0,
            "FIRE_SMOKE": 1,
            "OTHER": 2,
        },

        "uncertain": {
            "label": "UNCERTAIN",
            "threshold": threshold,
        },

        "input": {
            "size": [
                224,
                224,
            ],

            "colorMode": "RGB",

            "normalizationMean": [
                0.485,
                0.456,
                0.406,
            ],

            "normalizationStd": [
                0.229,
                0.224,
                0.225,
            ],
        },
    }

    path.write_text(
        json.dumps(
            mapping
        ),
        encoding="utf-8",
    )


def create_png_bytes() -> bytes:
    image = Image.new(
        "RGB",
        (
            320,
            240,
        ),
        (
            120,
            160,
            200,
        ),
    )

    buffer = BytesIO()

    image.save(
        buffer,
        format="PNG",
    )

    return buffer.getvalue()


def build_classifier(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    *,
    logits: np.ndarray,
    threshold: float = 0.80,
) -> tuple[
    OnnxVisualClassifier,
    FakeOnnxSession,
]:
    model_path = (
        tmp_path
        / "model.onnx"
    )

    mapping_path = (
        tmp_path
        / "class_mapping.json"
    )

    model_path.write_bytes(
        b"fake-onnx"
    )

    create_mapping(
        mapping_path,
        threshold=threshold,
    )

    fake_session = FakeOnnxSession(
        logits=logits,
    )

    def fake_inference_session(
        *args,
        **kwargs,
    ) -> FakeOnnxSession:
        return fake_session

    monkeypatch.setattr(
        visual_classifier_module.ort,
        "InferenceSession",
        fake_inference_session,
    )

    classifier = (
        OnnxVisualClassifier(
            model_path=model_path,
            class_mapping_path=(
                mapping_path
            ),
        )
    )

    return (
        classifier,
        fake_session,
    )


def test_visual_classifier_returns_flood_water(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    classifier, session = (
        build_classifier(
            tmp_path,
            monkeypatch,
            logits=np.asarray(
                [
                    [
                        5.0,
                        1.0,
                        0.0,
                    ]
                ],
                dtype=np.float32,
            ),
        )
    )

    result = classifier.classify(
        image_bytes=(
            create_png_bytes()
        ),
        content_type="image/png",
    )

    assert (
        result.result_status
        == "AVAILABLE"
    )

    assert (
        result.predicted_label
        == "FLOOD_WATER"
    )

    assert result.confidence is not None

    assert result.confidence > 0.80

    assert (
        result.candidate_cobrade_codes
        == (
            "1.2.1.0.0",
            "1.2.2.0.0",
            "1.2.3.0.0",
        )
    )

    assert (
        result.model_name
        == "test-mobilenet"
    )

    assert (
        result.model_version
        == "test-1.0.0"
    )

    assert (
        result.synthetic_data
        is False
    )

    assert session.last_feed is not None

    model_input = session.last_feed[
        "image"
    ]

    assert (
        model_input.shape
        == (
            1,
            3,
            224,
            224,
        )
    )

    assert (
        model_input.dtype
        == np.float32
    )

    assert np.isfinite(
        model_input
    ).all()


def test_visual_classifier_returns_uncertain(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    classifier, _ = (
        build_classifier(
            tmp_path,
            monkeypatch,
            logits=np.asarray(
                [
                    [
                        1.0,
                        0.9,
                        0.8,
                    ]
                ],
                dtype=np.float32,
            ),
            threshold=0.80,
        )
    )

    result = classifier.classify(
        image_bytes=(
            create_png_bytes()
        ),
        content_type="image/png",
    )

    assert (
        result.result_status
        == "AVAILABLE"
    )

    assert (
        result.predicted_label
        == "UNCERTAIN"
    )

    assert result.confidence is not None

    assert result.confidence < 0.80

    assert (
        result.candidate_cobrade_codes
        == ()
    )

    assert (
        "UNCERTAIN"
        in result.explanation_simple
    )


def test_visual_classifier_rejects_invalid_image(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    classifier, session = (
        build_classifier(
            tmp_path,
            monkeypatch,
            logits=np.asarray(
                [
                    [
                        5.0,
                        1.0,
                        0.0,
                    ]
                ],
                dtype=np.float32,
            ),
        )
    )

    result = classifier.classify(
        image_bytes=(
            b"isso-nao-e-uma-imagem"
        ),
        content_type="image/png",
    )

    assert (
        result.result_status
        == "ERROR"
    )

    assert (
        result.predicted_label
        is None
    )

    assert result.confidence is None

    assert session.last_feed is None


def test_visual_classifier_rejects_unsupported_mime_type(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    classifier, session = (
        build_classifier(
            tmp_path,
            monkeypatch,
            logits=np.asarray(
                [
                    [
                        5.0,
                        1.0,
                        0.0,
                    ]
                ],
                dtype=np.float32,
            ),
        )
    )

    result = classifier.classify(
        image_bytes=(
            create_png_bytes()
        ),
        content_type="image/gif",
    )

    assert (
        result.result_status
        == "ERROR"
    )

    assert (
        result.predicted_label
        is None
    )

    assert result.confidence is None

    assert session.last_feed is None

def test_visual_classifier_rejects_mime_mismatch(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    classifier, session = (
        build_classifier(
            tmp_path,
            monkeypatch,
            logits=np.asarray(
                [
                    [
                        5.0,
                        1.0,
                        0.0,
                    ]
                ],
                dtype=np.float32,
            ),
        )
    )

    result = classifier.classify(
        image_bytes=(
            create_png_bytes()
        ),
        content_type="image/jpeg",
    )

    assert (
        result.result_status
        == "ERROR"
    )

    assert (
        result.predicted_label
        is None
    )

    assert result.confidence is None

    assert session.last_feed is None