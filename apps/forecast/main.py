from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
from prophet import Prophet


app = FastAPI(title="SwiftServe Forecast Service", version="0.1.0")


class HistoryPoint(BaseModel):
    ds: date
    y: float = Field(..., ge=0)


class ForecastRequest(BaseModel):
    history: List[HistoryPoint] = Field(..., min_length=7, description="Daily demand history")
    horizon_days: int = Field(14, ge=1, le=90)
    seasonality_mode: str = Field("additive")


class ForecastPoint(BaseModel):
    ds: date
    yhat: float
    yhat_lower: float
    yhat_upper: float


class ForecastResponse(BaseModel):
    generated_at: datetime
    horizon_days: int
    forecast: List[ForecastPoint]


@app.get("/health")
def health():
    return {"status": "ok", "ts": datetime.utcnow().isoformat()}


@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest):
    df = pd.DataFrame([{"ds": p.ds, "y": p.y} for p in req.history]).sort_values("ds")

    m = Prophet(seasonality_mode=req.seasonality_mode)
    m.fit(df)

    future = m.make_future_dataframe(periods=req.horizon_days, freq="D", include_history=False)
    fc = m.predict(future)[["ds", "yhat", "yhat_lower", "yhat_upper"]]

    out = [
        ForecastPoint(
            ds=row["ds"].date() if hasattr(row["ds"], "date") else row["ds"],
            yhat=float(max(0.0, row["yhat"])),
            yhat_lower=float(max(0.0, row["yhat_lower"])),
            yhat_upper=float(max(0.0, row["yhat_upper"])),
        )
        for _, row in fc.iterrows()
    ]

    return ForecastResponse(
        generated_at=datetime.utcnow(),
        horizon_days=req.horizon_days,
        forecast=out,
    )

