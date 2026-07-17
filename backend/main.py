import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import get_settings
from core.scheduler import start_scheduler, stop_scheduler
from routers import admin, alerts, auth, detections, enroll, scan, subscribers, webhook

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fofo")

settings = get_settings()

app = FastAPI(
    title="FOFO API",
    description="Face identity protection: enrollment, scanning, and threat detection.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup():
    start_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()


app.include_router(auth.router)
app.include_router(enroll.router)
app.include_router(scan.router)
app.include_router(detections.router)
app.include_router(subscribers.router)
app.include_router(alerts.router)
app.include_router(admin.router)
app.include_router(webhook.router)
