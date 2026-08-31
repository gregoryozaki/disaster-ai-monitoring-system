from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.models.text_classifier import (
    TextClassificationResult,
    TextLabel,
)

from app.models.visual_classifier import (
    VisualClassificationResult,
)


FusionCompatibility = Literal[
    "AGREEMENT",
    "CONFLICT",
    "PARTIAL",
]


FLOOD_COBRADE_CODES: tuple[str, ...] = (
    "1.2.1.0.0",
    "1.2.2.0.0",
    "1.2.3.0.0",
)


FIRE_COBRADE_CODES: tuple[str, ...] = (
    "1.4.1.3.1",
    "1.4.1.3.2",
    "2.3.1.1.0",
    "2.3.1.2.0",
)


TEXT_LABEL_TO_COBRADE_CODE: dict[
    TextLabel,
    str | None,
] = {
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


VISUAL_FAMILY_COBRADE_CODES: dict[
    str,
    tuple[str, ...],
] = {
    "FLOOD_WATER": FLOOD_COBRADE_CODES,
    "FIRE_SMOKE": FIRE_COBRADE_CODES,
    "OTHER": (),
    "UNCERTAIN": (),
}


@dataclass(frozen=True)
class FusionDecision:
    compatibility: FusionCompatibility

    predicted_cobrade_code: str | None

    ambiguous: bool

    ambiguity_reason: str | None

    explanation_simple: str

    visual_confidence: float | None

    text_confidence: float | None

    visual_label: str

    text_label: TextLabel

    candidate_cobrade_codes: tuple[str, ...]


def text_label_to_cobrade_code(
    label: TextLabel,
) -> str | None:
    return TEXT_LABEL_TO_COBRADE_CODE[
        label
    ]


def visual_candidate_cobrade_codes(
    visual_label: str,
) -> tuple[str, ...]:
    try:
        return VISUAL_FAMILY_COBRADE_CODES[
            visual_label
        ]
    except KeyError as error:
        raise ValueError(
            "Classe visual não suportada "
            f"pela fusão: {visual_label!r}."
        ) from error


def _validate_available_results(
    *,
    visual_result: VisualClassificationResult,
    text_result: TextClassificationResult,
) -> tuple[
    str,
    TextLabel,
]:
    if (
        visual_result.result_status
        != "AVAILABLE"
    ):
        raise ValueError(
            "A fusão semântica exige um "
            "resultado visual AVAILABLE."
        )

    if (
        text_result.result_status
        != "AVAILABLE"
    ):
        raise ValueError(
            "A fusão semântica exige um "
            "resultado textual AVAILABLE."
        )

    if (
        visual_result.predicted_label
        is None
    ):
        raise ValueError(
            "Resultado visual AVAILABLE "
            "sem classe prevista."
        )

    if (
        text_result.predicted_label
        is None
    ):
        raise ValueError(
            "Resultado textual AVAILABLE "
            "sem classe prevista."
        )

    visual_label = (
        visual_result.predicted_label
    )

    text_label = (
        text_result.predicted_label
    )

    visual_candidate_cobrade_codes(
        visual_label
    )

    return (
        visual_label,
        text_label,
    )


def _agreement_decision(
    *,
    visual_result: VisualClassificationResult,
    text_result: TextClassificationResult,
    visual_label: str,
    text_label: TextLabel,
    predicted_cobrade_code: str | None,
    candidate_cobrade_codes: tuple[
        str,
        ...,
    ],
) -> FusionDecision:
    if text_label == "OTHER":
        explanation = (
            "As evidências visual e textual "
            "são semanticamente compatíveis "
            "e indicam um evento fora das "
            "categorias COBRADE contempladas "
            "pelos classificadores atuais. "
            "A decisão final permanece humana."
        )
    else:
        explanation = (
            "As evidências visual e textual "
            "são semanticamente compatíveis. "
            "O texto fornece uma categoria "
            "COBRADE específica dentro da "
            "família de evento identificada "
            "pela imagem. A decisão final "
            "permanece humana."
        )

    return FusionDecision(
        compatibility="AGREEMENT",

        predicted_cobrade_code=(
            predicted_cobrade_code
        ),

        ambiguous=False,

        ambiguity_reason=None,

        explanation_simple=explanation,

        visual_confidence=(
            visual_result.confidence
        ),

        text_confidence=(
            text_result.confidence
        ),

        visual_label=visual_label,

        text_label=text_label,

        candidate_cobrade_codes=(
            candidate_cobrade_codes
        ),
    )


def _conflict_decision(
    *,
    visual_result: VisualClassificationResult,
    text_result: TextClassificationResult,
    visual_label: str,
    text_label: TextLabel,
    candidate_cobrade_codes: tuple[
        str,
        ...,
    ],
) -> FusionDecision:
    reason = (
        "As evidências visual e textual "
        "apontam para famílias de evento "
        "semanticamente incompatíveis."
    )

    return FusionDecision(
        compatibility="CONFLICT",

        predicted_cobrade_code=None,

        ambiguous=True,

        ambiguity_reason=reason,

        explanation_simple=(
            f"{reason} Nenhuma categoria "
            "COBRADE específica foi escolhida "
            "automaticamente. A decisão final "
            "permanece humana."
        ),

        visual_confidence=(
            visual_result.confidence
        ),

        text_confidence=(
            text_result.confidence
        ),

        visual_label=visual_label,

        text_label=text_label,

        candidate_cobrade_codes=(
            candidate_cobrade_codes
        ),
    )


def _partial_from_insufficient_text(
    *,
    visual_result: VisualClassificationResult,
    text_result: TextClassificationResult,
    visual_label: str,
    text_label: TextLabel,
    candidate_cobrade_codes: tuple[
        str,
        ...,
    ],
) -> FusionDecision:
    if visual_label == "UNCERTAIN":
        reason = (
            "A imagem foi inconclusiva e o "
            "texto não contém informação "
            "suficiente para selecionar uma "
            "categoria COBRADE específica."
        )
    elif visual_label == "OTHER":
        reason = (
            "A imagem indica um evento fora "
            "das famílias-alvo, enquanto o "
            "texto não contém informação "
            "suficiente para confirmar uma "
            "classificação específica."
        )
    else:
        reason = (
            "A imagem fornece evidência de "
            "uma família de desastre, mas o "
            "texto não contém informação "
            "suficiente para selecionar uma "
            "categoria COBRADE específica."
        )

    return FusionDecision(
        compatibility="PARTIAL",

        predicted_cobrade_code=None,

        ambiguous=True,

        ambiguity_reason=reason,

        explanation_simple=(
            f"{reason} A decisão final "
            "permanece humana."
        ),

        visual_confidence=(
            visual_result.confidence
        ),

        text_confidence=(
            text_result.confidence
        ),

        visual_label=visual_label,

        text_label=text_label,

        candidate_cobrade_codes=(
            candidate_cobrade_codes
        ),
    )


def _partial_from_uncertain_visual(
    *,
    visual_result: VisualClassificationResult,
    text_result: TextClassificationResult,
    visual_label: str,
    text_label: TextLabel,
    predicted_cobrade_code: str | None,
) -> FusionDecision:
    if text_label == "OTHER":
        explanation = (
            "A imagem foi inconclusiva e não "
            "contradiz a classificação textual "
            "de evento fora das categorias "
            "COBRADE contempladas pelos "
            "classificadores atuais. A decisão "
            "final permanece humana."
        )
    else:
        explanation = (
            "A imagem foi inconclusiva e não "
            "contradiz a classificação textual. "
            "A sugestão de categoria COBRADE "
            "é baseada principalmente na "
            "evidência textual. A decisão final "
            "permanece humana."
        )

    return FusionDecision(
        compatibility="PARTIAL",

        predicted_cobrade_code=(
            predicted_cobrade_code
        ),

        # A modalidade visual é inconclusiva,
        # mas não existe conflito semântico.
        # Se o texto fornece uma classificação
        # utilizável, não marcamos conflito como
        # ambiguidade.
        ambiguous=False,

        ambiguity_reason=None,

        explanation_simple=explanation,

        visual_confidence=(
            visual_result.confidence
        ),

        text_confidence=(
            text_result.confidence
        ),

        visual_label=visual_label,

        text_label=text_label,

        candidate_cobrade_codes=(),
    )


def fuse_available_results(
    *,
    visual_result: VisualClassificationResult,
    text_result: TextClassificationResult,
) -> FusionDecision:
    """
    Realiza late fusion semântica entre dois
    resultados AVAILABLE.

    Esta função não combina numericamente os
    scores das modalidades.

    A imagem fornece evidência de uma família
    ampla de evento, enquanto o texto pode
    fornecer uma COBRADE específica.

    Disponibilidade e fallback entre modelos
    pertencem à camada de orquestração, e não
    a esta função.
    """

    (
        visual_label,
        text_label,
    ) = _validate_available_results(
        visual_result=visual_result,
        text_result=text_result,
    )

    predicted_cobrade_code = (
        text_label_to_cobrade_code(
            text_label
        )
    )

    candidate_cobrade_codes = (
        visual_candidate_cobrade_codes(
            visual_label
        )
    )

    # A classe textual INSUFFICIENT_INFO não
    # significa falha de inferência. O modelo
    # respondeu, mas não encontrou evidência
    # suficiente para uma classe específica.
    if (
        text_label
        == "INSUFFICIENT_INFO"
    ):
        return (
            _partial_from_insufficient_text(
                visual_result=visual_result,
                text_result=text_result,
                visual_label=visual_label,
                text_label=text_label,
                candidate_cobrade_codes=(
                    candidate_cobrade_codes
                ),
            )
        )

    # UNCERTAIN também é evidência operacional,
    # não uma família incompatível. A imagem
    # simplesmente não confirma nem contradiz
    # a classificação textual.
    if (
        visual_label
        == "UNCERTAIN"
    ):
        return (
            _partial_from_uncertain_visual(
                visual_result=visual_result,
                text_result=text_result,
                visual_label=visual_label,
                text_label=text_label,
                predicted_cobrade_code=(
                    predicted_cobrade_code
                ),
            )
        )

    # Os dois classificadores concordam que o
    # evento está fora das famílias-alvo.
    if (
        visual_label == "OTHER"
        and text_label == "OTHER"
    ):
        return _agreement_decision(
            visual_result=visual_result,
            text_result=text_result,
            visual_label=visual_label,
            text_label=text_label,
            predicted_cobrade_code=None,
            candidate_cobrade_codes=(),
        )

    # Um dos classificadores aponta para OTHER
    # enquanto o outro identifica uma família
    # de desastre específica.
    if (
        visual_label == "OTHER"
        or text_label == "OTHER"
    ):
        return _conflict_decision(
            visual_result=visual_result,
            text_result=text_result,
            visual_label=visual_label,
            text_label=text_label,
            candidate_cobrade_codes=(
                candidate_cobrade_codes
            ),
        )

    # Neste ponto o texto possui uma das sete
    # COBRADE-alvo.
    if (
        predicted_cobrade_code
        is None
    ):
        raise ValueError(
            "Classe textual específica sem "
            "mapeamento COBRADE."
        )

    if (
        predicted_cobrade_code
        in candidate_cobrade_codes
    ):
        return _agreement_decision(
            visual_result=visual_result,
            text_result=text_result,
            visual_label=visual_label,
            text_label=text_label,
            predicted_cobrade_code=(
                predicted_cobrade_code
            ),
            candidate_cobrade_codes=(
                candidate_cobrade_codes
            ),
        )

    return _conflict_decision(
        visual_result=visual_result,
        text_result=text_result,
        visual_label=visual_label,
        text_label=text_label,
        candidate_cobrade_codes=(
            candidate_cobrade_codes
        ),
    )