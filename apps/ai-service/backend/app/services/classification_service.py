from app.models.text_classifier import (
    TextClassificationResult,
    TextClassifier,
    TextLabel,
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


def _visual_response(
    *,
    occurrence_id: str | None,
    visual_result: VisualClassificationResult,
    image_used: bool,
) -> ClassifyResponse:
    return ClassifyResponse(
        resultStatus=visual_result.result_status,

        # O modelo visual trabalha com
        # famílias amplas e não determina
        # sozinho uma COBRADE exata.
        predictedCobradeCode=None,

        confidence=visual_result.confidence,

        explanationSimple=(
            visual_result.explanation_simple
        ),

        model=ModelInfo(
            modelType="VISUAL",
            name=visual_result.model_name,
            version=visual_result.model_version,
            syntheticData=(
                visual_result.synthetic_data
            ),
        ),

        signals={
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
        },
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
            TEXT_LABEL_TO_COBRADE_CODE[
                text_result.predicted_label
            ]
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

        explanationSimple=(
            text_result.explanation_simple
        ),

        model=ModelInfo(
            modelType="TEXTUAL",
            name=text_result.model_name,
            version=text_result.model_version,
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

            # Nesta etapa ainda não existe
            # fusão multimodal. Quando o
            # resultado textual é usado, a
            # imagem não participa da decisão.
            "imageUsed": False,

            "textLabel": (
                text_result.predicted_label
            ),

            "textProbabilities": (
                text_result.probabilities
            ),

            # Preservamos a informação
            # visual caso uma imagem tenha
            # sido tentada antes do fallback
            # textual. Isso será útil para
            # rastreabilidade e para a futura
            # fusão multimodal.
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

    resolved_visual_model = (
        visual_model
        if visual_model is not None
        else visual_classifier
    )

    visual_result: (
        VisualClassificationResult
        | None
    ) = None

    if (
        image_bytes is not None
        and image_content_type is not None
    ):
        visual_result = (
            resolved_visual_model.classify(
                image_bytes=image_bytes,
                content_type=(
                    image_content_type
                ),
            )
        )

        # Nesta primeira integração textual
        # preservamos deliberadamente a
        # precedência existente da visão.
        #
        # A combinação entre visão e texto
        # será implementada separadamente
        # na etapa multimodal.
        if (
            visual_result.result_status
            == "AVAILABLE"
        ):
            return _visual_response(
                occurrence_id=occurrence_id,
                visual_result=visual_result,
                image_used=True,
            )

    usable_text = (
        text or ""
    ).strip()

    if usable_text:
        resolved_text_model = (
            text_model
            if text_model is not None
            else get_text_classifier()
        )

        # Não fazemos lowercase,
        # remoção de acentos, stemming
        # nem outra normalização.
        #
        # O BERTimbau recebe o texto
        # original da requisição.
        text_result = (
            resolved_text_model.classify(
                text=(
                    text
                    if text is not None
                    else ""
                )
            )
        )

        return _text_response(
            occurrence_id=occurrence_id,
            image_received=image_received,
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

        explanationSimple=(
            "Nenhum texto utilizável ou modelo visual "
            "disponível para realizar a pré-análise."
        ),

        model=ModelInfo(
            modelType="VISUAL",
            name="visual-model-placeholder",
            version="0.2.0",
            syntheticData=True,
        ),

        signals={
            "occurrenceId": occurrence_id,
            "textUsed": False,
            "imageReceived": False,
            "imageUsed": False,
            "visualLabel": None,
            "candidateCobradeCodes": [],
        },
    )