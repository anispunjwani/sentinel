"""Message template endpoints: list, variable reference, and render-for-event."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Event, MessageTemplate, Team, User
from app.schemas import RenderRequest, RenderResponse, TemplateOut
from app.templates.renderer import get_variable_list, render_template

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MessageTemplate).where(MessageTemplate.team_id == user.team_id).order_by(
            MessageTemplate.name
        )
    )
    return result.scalars().all()


@router.get("/variables")
async def list_variables(user: User = Depends(get_current_user)):
    """Return the template variable reference for the builder UI."""
    return get_variable_list()


@router.post("/{template_id}/render", response_model=RenderResponse)
async def render(
    template_id: uuid.UUID,
    payload: RenderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Render a template against a specific event, ready to copy and send."""
    template = (
        await db.execute(
            select(MessageTemplate).where(
                MessageTemplate.id == template_id,
                MessageTemplate.team_id == user.team_id,
            )
        )
    ).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    event = (
        await db.execute(
            select(Event).where(
                Event.id == payload.event_id, Event.team_id == user.team_id
            )
        )
    ).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    team = (
        await db.execute(select(Team).where(Team.id == user.team_id))
    ).scalar_one_or_none()

    rendered = render_template(template, event, team.name, user.timezone)
    return RenderResponse(event_id=event.id, template_id=template.id, rendered=rendered)
