from __future__ import annotations

from app.models.text_classifier import (
    TextClassificationResult,
    TextClassifier,
    get_text_classifier,
)

from app.models.visual_classifier import (
    VisualClassificationResult,
    VisualClassifier,
    visual_classifier,
)

from app.schemas.classification import (
    ClassifyResponse,
    ModelInfo,
)

from app.services.fusion_service import (
    FusionDecision,
    fuse_available_results,
    text_label_to_cobrade_code,
)


MULTIMODAL_MODEL_NAME = (
    "kamara_semantic_late_fusion"
)

MULTIMODAL_MODEL_VERSION = "v1"


def _visual_response(
    *,
    occurrence_id: str | None,
    visual_result: VisualClassificationResult,
    image_used: bool,
    text_result: TextClassificationResult | None = None,
) -> ClassifyResponse:
    signals: dict[str, object] = {
        "occurrenceId": occurrence_id,

        "textUsed": False,

        "imageReceived": True,

        "imageUsed": image_used,

        "visualLabel": (
            visual_result.predicted_label
        ),

        "candidateCobradeCodes": list(
            visual_result.candidate_cobrade_codes
        ),
    }

    if text_result is not None:
        signals.update(
            {
                "textResultStatus": (
                    text_result.result_status
                ),

                "textLabel": (
                    text_result.predicted_label
                ),

                "textProbabilities": (
                    text_result.probabilities
                ),
            }
        )

    return ClassifyResponse(
        resultStatus=(
            visual_result.result_status
        ),

        # O classificador visual trabalha
        # com famílias amplas de evento e
        # não determina sozinho uma COBRADE
        # específica.
        predictedCobradeCode=None,

        confidence=(
            visual_result.confidence
        ),

        visualConfidence=(
            visual_result.confidence
        ),

        textConfidence=(
            text_result.confidence
            if text_result is not None
            else None
        ),

        ambiguous=False,

        ambiguityReason=None,

        explanationSimple=(
            visual_result.explanation_simple
        ),

        model=ModelInfo(
            modelType="VISUAL",

            name=(
                visual_result.model_name
            ),

            version=(
                visual_result.model_version
            ),

            syntheticData=(
                visual_result.synthetic_data
            ),
        ),

        signals=signals,
    )


def _text_response(
    *,
    occurrence_id: str | None,
    image_received: bool,
    visual_result: (
        VisualClassificationResult
        | None
    ),
    text_result: TextClassificationResult,
) -> ClassifyResponse:
    predicted_cobrade_code: (
        str
        | None
    ) = None

    if (
        text_result.predicted_label
        is not None
    ):
        predicted_cobrade_code = (
            text_label_to_cobrade_code(
                text_result.predicted_label
            )
        )

    return ClassifyResponse(
        resultStatus=(
            text_result.result_status
        ),

        predictedCobradeCode=(
            predicted_cobrade_code
        ),

        confidence=(
            text_result.confidence
        ),

        visualConfidence=(
            visual_result.confidence
            if visual_result is not None
            else None
        ),

        textConfidence=(
            text_result.confidence
        ),

        ambiguous=False,

        ambiguityReason=None,

        explanationSimple=(
            text_result.explanation_simple
        ),

        model=ModelInfo(
            modelType="TEXTUAL",

            name=text_result.model_name,

            version=(
                text_result.model_version
            ),

            syntheticData=(
                text_result.synthetic_data
            ),
        ),

        signals={
            "occurrenceId": occurrence_id,

            "textUsed": True,

            "imageReceived": (
                image_received
            ),

            "imageUsed": False,

            "textResultStatus": (
                text_result.result_status
            ),

            "textLabel": (
                text_result.predicted_label
            ),

            "textProbabilities": (
                text_result.probabilities
            ),

            "visualResultStatus": (
                visual_result.result_status
                if visual_result is not None
                else None
            ),

            "visualLabel": (
                visual_result.predicted_label
                if visual_result is not None
                else None
            ),

            "candidateCobradeCodes": (
                list(
                    visual_result
                    .candidate_cobrade_codes
                )
                if visual_result is not None
                else []
            ),
        },
    )


def _multimodal_response(
    *,
    occurrence_id: str | None,
    visual_result: VisualClassificationResult,
    text_result: TextClassificationResult,
    decision: FusionDecision,
) -> ClassifyResponse:
    return ClassifyResponse(
        resultStatus="AVAILABLE",

        predictedCobradeCode=(
            decision.predicted_cobrade_code
        ),

        # Não existe nesta versão um score
        # multimodal calibrado.
        #
        # Os scores das modalidades são
        # preservados separadamente.
        confidence=None,

        visualConfidence=(
            decision.visual_confidence
        ),

        textConfidence=(
            decision.text_confidence
        ),

        ambiguous=(
            decision.ambiguous
        ),

        ambiguityReason=(
            decision.ambiguity_reason
        ),

        explanationSimple=(
            decision.explanation_simple
        ),

        model=ModelInfo(
            modelType="MULTIMODAL",

            name=MULTIMODAL_MODEL_NAME,

            version=(
                MULTIMODAL_MODEL_VERSION
            ),

            # A fusão em si não é treinada,
            # mas preservamos a proveniência:
            # se alguma modalidade utilizada
            # depende de dados sintéticos, a
            # classificação multimodal também
            # é marcada dessa forma.
            syntheticData=(
                visual_result.synthetic_data
                or text_result.synthetic_data
            ),
        ),

        signals={
            "occurrenceId": occurrence_id,

            "textUsed": True,

            "imageReceived": True,

            "imageUsed": True,

            "visualResultStatus": (
                visual_result.result_status
            ),

            "textResultStatus": (
                text_result.result_status
            ),

            "visualLabel": (
                decision.visual_label
            ),

            "textLabel": (
                decision.text_label
            ),

            "fusionCompatibility": (
                decision.compatibility
            ),

            "candidateCobradeCodes": list(
                decision
                .candidate_cobrade_codes
            ),

            "textProbabilities": (
                text_result.probabilities
            ),

            # O modelVersion principal desta
            # resposta representa a política
            # de fusão. As versões dos modelos
            # componentes permanecem nos
            # sinais para rastreabilidade.
            "visualModel": {
                "name": (
                    visual_result.model_name
                ),

                "version": (
                    visual_result.model_version
                ),

                "syntheticData": (
                    visual_result.synthetic_data
                ),
            },

            "textModel": {
                "name": (
                    text_result.model_name
                ),

                "version": (
                    text_result.model_version
                ),

                "syntheticData": (
                    text_result.synthetic_data
                ),
            },
        },
    )


def classify_occurrence(
    *,
    occurrence_id: str | None,
    text: str | None,
    image_bytes: bytes | None = None,
    image_content_type: str | None = None,
    visual_model: VisualClassifier | None = None,
    text_model: TextClassifier | None = None,
) -> ClassifyResponse:
    image_received = (
        image_bytes is not None
    )

    usable_text = (
        text or ""
    ).strip()

    visual_result: (
        VisualClassificationResult
        | None
    ) = None

    text_result: (
        TextClassificationResult
        | None
    ) = None

    if (
        image_bytes is not None
        and image_content_type is not None
    ):
        resolved_visual_model = (
            visual_model
            if visual_model is not None
            else visual_classifier
        )

        visual_result = (
            resolved_visual_model.classify(
                image_bytes=image_bytes,

                content_type=(
                    image_content_type
                ),
            )
        )

    if usable_text:
        resolved_text_model = (
            text_model
            if text_model is not None
            else get_text_classifier()
        )

        # O texto original é enviado ao
        # tokenizer. Não fazemos lowercase,
        # remoção de acentos, stemming ou
        # normalização adicional.
        text_result = (
            resolved_text_model.classify(
                text=(
                    text
                    if text is not None
                    else ""
                )
            )
        )

    # A fusão só ocorre quando as duas
    # modalidades realmente produziram
    # evidência AVAILABLE.
    if (
        visual_result is not None
        and text_result is not None
        and visual_result.result_status
        == "AVAILABLE"
        and text_result.result_status
        == "AVAILABLE"
    ):
        decision = (
            fuse_available_results(
                visual_result=(
                    visual_result
                ),

                text_result=(
                    text_result
                ),
            )
        )

        return _multimodal_response(
            occurrence_id=occurrence_id,

            visual_result=visual_result,

            text_result=text_result,

            decision=decision,
        )

    # Se a visão funcionou, mas o texto
    # falhou ou está indisponível, preservamos
    # a evidência visual em vez de transformar
    # a ocorrência em erro.
    if (
        visual_result is not None
        and visual_result.result_status
        == "AVAILABLE"
    ):
        return _visual_response(
            occurrence_id=occurrence_id,

            visual_result=visual_result,

            image_used=True,

            text_result=text_result,
        )

    # Se o texto funcionou, uma falha ou
    # indisponibilidade visual não impede
    # a classificação textual.
    if (
        text_result is not None
        and text_result.result_status
        == "AVAILABLE"
    ):
        return _text_response(
            occurrence_id=occurrence_id,

            image_received=(
                image_received
            ),

            visual_result=visual_result,

            text_result=text_result,
        )

    # Quando houve tentativa textual, mas
    # nenhuma modalidade produziu AVAILABLE,
    # preservamos o estado textual. Isso
    # mantém compatibilidade com o comportamento
    # anterior para ERROR/UNAVAILABLE.
    if text_result is not None:
        return _text_response(
            occurrence_id=occurrence_id,

            image_received=(
                image_received
            ),

            visual_result=visual_result,

            text_result=text_result,
        )

    if visual_result is not None:
        return _visual_response(
            occurrence_id=occurrence_id,

            visual_result=visual_result,

            image_used=False,
        )

    return ClassifyResponse(
        resultStatus="UNAVAILABLE",

        predictedCobradeCode=None,

        confidence=None,

        visualConfidence=None,

        textConfidence=None,

        ambiguous=False,

        ambiguityReason=None,

        explanationSimple=(
            "Nenhum texto utilizável ou modelo "
            "visual disponível para realizar "
            "a pré-análise."
        ),

        model=ModelInfo(
            modelType="VISUAL",

            name=(
                "visual-model-placeholder"
            ),

            version="0.2.0",

            syntheticData=True,
        ),

        signals={
            "occurrenceId": occurrence_id,

            "textUsed": False,

            "imageReceived": (
                image_received
            ),

            "imageUsed": False,

            "visualLabel": None,

            "candidateCobradeCodes": [],
        },
    )