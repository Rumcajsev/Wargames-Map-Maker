from fastapi import APIRouter

router = APIRouter()


@router.post("/road")
async def route_road() -> dict:
    return {"status": "not_implemented"}
