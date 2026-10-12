from fastapi import APIRouter, Depends

from app.api.routes.classification import router as classification_router
from app.api.routes.explanation import router as explanation_router
from app.api.routes.health import router as health_router
from app.api.routes.prediction import router as prediction_router
from app.core.security import require_internal_api_key


api_router = APIRouter()

# /health continua aberto para o healthcheck do Docker.
api_router.include_router(health_router)

protected = [Depends(require_internal_api_key)]

api_router.include_router(classification_router, dependencies=protected)
api_router.include_router(prediction_router, dependencies=protected)
api_router.include_router(explanation_router, dependencies=protected)
