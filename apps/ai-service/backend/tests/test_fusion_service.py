from __future__ import annotations

import pytest

from app.models.text_classifier import (
    TextClassificationResult,
    TextLabel,
)

from app.models.visual_classifier import (
    VisualClassificationResult,
)

from app.services.fusion_service import (
    FIRE_COBRADE_CODES,
    FLOOD_COBRADE_CODES,
    fuse_available_results,
)


def make_visual_result(
    label: str,
    *,
    confidence: float = 0.90,
) -> VisualClassificationResult:
    candidate_codes: tuple[
        str,
        ...,
    ]

    if label == "FLOOD_WATER":
        candidate_codes = (
            FLOOD_COBRADE_CODES
        )
    elif label == "FIRE_SMOKE":
        candidate_codes = (
            FIRE_COBRADE_CODES
        )
    else:
        candidate_codes = ()

    return VisualClassificationResult(
        result_status="AVAILABLE",

        predicted_label=label,

        confidence=confidence,

        candidate_cobrade_codes=(
            candidate_codes
        ),

        explanation_simple=(
            "Resultado visual simulado."
        ),

        model_name=(
            "fake-visual-model"
        ),

        model_version="test-v1",

        synthetic_data=False,
    )


def make_text_result(
    label: TextLabel,
    *,
    confidence: float = 0.80,
) -> TextClassificationResult:
    return TextClassificationResult(
        result_status="AVAILABLE",

        predicted_label=label,

        confidence=confidence,

        probabilities={
            label: confidence,
        },

        explanation_simple=(
            "Resultado textual simulado."
        ),

        model_name=(
            "fake-text-model"
        ),

        model_version="test-v2",

        synthetic_data=True,
    )


@pytest.mark.parametrize(
    (
        "text_label",
        "expected_code",
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
    ],
)
def test_flood_family_agrees_with_flood_cobrade(
    text_label: TextLabel,
    expected_code: str,
) -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            "FLOOD_WATER",
            confidence=0.94,
        ),

        text_result=make_text_result(
            text_label,
            confidence=0.87,
        ),
    )

    assert (
        decision.compatibility
        == "AGREEMENT"
    )

    assert (
        decision.predicted_cobrade_code
        == expected_code
    )

    assert decision.ambiguous is False

    assert (
        decision.ambiguity_reason
        is None
    )

    assert (
        decision.visual_confidence
        == 0.94
    )

    assert (
        decision.text_confidence
        == 0.87
    )

    assert (
        decision.candidate_cobrade_codes
        == FLOOD_COBRADE_CODES
    )


@pytest.mark.parametrize(
    (
        "text_label",
        "expected_code",
    ),
    [
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
    ],
)
def test_fire_family_agrees_with_fire_cobrade(
    text_label: TextLabel,
    expected_code: str,
) -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            "FIRE_SMOKE"
        ),

        text_result=make_text_result(
            text_label
        ),
    )

    assert (
        decision.compatibility
        == "AGREEMENT"
    )

    assert (
        decision.predicted_cobrade_code
        == expected_code
    )

    assert decision.ambiguous is False

    assert (
        decision.ambiguity_reason
        is None
    )

    assert (
        decision.candidate_cobrade_codes
        == FIRE_COBRADE_CODES
    )


@pytest.mark.parametrize(
    (
        "visual_label",
        "text_label",
    ),
    [
        (
            "FIRE_SMOKE",
            "COBRADE_1_2_3_0_0",
        ),
        (
            "FLOOD_WATER",
            "COBRADE_1_4_1_3_1",
        ),
    ],
)
def test_different_disaster_families_conflict(
    visual_label: str,
    text_label: TextLabel,
) -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            visual_label
        ),

        text_result=make_text_result(
            text_label
        ),
    )

    assert (
        decision.compatibility
        == "CONFLICT"
    )

    assert (
        decision.predicted_cobrade_code
        is None
    )

    assert decision.ambiguous is True

    assert (
        decision.ambiguity_reason
        is not None
    )


def test_visual_other_and_text_other_agree() -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            "OTHER"
        ),

        text_result=make_text_result(
            "OTHER"
        ),
    )

    assert (
        decision.compatibility
        == "AGREEMENT"
    )

    assert (
        decision.predicted_cobrade_code
        is None
    )

    assert decision.ambiguous is False

    assert (
        decision.ambiguity_reason
        is None
    )

    assert (
        decision.candidate_cobrade_codes
        == ()
    )


@pytest.mark.parametrize(
    (
        "visual_label",
        "text_label",
    ),
    [
        (
            "FLOOD_WATER",
            "OTHER",
        ),
        (
            "FIRE_SMOKE",
            "OTHER",
        ),
        (
            "OTHER",
            "COBRADE_1_2_3_0_0",
        ),
        (
            "OTHER",
            "COBRADE_1_4_1_3_1",
        ),
    ],
)
def test_specific_family_and_other_conflict(
    visual_label: str,
    text_label: TextLabel,
) -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            visual_label
        ),

        text_result=make_text_result(
            text_label
        ),
    )

    assert (
        decision.compatibility
        == "CONFLICT"
    )

    assert (
        decision.predicted_cobrade_code
        is None
    )

    assert decision.ambiguous is True


@pytest.mark.parametrize(
    (
        "visual_label",
        "expected_candidates",
    ),
    [
        (
            "FLOOD_WATER",
            FLOOD_COBRADE_CODES,
        ),
        (
            "FIRE_SMOKE",
            FIRE_COBRADE_CODES,
        ),
    ],
)
def test_specific_visual_family_and_insufficient_text_are_partial(
    visual_label: str,
    expected_candidates: tuple[
        str,
        ...,
    ],
) -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            visual_label
        ),

        text_result=make_text_result(
            "INSUFFICIENT_INFO"
        ),
    )

    assert (
        decision.compatibility
        == "PARTIAL"
    )

    assert (
        decision.predicted_cobrade_code
        is None
    )

    assert decision.ambiguous is True

    assert (
        decision.ambiguity_reason
        is not None
    )

    assert (
        decision.candidate_cobrade_codes
        == expected_candidates
    )


def test_uncertain_visual_preserves_specific_text_prediction() -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            "UNCERTAIN",
            confidence=0.48,
        ),

        text_result=make_text_result(
            "COBRADE_1_2_3_0_0",
            confidence=0.89,
        ),
    )

    assert (
        decision.compatibility
        == "PARTIAL"
    )

    assert (
        decision.predicted_cobrade_code
        == "1.2.3.0.0"
    )

    assert decision.ambiguous is False

    assert (
        decision.ambiguity_reason
        is None
    )

    assert (
        decision.visual_confidence
        == 0.48
    )

    assert (
        decision.text_confidence
        == 0.89
    )

    assert (
        decision.candidate_cobrade_codes
        == ()
    )


def test_uncertain_visual_preserves_other_text_prediction() -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            "UNCERTAIN"
        ),

        text_result=make_text_result(
            "OTHER"
        ),
    )

    assert (
        decision.compatibility
        == "PARTIAL"
    )

    assert (
        decision.predicted_cobrade_code
        is None
    )

    assert decision.ambiguous is False

    assert (
        decision.ambiguity_reason
        is None
    )


def test_uncertain_visual_and_insufficient_text_are_ambiguous() -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            "UNCERTAIN"
        ),

        text_result=make_text_result(
            "INSUFFICIENT_INFO"
        ),
    )

    assert (
        decision.compatibility
        == "PARTIAL"
    )

    assert (
        decision.predicted_cobrade_code
        is None
    )

    assert decision.ambiguous is True

    assert (
        decision.ambiguity_reason
        is not None
    )


def test_visual_other_and_insufficient_text_are_ambiguous() -> None:
    decision = fuse_available_results(
        visual_result=make_visual_result(
            "OTHER"
        ),

        text_result=make_text_result(
            "INSUFFICIENT_INFO"
        ),
    )

    assert (
        decision.compatibility
        == "PARTIAL"
    )

    assert (
        decision.predicted_cobrade_code
        is None
    )

    assert decision.ambiguous is True

    assert (
        decision.ambiguity_reason
        is not None
    )


def test_fusion_rejects_unavailable_visual_result() -> None:
    visual_result = (
        VisualClassificationResult(
            result_status=(
                "UNAVAILABLE"
            ),

            predicted_label=None,

            confidence=None,

            candidate_cobrade_codes=(),

            explanation_simple=(
                "Visual indisponível."
            ),

            model_name=(
                "fake-visual-model"
            ),

            model_version="test-v1",

            synthetic_data=False,
        )
    )

    with pytest.raises(
        ValueError,
        match="visual AVAILABLE",
    ):
        fuse_available_results(
            visual_result=visual_result,

            text_result=make_text_result(
                "COBRADE_1_2_3_0_0"
            ),
        )


def test_fusion_rejects_unavailable_text_result() -> None:
    text_result = (
        TextClassificationResult(
            result_status=(
                "UNAVAILABLE"
            ),

            predicted_label=None,

            confidence=None,

            probabilities={},

            explanation_simple=(
                "Textual indisponível."
            ),

            model_name=(
                "fake-text-model"
            ),

            model_version="test-v2",

            synthetic_data=True,
        )
    )

    with pytest.raises(
        ValueError,
        match="textual AVAILABLE",
    ):
        fuse_available_results(
            visual_result=make_visual_result(
                "FLOOD_WATER"
            ),

            text_result=text_result,
        )