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
    MULTIMODAL_MODEL_NAME,
    MULTIMODAL_MODEL_VERSION,
    classify_occurrence,
)


FLOOD_CODES = (
    "1.2.1.0.0",
    "1.2.2.0.0",
    "1.2.3.0.0",
)

FIRE_CODES = (
    "1.4.1.3.1",
    "1.4.1.3.2",
    "2.3.1.1.0",
    "2.3.1.2.0",
)


class FakeTextClassifier:
    def __init__(
        self,
        result: TextClassificationResult,
    ) -> None:
        self._result = result

        self.calls = 0

        self.last_text: str | None = None

    def classify(
        self,
        *,
        text: str,
    ) -> TextClassificationResult:
        self.calls += 1

        self.last_text = text

        return self._result


class FakeVisualClassifier:
    def __init__(
        self,
        result: VisualClassificationResult,
    ) -> None:
        self._result = result

        self.calls = 0

        self.last_image_bytes: (
            bytes
            | None
        ) = None

        self.last_content_type: (
            str
            | None
        ) = None

    def classify(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> VisualClassificationResult:
        self.calls += 1

        self.last_image_bytes = (
            image_bytes
        )

        self.last_content_type = (
            content_type
        )

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


class ExplodingVisualClassifier:
    def classify(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> VisualClassificationResult:
        raise AssertionError(
            "O classificador visual "
            "não deveria ter sido chamado."
        )


def make_visual_result(
    label: str | None,
    *,
    status: str = "AVAILABLE",
    confidence: float | None = 0.93,
) -> VisualClassificationResult:
    if label == "FLOOD_WATER":
        candidates = FLOOD_CODES

    elif label == "FIRE_SMOKE":
        candidates = FIRE_CODES

    else:
        candidates = ()

    return VisualClassificationResult(
        result_status=status,

        predicted_label=label,

        confidence=confidence,

        candidate_cobrade_codes=(
            candidates
        ),

        explanation_simple=(
            "Resultado visual "
            "simulado para teste."
        ),

        model_name=(
            "fake-visual-model"
        ),

        model_version="test-v1",

        synthetic_data=False,
    )


def make_text_result(
    label: TextLabel | None,
    *,
    status: str = "AVAILABLE",
    confidence: float | None = 0.87,
) -> TextClassificationResult:
    probabilities = (
        {
            label: confidence,
        }
        if (
            label is not None
            and confidence is not None
        )
        else {}
    )

    return TextClassificationResult(
        result_status=status,

        predicted_label=label,

        confidence=confidence,

        probabilities=probabilities,

        explanation_simple=(
            "Resultado textual "
            "simulado para teste."
        ),

        model_name=(
            "fake-bertimbau"
        ),

        model_version="test-v2",

        synthetic_data=True,
    )


def test_text_is_used_when_visual_model_is_unavailable() -> None:
    visual_classifier = (
        FakeVisualClassifier(
            make_visual_result(
                None,
                status="UNAVAILABLE",
                confidence=None,
            )
        )
    )

    text_classifier = (
        FakeTextClassifier(
            make_text_result(
                "COBRADE_1_2_3_0_0",
                confidence=0.87,
            )
        )
    )

    text = (
        "Depois da chuva os bueiros "
        "não deram vazão."
    )

    result = classify_occurrence(
        occurrence_id=(
            "text-fallback"
        ),

        text=text,

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            visual_classifier
        ),

        text_model=(
            text_classifier
        ),
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.predictedCobradeCode
        == "1.2.3.0.0"
    )

    assert result.confidence == 0.87

    assert (
        result.visualConfidence
        is None
    )

    assert (
        result.textConfidence
        == 0.87
    )

    assert (
        result.ambiguous
        is False
    )

    assert (
        visual_classifier.calls
        == 1
    )

    assert (
        text_classifier.calls
        == 1
    )

    assert (
        text_classifier.last_text
        == text
    )

    assert (
        result.signals[
            "visualResultStatus"
        ]
        == "UNAVAILABLE"
    )


def test_visual_is_used_when_text_model_is_unavailable() -> None:
    visual_classifier = (
        FakeVisualClassifier(
            make_visual_result(
                "FIRE_SMOKE",
                confidence=0.94,
            )
        )
    )

    text_classifier = (
        FakeTextClassifier(
            make_text_result(
                None,
                status="UNAVAILABLE",
                confidence=None,
            )
        )
    )

    result = classify_occurrence(
        occurrence_id=(
            "visual-fallback"
        ),

        text=(
            "Existe um relato textual."
        ),

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            visual_classifier
        ),

        text_model=(
            text_classifier
        ),
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.model.modelType
        == "VISUAL"
    )

    assert (
        result.predictedCobradeCode
        is None
    )

    assert result.confidence == 0.94

    assert (
        result.visualConfidence
        == 0.94
    )

    assert (
        result.textConfidence
        is None
    )

    assert (
        result.ambiguous
        is False
    )

    assert (
        result.signals[
            "textResultStatus"
        ]
        == "UNAVAILABLE"
    )


def test_compatible_visual_and_text_results_are_fused() -> None:
    visual_classifier = (
        FakeVisualClassifier(
            make_visual_result(
                "FIRE_SMOKE",
                confidence=0.95,
            )
        )
    )

    text_classifier = (
        FakeTextClassifier(
            make_text_result(
                "COBRADE_1_4_1_3_1",
                confidence=0.82,
            )
        )
    )

    result = classify_occurrence(
        occurrence_id=(
            "multimodal-agreement"
        ),

        text=(
            "Há vegetação queimando "
            "no local."
        ),

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            visual_classifier
        ),

        text_model=(
            text_classifier
        ),
    )

    assert (
        visual_classifier.calls
        == 1
    )

    assert (
        text_classifier.calls
        == 1
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.model.modelType
        == "MULTIMODAL"
    )

    assert (
        result.model.name
        == MULTIMODAL_MODEL_NAME
    )

    assert (
        result.model.version
        == MULTIMODAL_MODEL_VERSION
    )

    assert (
        result.model.syntheticData
        is True
    )

    assert (
        result.predictedCobradeCode
        == "1.4.1.3.1"
    )

    assert result.confidence is None

    assert (
        result.visualConfidence
        == 0.95
    )

    assert (
        result.textConfidence
        == 0.82
    )

    assert (
        result.ambiguous
        is False
    )

    assert (
        result.ambiguityReason
        is None
    )

    assert (
        result.signals[
            "fusionCompatibility"
        ]
        == "AGREEMENT"
    )

    assert (
        result.signals["textUsed"]
        is True
    )

    assert (
        result.signals["imageUsed"]
        is True
    )

    assert (
        result.signals[
            "visualLabel"
        ]
        == "FIRE_SMOKE"
    )

    assert (
        result.signals[
            "textLabel"
        ]
        == "COBRADE_1_4_1_3_1"
    )

    assert result.signals[
        "visualModel"
    ] == {
        "name": "fake-visual-model",
        "version": "test-v1",
        "syntheticData": False,
    }

    assert result.signals[
        "textModel"
    ] == {
        "name": "fake-bertimbau",
        "version": "test-v2",
        "syntheticData": True,
    }


def test_conflicting_visual_and_text_results_are_ambiguous() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "multimodal-conflict"
        ),

        text=(
            "A avenida está alagada."
        ),

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            FakeVisualClassifier(
                make_visual_result(
                    "FIRE_SMOKE",
                    confidence=0.96,
                )
            )
        ),

        text_model=(
            FakeTextClassifier(
                make_text_result(
                    "COBRADE_1_2_3_0_0",
                    confidence=0.91,
                )
            )
        ),
    )

    assert (
        result.model.modelType
        == "MULTIMODAL"
    )

    assert (
        result.predictedCobradeCode
        is None
    )

    assert result.confidence is None

    assert (
        result.visualConfidence
        == 0.96
    )

    assert (
        result.textConfidence
        == 0.91
    )

    assert (
        result.ambiguous
        is True
    )

    assert (
        result.ambiguityReason
        is not None
    )

    assert (
        result.signals[
            "fusionCompatibility"
        ]
        == "CONFLICT"
    )


def test_insufficient_text_with_specific_visual_family_is_partial() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "multimodal-partial"
        ),

        text=(
            "Tem alguma coisa "
            "acontecendo aqui."
        ),

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            FakeVisualClassifier(
                make_visual_result(
                    "FLOOD_WATER",
                    confidence=0.92,
                )
            )
        ),

        text_model=(
            FakeTextClassifier(
                make_text_result(
                    "INSUFFICIENT_INFO",
                    confidence=0.76,
                )
            )
        ),
    )

    assert (
        result.model.modelType
        == "MULTIMODAL"
    )

    assert (
        result.predictedCobradeCode
        is None
    )

    assert (
        result.ambiguous
        is True
    )

    assert (
        result.ambiguityReason
        is not None
    )

    assert (
        result.signals[
            "fusionCompatibility"
        ]
        == "PARTIAL"
    )

    assert (
        result.signals[
            "candidateCobradeCodes"
        ]
        == list(
            FLOOD_CODES
        )
    )


def test_uncertain_visual_preserves_specific_text_in_multimodal_response() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "uncertain-visual"
        ),

        text=(
            "Os bueiros não deram "
            "vazão e a rua alagou."
        ),

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            FakeVisualClassifier(
                make_visual_result(
                    "UNCERTAIN",
                    confidence=0.48,
                )
            )
        ),

        text_model=(
            FakeTextClassifier(
                make_text_result(
                    "COBRADE_1_2_3_0_0",
                    confidence=0.89,
                )
            )
        ),
    )

    assert (
        result.model.modelType
        == "MULTIMODAL"
    )

    assert (
        result.predictedCobradeCode
        == "1.2.3.0.0"
    )

    assert (
        result.ambiguous
        is False
    )

    assert (
        result.signals[
            "fusionCompatibility"
        ]
        == "PARTIAL"
    )


def test_visual_available_without_text_remains_visual() -> None:
    visual_classifier = (
        FakeVisualClassifier(
            make_visual_result(
                "FIRE_SMOKE",
                confidence=0.93,
            )
        )
    )

    result = classify_occurrence(
        occurrence_id=(
            "visual-only"
        ),

        text=None,

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            visual_classifier
        ),

        text_model=(
            ExplodingTextClassifier()
        ),
    )

    assert (
        result.model.modelType
        == "VISUAL"
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert result.confidence == 0.93

    assert (
        result.visualConfidence
        == 0.93
    )

    assert (
        result.textConfidence
        is None
    )

    assert (
        result.signals["textUsed"]
        is False
    )

    assert (
        result.signals["imageUsed"]
        is True
    )


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
def test_text_only_label_is_mapped_to_expected_cobrade(
    label: TextLabel,
    expected_cobrade_code: str | None,
) -> None:
    text_classifier = (
        FakeTextClassifier(
            make_text_result(
                label,
                confidence=0.91,
            )
        )
    )

    result = classify_occurrence(
        occurrence_id=(
            "text-mapping"
        ),

        text=(
            "Relato usado para "
            "testar mapeamento."
        ),

        visual_model=(
            ExplodingVisualClassifier()
        ),

        text_model=(
            text_classifier
        ),
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.predictedCobradeCode
        == expected_cobrade_code
    )

    assert result.confidence == 0.91

    assert (
        result.visualConfidence
        is None
    )

    assert (
        result.textConfidence
        == 0.91
    )

    assert (
        result.ambiguous
        is False
    )

    assert (
        result.signals[
            "textLabel"
        ]
        == label
    )


def test_text_only_unavailable_result_is_preserved() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "text-unavailable"
        ),

        text=(
            "Existe um relato textual."
        ),

        text_model=(
            FakeTextClassifier(
                make_text_result(
                    None,
                    status="UNAVAILABLE",
                    confidence=None,
                )
            )
        ),
    )

    assert (
        result.resultStatus
        == "UNAVAILABLE"
    )

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.predictedCobradeCode
        is None
    )

    assert result.confidence is None

    assert (
        result.textConfidence
        is None
    )


def test_text_only_error_result_is_preserved() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "text-error"
        ),

        text=(
            "Existe um relato textual."
        ),

        text_model=(
            FakeTextClassifier(
                make_text_result(
                    None,
                    status="ERROR",
                    confidence=None,
                )
            )
        ),
    )

    assert (
        result.resultStatus
        == "ERROR"
    )

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.predictedCobradeCode
        is None
    )


def test_visual_error_does_not_block_available_text() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "visual-error-text-ok"
        ),

        text=(
            "O rio transbordou "
            "lentamente."
        ),

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            FakeVisualClassifier(
                make_visual_result(
                    None,
                    status="ERROR",
                    confidence=None,
                )
            )
        ),

        text_model=(
            FakeTextClassifier(
                make_text_result(
                    "COBRADE_1_2_1_0_0",
                    confidence=0.90,
                )
            )
        ),
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.model.modelType
        == "TEXTUAL"
    )

    assert (
        result.predictedCobradeCode
        == "1.2.1.0.0"
    )

    assert (
        result.signals[
            "visualResultStatus"
        ]
        == "ERROR"
    )


def test_text_error_does_not_block_available_visual() -> None:
    result = classify_occurrence(
        occurrence_id=(
            "text-error-visual-ok"
        ),

        text=(
            "Existe um relato textual."
        ),

        image_bytes=(
            b"imagem-de-teste"
        ),

        image_content_type=(
            "image/png"
        ),

        visual_model=(
            FakeVisualClassifier(
                make_visual_result(
                    "FIRE_SMOKE",
                    confidence=0.94,
                )
            )
        ),

        text_model=(
            FakeTextClassifier(
                make_text_result(
                    None,
                    status="ERROR",
                    confidence=None,
                )
            )
        ),
    )

    assert (
        result.resultStatus
        == "AVAILABLE"
    )

    assert (
        result.model.modelType
        == "VISUAL"
    )

    assert result.confidence == 0.94

    assert (
        result.visualConfidence
        == 0.94
    )

    assert (
        result.signals[
            "textResultStatus"
        ]
        == "ERROR"
    )