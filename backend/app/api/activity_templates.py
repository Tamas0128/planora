from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import ActivityTemplate, ActivityTemplateDependency, User, UserRole
from app.schemas import (
    ActivityTemplateCreate,
    ActivityTemplateResponse,
    ActivityTemplateUpdate,
    TemplateDependencyCreate,
)

router = APIRouter(prefix="/activity-templates", tags=["activity-templates"])


def _to_response(db: Session, t: ActivityTemplate) -> ActivityTemplateResponse:
    deps = db.query(ActivityTemplateDependency).filter(
        ActivityTemplateDependency.template_id == t.id
    ).all()
    return ActivityTemplateResponse(
        id=t.id,
        name=t.name,
        duration_days=t.duration_days,
        sort_order=t.sort_order,
        default_prep_days=t.default_prep_days,
        responsible_role=t.responsible_role,
        prerequisite_template_ids=[d.prerequisite_template_id for d in deps],
    )


@router.get("", response_model=list[ActivityTemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    templates = db.query(ActivityTemplate).order_by(ActivityTemplate.sort_order).all()
    return [_to_response(db, t) for t in templates]


@router.post("", response_model=ActivityTemplateResponse)
def create_template(
    body: ActivityTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    if db.query(ActivityTemplate).filter(ActivityTemplate.name == body.name).first():
        raise HTTPException(status_code=400, detail="Már létezik sablon ezzel a névvel")
    max_sort = db.query(ActivityTemplate).count()
    template = ActivityTemplate(
        name=body.name,
        duration_days=body.duration_days,
        sort_order=max_sort,
        default_prep_days=body.default_prep_days,
        responsible_role=body.responsible_role,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return _to_response(db, template)


@router.patch("/{template_id}", response_model=ActivityTemplateResponse)
def update_template(
    template_id: int,
    body: ActivityTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    template = db.query(ActivityTemplate).get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    updates = body.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != template.name:
        if db.query(ActivityTemplate).filter(
            ActivityTemplate.name == updates["name"], ActivityTemplate.id != template_id
        ).first():
            raise HTTPException(status_code=400, detail="Már létezik sablon ezzel a névvel")

    if "sort_order" in updates:
        # Same "requested position, not raw column value" contract as
        # Activity.sort_order reordering (backend/app/api/projects.py's
        # update_activity) — 1-based position among ALL templates, siblings
        # get resequenced to a dense 0..n-1 range.
        requested_position = updates.pop("sort_order")
        siblings = db.query(ActivityTemplate).order_by(ActivityTemplate.sort_order).all()
        siblings.remove(template)
        insert_at = max(0, min(requested_position - 1, len(siblings)))
        siblings.insert(insert_at, template)
        for idx, sib in enumerate(siblings):
            if sib.sort_order != idx:
                sib.sort_order = idx

    for field, value in updates.items():
        setattr(template, field, value)
    db.commit()
    return _to_response(db, template)


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    template = db.query(ActivityTemplate).get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    # Existing Activity rows keep their own copied fields (name/duration/etc.);
    # template_id is nulled via ondelete=SET NULL — no cross-table cleanup
    # needed here, past projects are unaffected by deleting/editing a template.
    db.delete(template)
    db.commit()
    return {"ok": True}


@router.post("/{template_id}/dependencies")
def add_template_dependency(
    template_id: int,
    body: TemplateDependencyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    if template_id == body.prerequisite_template_id:
        raise HTTPException(status_code=400, detail="Egy sablon nem függhet önmagától")
    template = db.query(ActivityTemplate).get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    prereq = db.query(ActivityTemplate).get(body.prerequisite_template_id)
    if not prereq:
        raise HTTPException(status_code=404, detail="Előfeltétel sablon nem található")
    existing = db.query(ActivityTemplateDependency).filter(
        ActivityTemplateDependency.template_id == template_id,
        ActivityTemplateDependency.prerequisite_template_id == body.prerequisite_template_id,
    ).first()
    if not existing:
        db.add(ActivityTemplateDependency(
            template_id=template_id,
            prerequisite_template_id=body.prerequisite_template_id,
        ))
        db.commit()
    return {"ok": True}


@router.delete("/{template_id}/dependencies/{prerequisite_template_id}")
def remove_template_dependency(
    template_id: int,
    prerequisite_template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    dep = db.query(ActivityTemplateDependency).filter(
        ActivityTemplateDependency.template_id == template_id,
        ActivityTemplateDependency.prerequisite_template_id == prerequisite_template_id,
    ).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Függőség nem található")
    db.delete(dep)
    db.commit()
    return {"ok": True}
