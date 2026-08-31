from __future__ import annotations

import pytest

from app.models.text_classifier import (
    TextClassificationResult,
    TextLabel,
)

from app.models.visual_classifier import (
    VisualClassificationResult,
)

from app.services.classification_service import (
    classify_occurrence,
)


class FakeTextClassifier:
    def __init__(
        self,
        result: TextClassificationResult,
    ) -> None:
        self._result = result

        self.last_text: str | None = None

    def classify(
        self,
        *,
        text: str,
    ) -> TextClassificationResult:
        self.last_text = text

        return self._result


class ExplodingTextClassifier:
    def classify(
        self,
        *,
        text: str,
    ) -> TextClassificationResult:
        raise AssertionError(
            "O classificador textual "
            "não deveria ter sido chamado."
        )


class FakeAvailableVisualClassifier:
    def classify(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> VisualClassificationResult:
        assert (
            image_bytes
            == b"imagem-de-teste"
        )

        assert (
            content_type
            == "image/png"
        )

        return VisualClassificationResult(
            result_status="AVAILABLE",

            predicted_label="FIRE_SMOKE",

            confidence=0.93,

            candidate_cobrade_codes=(
                "1.4.1.3.1",
                "1.4.1.3.2",
                "2.3.1.1.0",
                "2.3.1.2.0",
            ),

            explanation_simple=(
                "O modelo visual identificou "
                "padrões compatíveis com "
                "fogo ou fumaça."
            ),

            model_name=(
                "fake-visual-model"
            ),

            model_version=(
                "test-1.0.0"
            ),

            synthetic_data=True,
        )


def available_text_result(
    label: TextLabel,
    *,
    confidence: float = 0.91,
) -> TextClassificationResult:
    return TextClassificationResult(
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


def test_text_is_used_when_visual_model_is_unavailable() -> None:
    text_classifier = (
        FakeTextClassifier(
            available_text_result(
                "COBRADE_1_2_3_0_0"
            )
        )
    )

    text = (
        "Alagamento causado "
        "pela chuva."
    )

    result = classify_occurrence(
        occurrence_id="occurrence-test",

        text=text,

        image_bytes=b"imagem-de-teste",

        image_content_type="image/png",

        text_model=text_classifier,
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.predictedCobradeCode
        == "1.2.3.0.0"
    )

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.signals["textUsed"]
        is True
    )

    assert (
        result.signals[
            "imageReceived"
        ]
        is True
    )

    assert (
        result.signals["imageUsed"]
        is False
    )

    assert (
        result.signals[
            "visualResultStatus"
        ]
        == "UNAVAILABLE"
    )

    assert (
        text_classifier.last_text
        == text
    )


def test_available_visual_model_returns_visual_evidence() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "occurrence-visual"
        ),

        text=(
            "Existe alguma coisa "
            "acontecendo no local."
        ),

        image_bytes=b"imagem-de-teste",

        image_content_type="image/png",

        visual_model=(
            FakeAvailableVisualClassifier()
        ),

        text_model=(
            ExplodingTextClassifier()
        ),
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    # Visão sozinha não força
    # COBRADE exata.
    assert (
        result.predictedCobradeCode
        is None
    )

    assert result.confidence == 0.93

    assert (
        result.model.modelType
        == "VISUAL"
    )

    assert (
        result.model.name
        == "fake-visual-model"
    )

    assert (
        result.model.version
        == "test-1.0.0"
    )

    assert result.signals == {
        "occurrenceId": (
            "occurrence-visual"
        ),

        "textUsed": False,

        "imageReceived": True,

        "imageUsed": True,

        "visualLabel": (
            "FIRE_SMOKE"
        ),

        "candidateCobradeCodes": [
            "1.4.1.3.1",
            "1.4.1.3.2",
            "2.3.1.1.0",
            "2.3.1.2.0",
        ],
    }


@pytest.mark.parametrize(
    (
        "label",
        "expected_cobrade_code",
    ),
    [
        (
            "COBRADE_1_2_1_0_0",
            "1.2.1.0.0",
        ),
        (
            "COBRADE_1_2_2_0_0",
            "1.2.2.0.0",
        ),
        (
            "COBRADE_1_2_3_0_0",
            "1.2.3.0.0",
        ),
        (
            "COBRADE_1_4_1_3_1",
            "1.4.1.3.1",
        ),
        (
            "COBRADE_1_4_1_3_2",
            "1.4.1.3.2",
        ),
        (
            "COBRADE_2_3_1_1_0",
            "2.3.1.1.0",
        ),
        (
            "COBRADE_2_3_1_2_0",
            "2.3.1.2.0",
        ),
        (
            "OTHER",
            None,
        ),
        (
            "INSUFFICIENT_INFO",
            None,
        ),
    ],
)
def test_text_label_is_mapped_to_expected_cobrade(
    label: TextLabel,
    expected_cobrade_code: str | None,
) -> None:
    text_classifier = (
        FakeTextClassifier(
            available_text_result(
                label
            )
        )
    )

    result = classify_occurrence(
        occurrence_id=(
            "mapping-test"
        ),

        text=(
            "Relato utilizado "
            "para testar mapeamento."
        ),

        text_model=text_classifier,
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.predictedCobradeCode
        == expected_cobrade_code
    )

    assert (
        result.confidence
        == 0.91
    )

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.model.name
        == "fake-bertimbau"
    )

    assert (
        result.model.version
        == "test-v2"
    )

    assert (
        result.signals[
            "textLabel"
        ]
        == label
    )

    assert (
        result.signals[
            "textProbabilities"
        ]
        == {
            label: 0.91,
        }
    )


def test_unavailable_text_model_returns_unavailable() -> None:
    text_classifier = (
        FakeTextClassifier(
            TextClassificationResult(
                result_status=(
                    "UNAVAILABLE"
                ),

                predicted_label=None,

                confidence=None,

                probabilities={},

                explanation_simple=(
                    "Modelo textual "
                    "indisponível."
                ),

                model_name=(
                    "text-model-unavailable"
                ),

                model_version="0.0.0",

                synthetic_data=True,
            )
        )
    )

    result = classify_occurrence(
        occurrence_id=(
            "text-unavailable"
        ),

        text=(
            "Existe um relato textual."
        ),

        text_model=text_classifier,
    )

    assert (
        result.resultStatus
        == "UNAVAILABLE"
    )

    assert (
        result.predictedCobradeCode
        is None
    )

    assert result.confidence is None

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.signals[
            "textLabel"
        ]
        is None
    )


def test_text_inference_error_returns_error() -> None:
    text_classifier = (
        FakeTextClassifier(
            TextClassificationResult(
                result_status="ERROR",

                predicted_label=None,

                confidence=None,

                probabilities={},

                explanation_simple=(
                    "Erro na inferência "
                    "textual."
                ),

                model_name=(
                    "fake-bertimbau"
                ),

                model_version="test-v2",

                synthetic_data=True,
            )
        )
    )

    result = classify_occurrence(
        occurrence_id=(
            "text-error"
        ),

        text=(
            "Existe um relato textual."
        ),

        text_model=text_classifier,
    )

    assert (
        result.resultStatus
        == "ERROR"
    )

    assert (
        result.predictedCobradeCode
        is None
    )

    assert result.confidence is None

    assert (
        result.model.modelType
        == "TEXTUAL"
    )