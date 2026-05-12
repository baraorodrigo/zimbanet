from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Editoria(StrEnum):
    cidade = "cidade"
    politica = "politica"
    esporte = "esporte"
    cultura = "cultura"
    policia = "policia"
    praias = "praias"
    economia = "economia"
    opiniao = "opiniao"


class SourceType(StrEnum):
    rss = "rss"
    scraper = "scraper"
    api = "api"
    social = "social"
    google_alerts = "google_alerts"


class Priority(StrEnum):
    high = "high"
    medium = "medium"
    low = "low"


class Decision(StrEnum):
    approve = "approve"
    reject = "reject"
    investigate = "investigate"


class ArticleStatus(StrEnum):
    draft = "draft"
    review = "review"
    scheduled = "scheduled"
    published = "published"
    archived = "archived"
    rejected = "rejected"


class ScoredItemStatus(StrEnum):
    queued = "queued"
    scored = "scored"
    enriched = "enriched"
    drafted = "drafted"
    published = "published"
    rejected = "rejected"


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)


class Source(_Base):
    id: str
    name: str
    type: SourceType
    config: dict[str, Any] = Field(default_factory=dict)
    city: str
    priority: Priority = Priority.medium
    active: bool = True
    last_fetched_at: datetime | None = None
    error_count: int = 0


class RawItem(_Base):
    id: str
    source_id: str
    title: str
    body: str | None = None
    url: str
    image_url: str | None = None
    video_url: str | None = None
    published_at: datetime | None = None
    raw_html: str | None = None
    fetched_at: datetime | None = None
    content_hash: str
    semantic_hash: str
    is_duplicate: bool = False
    duplicate_of: str | None = None


class ScoredItem(_Base):
    id: str
    raw_item_id: str
    relevance_score: float | None = None
    virality_score: float | None = None
    risk_score: float | None = None
    risk_flags: list[str] = Field(default_factory=list)
    editoria: Editoria | None = None
    classification: str | None = None
    decision: Decision | None = None
    ai_reasoning: str | None = None
    prompt_version: str | None = None
    status: ScoredItemStatus = ScoredItemStatus.scored
    scored_at: datetime | None = None


class EnrichedItem(_Base):
    id: str
    scored_item_id: str
    briefing: str
    fact_check: dict[str, Any] = Field(default_factory=dict)
    historical_context: str | None = None
    stakeholders: list[dict[str, Any]] = Field(default_factory=list)
    photo_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    web_searches: list[str] = Field(default_factory=list)
    confidence: float | None = None
    prompt_version: str | None = None
    enriched_at: datetime | None = None


class Article(_Base):
    id: str
    scored_item_id: str | None = None
    enriched_item_id: str | None = None
    slug: str
    editoria: Editoria
    kicker: str | None = None
    title: str
    subtitle: str | None = None
    lede: str | None = None
    body: str
    byline: str | None = None
    reading_minutes: int | None = None
    hero_image_url: str | None = None
    hero_image_credit: str | None = None
    hero_image_alt: str | None = None
    tags: list[str] = Field(default_factory=list)
    cities: list[str] = Field(default_factory=list)
    is_breaking: bool = False
    is_exclusive: bool = False
    status: ArticleStatus = ArticleStatus.draft
    risk_score: float | None = None
    confidence: float | None = None
    auto_published: bool = False
    prompt_version: str | None = None
    scheduled_at: datetime | None = None
    published_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CuradorOutput(_Base):
    """Saída estruturada do agente Curador (vinda do tool use)."""

    relevance_score: float = Field(ge=0, le=1)
    virality_score: float = Field(ge=0, le=1)
    risk_score: float = Field(ge=0, le=1)
    risk_flags: list[str] = Field(default_factory=list)
    editoria: Editoria
    classification: str
    decision: Decision
    reasoning: str = Field(min_length=10, max_length=600)


class InvestigadorOutput(_Base):
    """Saída do Investigador (Sonnet) — enriquecimento factual."""

    briefing: str = Field(min_length=40, max_length=2000)
    historical_context: str | None = Field(default=None, max_length=2000)
    fact_check: dict[str, Any] = Field(default_factory=dict)
    stakeholders: list[dict[str, Any]] = Field(default_factory=list)
    photo_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    web_searches: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)


class RedatorOutput(_Base):
    """Saída do Redator (Sonnet) — matéria pronta pra revisão."""

    slug: str = Field(min_length=8, max_length=120)
    kicker: str | None = Field(default=None, max_length=80)
    title: str = Field(min_length=10, max_length=140)
    subtitle: str | None = Field(default=None, max_length=200)
    lede: str = Field(min_length=40, max_length=400)
    body: str = Field(min_length=200, max_length=8000)
    byline: str | None = Field(default=None, max_length=80)
    reading_minutes: int = Field(ge=1, le=30)
    hero_image_alt: str | None = Field(default=None, max_length=200)
    tags: list[str] = Field(default_factory=list)
    cities: list[str] = Field(default_factory=list)
    is_breaking: bool = False
    is_exclusive: bool = False


class VisualOutput(_Base):
    """Saída do Visual (Haiku) — alt text + prompt p/ geração de imagem + crop."""

    hero_image_alt: str = Field(min_length=10, max_length=200)
    image_prompt: str = Field(min_length=20, max_length=600)
    crop_hint: str = Field(default="center", max_length=40)


class AnalistaOutput(_Base):
    """Saída do Analista (Haiku) — feedback editorial pós-publish."""

    rating: float = Field(ge=0, le=10)
    accuracy_assessment: str = Field(min_length=20, max_length=600)
    improvements: list[str] = Field(default_factory=list)


class AuditLogEntry(_Base):
    entity_type: str
    entity_id: str
    action: str
    actor: str
    agent: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_usd: float | None = None
    metadata: dict[str, Any] | None = None
