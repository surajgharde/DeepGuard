"""GET /api/history - paginated list of past analyses."""

from __future__ import annotations

import math
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job
from app.schemas import HistoryPage, build_history_item

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history", response_model=HistoryPage)
def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    status_filter: Literal["all", "queued", "processing", "done", "failed"] = Query(
        "all", alias="status"
    ),
    db: Session = Depends(get_db),
) -> HistoryPage:
    filters = [] if status_filter == "all" else [Job.status == status_filter]

    total = db.scalar(select(func.count()).select_from(Job).where(*filters)) or 0

    rows = (
        db.execute(
            select(Job)
            .where(*filters)
            .order_by(Job.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )

    return HistoryPage(
        items=[build_history_item(job) for job in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )
