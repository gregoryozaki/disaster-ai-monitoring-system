from __future__ import annotations

import pytest

from fastapi.testclient import (
    TestClient,
)

import app.services.classification_service as classification_service_module
from app.main import app

from app.models.text_classifier import (
    TextClassificationResult,
    TextLabel,
)


client = TestClient(
    app
)


class FakeTextClassifier:
    def __init__(
        self,
        result: TextClassificationResult,
    ) -> None:
        self._result = result

    def classify(
        self,
        *,
        text: str,
    ) -> TextClassificationResult:
        return self._result


def use_text_prediction(
    monkeypatch: pytest.MonkeyPatch,
    *,
    label: TextLabel,
    confidence: float,
) -> None:
    classifier = FakeTextClassifier(
        TextClassificationResult(
            result_status="AVAILABLE",

            predicted_label=label,

            confidence=confidence,

            probabilities={
                label: confidence,
            },

            explanation_simple=(
                "Classificação textual "
                "simulada para teste."
            ),

            model_name=(
                "fake-bertimbau"
            ),

            model_version="test-v2",

            synthetic_data=True,
        )
    )

    monkeypatch.setattr(
        classification_service_module,
        "get_text_classifier",
        lambda: classifier,
    )


def test_health() -> None:
    response = client.get(
        "/health"
    )

    assert response.status_code == 200

    assert response.json() == {
        "status": "ok",
        "service": "kamara-ai",
    }


def test_classify_flood_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_text_prediction(
        monkeypatch,
        label=(
            "COBRADE_1_2_3_0_0"
        ),
        confidence=0.91,
    )

    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "occurrence-test"
            ),

            "text": (
                "Alagamento causado "
                "pela chuva em via pública."
            ),
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert (
        body["resultStatus"]
        == "AVAILABLE"
    )

    assert (
        body[
            "predictedCobradeCode"
        ]
        == "1.2.3.0.0"
    )

    assert (
        body["confidence"]
        == 0.91
    )

    assert body["model"] == {
        "modelType": "TEXTUAL",
        "name": "fake-bertimbau",
        "version": "test-v2",
        "syntheticData": True,
    }

    assert (
        body["signals"][
            "textLabel"
        ]
        == "COBRADE_1_2_3_0_0"
    )

    assert (
        body["signals"][
            "textUsed"
        ]
        is True
    )

    assert (
        body["signals"][
            "imageReceived"
        ]
        is False
    )

    assert (
        body["signals"][
            "imageUsed"
        ]
        is False
    )


def test_classify_fire_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_text_prediction(
        monkeypatch,
        label=(
            "COBRADE_1_4_1_3_2"
        ),
        confidence=0.88,
    )

    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "occurrence-fire"
            ),

            "text": (
                "Incêndio em vegetação "
                "com fumaça intensa "
                "afetando a qualidade do ar."
            ),
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert (
        body["resultStatus"]
        == "AVAILABLE"
    )

    assert (
        body[
            "predictedCobradeCode"
        ]
        == "1.4.1.3.2"
    )

    assert (
        body["confidence"]
        == 0.88
    )

    assert (
        body["model"][
            "modelType"
        ]
        == "TEXTUAL"
    )

    assert (
        body["signals"][
            "textLabel"
        ]
        == "COBRADE_1_4_1_3_2"
    )


def test_classify_other_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_text_prediction(
        monkeypatch,
        label="OTHER",
        confidence=0.87,
    )

    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "occurrence-other"
            ),

            "text": (
                "Uma encosta deslizou "
                "e bloqueou a estrada."
            ),
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert (
        body["resultStatus"]
        == "AVAILABLE"
    )

    assert (
        body[
            "predictedCobradeCode"
        ]
        is None
    )

    assert (
        body["confidence"]
        == 0.87
    )

    assert (
        body["signals"][
            "textLabel"
        ]
        == "OTHER"
    )


def test_classify_insufficient_info_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_text_prediction(
        monkeypatch,

        label=(
            "INSUFFICIENT_INFO"
        ),

        confidence=0.72,
    )

    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "occurrence-insufficient"
            ),

            "text": (
                "Tem muita água aqui."
            ),
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert (
        body["resultStatus"]
        == "AVAILABLE"
    )

    assert (
        body[
            "predictedCobradeCode"
        ]
        is None
    )

    assert (
        body["confidence"]
        == 0.72
    )

    assert (
        body["signals"][
            "textLabel"
        ]
        == "INSUFFICIENT_INFO"
    )


def test_image_is_received_but_text_is_used_when_visual_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_text_prediction(
        monkeypatch,

        label=(
            "COBRADE_1_2_3_0_0"
        ),

        confidence=0.90,
    )

    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "occurrence-with-image"
            ),

            "text": (
                "Alagamento causado "
                "pela chuva."
            ),
        },

        files={
            "image": (
                "evidencia.png",

                (
                    b"conteudo-de-imagem-"
                    b"para-teste"
                ),

                "image/png",
            )
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert (
        body["resultStatus"]
        == "AVAILABLE"
    )

    assert (
        body[
            "predictedCobradeCode"
        ]
        == "1.2.3.0.0"
    )

    assert (
        body["signals"][
            "imageReceived"
        ]
        is True
    )

    assert (
        body["signals"][
            "imageUsed"
        ]
        is False
    )

    assert (
        body["signals"][
            "visualResultStatus"
        ]
        == "UNAVAILABLE"
    )


def test_image_without_text_returns_unavailable() -> None:
    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "image-only"
            ),
        },

        files={
            "image": (
                "evidencia.png",

                (
                    b"conteudo-de-imagem-"
                    b"para-teste"
                ),

                "image/png",
            )
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert (
        body["resultStatus"]
        == "UNAVAILABLE"
    )

    assert (
        body[
            "predictedCobradeCode"
        ]
        is None
    )

    assert body["confidence"] is None

    assert (
        body["model"][
            "modelType"
        ]
        == "VISUAL"
    )

    assert body["signals"] == {
        "occurrenceId": "image-only",
        "textUsed": False,
        "imageReceived": True,
        "imageUsed": False,
        "visualLabel": None,
        "candidateCobradeCodes": [],
    }


def test_rejects_unsupported_image_type() -> None:
    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "invalid-image"
            ),

            "text": "Alagamento.",
        },

        files={
            "image": (
                "arquivo.txt",
                b"arquivo-invalido",
                "text/plain",
            )
        },
    )

    assert response.status_code == 415

    assert response.json() == {
        "detail": (
            "Tipo de imagem "
            "não suportado."
        )
    }


def test_rejects_empty_image() -> None:
    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "empty-image"
            ),

            "text": "Alagamento.",
        },

        files={
            "image": (
                "vazia.png",
                b"",
                "image/png",
            )
        },
    )

    assert response.status_code == 422

    assert response.json() == {
        "detail": (
            "A imagem enviada "
            "está vazia."
        )
    }


def test_rejects_image_above_10_mb() -> None:
    oversized_image = bytes(
        10 * 1024 * 1024 + 1
    )

    response = client.post(
        "/classify",

        data={
            "occurrence_id": (
                "oversized-image"
            ),

            "text": "Alagamento.",
        },

        files={
            "image": (
                "grande.png",
                oversized_image,
                "image/png",
            )
        },
    )

    assert response.status_code == 413

    assert response.json() == {
        "detail": (
            "A imagem excede "
            "o limite de 10 MB."
        )
    }