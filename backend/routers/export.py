import io
import base64
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader

router = APIRouter()


class ExportPDFRequest(BaseModel):
    image_b64: str        # PNG encoded as base64
    paper_mm: list[float]  # [width_mm, height_mm]


@router.post("/pdf")
async def export_pdf(req: ExportPDFRequest) -> StreamingResponse:
    w_mm, h_mm = req.paper_mm
    w_pt = w_mm * mm
    h_pt = h_mm * mm

    img_bytes = base64.b64decode(req.image_b64)
    img_reader = ImageReader(io.BytesIO(img_bytes))

    pdf_buf = io.BytesIO()
    c = rl_canvas.Canvas(pdf_buf, pagesize=(w_pt, h_pt))
    c.drawImage(img_reader, 0, 0, width=w_pt, height=h_pt)
    c.save()
    pdf_buf.seek(0)

    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=map.pdf"},
    )
