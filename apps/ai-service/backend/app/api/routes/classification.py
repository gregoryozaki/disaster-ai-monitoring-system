from typing import Annotated

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)

from app.core.constants import (
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_BYTES,
)

from app.schemas.classification import ClassifyResponse

from app.services.classification_service import (
    classify_occurrence,
)


router = APIRouter()


@router.post(
    "/classify",
    response_model=ClassifyResponse,
)
async def classify(
    occurrence_id: Annotated[str | None, Form()] = None,
    text: Annotated[str | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
) -> ClassifyResponse:
    image_bytes: bytes | None = None

    image_content_type: str | None = None

    if image is not None:
        if (
            image.content_type
            not in ALLOWED_IMAGE_MIME_TYPES
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
                ),
                detail="Tipo de imagem não suportado.",
            )

        image_bytes = await image.read(
            MAX_IMAGE_BYTES + 1
        )

        if not image_bytes:
            raise HTTPException(
                status_code=(
                    status.HTTP_422_UNPROCESSABLE_ENTITY
                ),
                detail="A imagem enviada está vazia.",
            )

        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                ),
                detail=(
                    "A imagem excede o limite de 10 MB."
                ),
            )

        image_content_type = image.content_type

    return classify_occurrence(
        occurrence_id=occurrence_id,
        text=text,
        image_bytes=image_bytes,
        image_content_type=image_content_type,
    )