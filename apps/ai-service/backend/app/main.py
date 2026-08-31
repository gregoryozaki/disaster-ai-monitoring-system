from fastapi import FastAPI

from app.api.router import api_router


app = FastAPI(
    title="Kamara AI Service",
    version="0.3.0",
)

app.include_router(api_router)
