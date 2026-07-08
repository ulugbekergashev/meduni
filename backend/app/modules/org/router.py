from fastapi import APIRouter, UploadFile
from sqlalchemy import select

from app.core.deps import DbSession, require_roles
from app.core.errors import not_found
from app.core.security import hash_password
from app.modules.auth.models import User
from app.modules.auth.schemas import UserOut
from app.modules.org import service
from app.modules.org.models import Department, Faculty, GroupMembership, StudentGroup, Subject
from app.modules.org.schemas import (
    DepartmentIn, DepartmentOut, FacultyOut, GroupIn, GroupOut,
    ImportReport, NamedIn, SubjectIn, SubjectOut, UserCreate, UserUpdate,
)

admin_only = require_roles("admin")
router = APIRouter(tags=["org"])

# --- Справочники структуры: единый CRUD-паттерн -------------------------------

_CRUD = [
    ("/faculties", Faculty, NamedIn, FacultyOut),
    ("/departments", Department, DepartmentIn, DepartmentOut),
    ("/subjects", Subject, SubjectIn, SubjectOut),
    ("/groups", StudentGroup, GroupIn, GroupOut),
]


def _register_crud(prefix: str, model, schema_in, schema_out):
    @router.get(prefix, response_model=list[schema_out], dependencies=[admin_only])
    def list_items(db: DbSession):
        return db.scalars(select(model).order_by(model.id)).all()

    @router.post(prefix, response_model=schema_out, status_code=201, dependencies=[admin_only])
    def create_item(body: schema_in, db: DbSession):  # type: ignore[valid-type]
        item = model(**body.model_dump())
        db.add(item)
        db.commit()
        return item

    @router.put(prefix + "/{item_id}", response_model=schema_out, dependencies=[admin_only])
    def update_item(item_id: int, body: schema_in, db: DbSession):  # type: ignore[valid-type]
        item = db.get(model, item_id)
        if item is None:
            raise not_found()
        for key, value in body.model_dump().items():
            setattr(item, key, value)
        db.commit()
        return item

    @router.delete(prefix + "/{item_id}", dependencies=[admin_only])
    def delete_item(item_id: int, db: DbSession):
        item = db.get(model, item_id)
        if item is None:
            raise not_found()
        db.delete(item)
        db.commit()
        return {"ok": True}


for _prefix, _model, _in, _out in _CRUD:
    _register_crud(_prefix, _model, _in, _out)

# --- Пользователи --------------------------------------------------------------


@router.get("/users", response_model=list[UserOut], dependencies=[admin_only])
def list_users(db: DbSession, role: str | None = None):
    query = select(User).order_by(User.id)
    if role:
        query = query.where(User.role == role)
    return db.scalars(query).all()


@router.post("/users", response_model=UserOut, status_code=201, dependencies=[admin_only])
def create_user(body: UserCreate, db: DbSession):
    user = service.create_user(db, body)
    db.commit()
    return user


@router.patch("/users/{user_id}", response_model=UserOut, dependencies=[admin_only])
def update_user(user_id: int, body: UserUpdate, db: DbSession):
    user = db.get(User, user_id)
    if user is None:
        raise not_found()
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        user.password_hash = hash_password(data.pop("password"))
    if "group_id" in data:
        group_id = data.pop("group_id")
        membership = db.scalar(select(GroupMembership).where(GroupMembership.student_id == user.id))
        if membership:
            membership.group_id = group_id
        elif group_id is not None:
            db.add(GroupMembership(student_id=user.id, group_id=group_id))
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    return user


@router.post("/users/import", response_model=ImportReport, dependencies=[admin_only])
async def import_users(file: UploadFile, db: DbSession):
    content = await file.read()
    return service.import_users_xlsx(db, content)
