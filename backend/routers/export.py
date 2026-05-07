from fastapi import APIRouter

router = APIRouter()


@router.post("/pdf")
async def export_pdf() -> dict:
    return {"status": "not_implemented"}
