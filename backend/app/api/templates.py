"""Message template endpoints: list, variable reference, CRUD, and render-for-event."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Event, MessageTemplate, Team, User
from app.schemas import (
    RenderRequest,
    RenderResponse,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
)
from app.templates.renderer import get_variable_list, render_template

router = APIRouter(prefix="/templates", tags=["templates"])


async def _get_team_template(template_id: uuid.UUID, db: AsyncSession, user: User) -> MessageTemplate:
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
    return template


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


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = MessageTemplate(team_id=user.team_id, name=payload.name, body=payload.body)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = await _get_team_template(template_id, db, user)
    if payload.name is not None:
        template.name = payload.name
    if payload.body is not None:
        template.body = payload.body
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = await _get_team_template(template_id, db, user)
    await db.delete(template)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
