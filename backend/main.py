from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env', override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import generate, route, export

app = FastAPI(title="IG2 Hex Map Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router, prefix="/generate")
app.include_router(route.router, prefix="/route")
app.include_router(export.router, prefix="/export")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
