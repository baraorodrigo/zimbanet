from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app import __version__
from app.api.agents import router as agents_router
from app.api.collect import router as collect_router
from app.api.health import router as health_router
from app.api.pipeline import router as pipeline_router
from app.api.scheduler import router as scheduler_router
from app.config import get_settings
from app.logging import configure_logging, get_logger
from app.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    log = get_logger("zimbanet-radar")
    log.info("startup", env=settings.env, version=__version__)
    start_scheduler()
    yield
    stop_scheduler()
    log.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="ZIMBANET Radar",
        version=__version__,
        description="Motor editorial AI do ZIMBANET — coleta, scoring, redação e moderação.",
        lifespan=lifespan,
    )
    app.include_router(health_router, prefix="/health", tags=["health"])
    app.include_router(agents_router, prefix="/agents", tags=["agents"])
    app.include_router(collect_router, prefix="/collect", tags=["collect"])
    app.include_router(pipeline_router, prefix="/pipeline", tags=["pipeline"])
    app.include_router(scheduler_router, prefix="/scheduler", tags=["scheduler"])
    return app


app = create_app()
