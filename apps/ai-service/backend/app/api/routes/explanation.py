from fastapi import APIRouter

from app.schemas.explanation import ExplainRequest

from app.services.explanation_service import explain_result


router = APIRouter()


@router.post("/explain")
def explain(
    payload: ExplainRequest,
) -> dict[str, object]:
    return explain_result(payload)