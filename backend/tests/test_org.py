from tests.conftest import login


def test_structure_crud_chain(client):
    """Админ создаёт факультет → кафедру → предмет → группу (критерий M1)."""
    headers = login(client, "admin")

    faculty = client.post("/api/v1/faculties", headers=headers,
                          json={"name_uz": "Davolash ishi", "name_ru": "Лечебное дело"})
    assert faculty.status_code == 201
    faculty_id = faculty.json()["id"]

    department = client.post("/api/v1/departments", headers=headers,
                             json={"faculty_id": faculty_id, "name_uz": "Anatomiya",
                                   "name_ru": "Анатомия"})
    assert department.status_code == 201

    subject = client.post("/api/v1/subjects", headers=headers,
                          json={"department_id": department.json()["id"],
                                "name_uz": "Odam anatomiyasi", "name_ru": "Анатомия человека"})
    assert subject.status_code == 201

    group = client.post("/api/v1/groups", headers=headers,
                        json={"faculty_id": faculty_id, "name": "101-A", "year_of_study": 1})
    assert group.status_code == 201

    assert len(client.get("/api/v1/faculties", headers=headers).json()) == 1


def test_rbac_student_cannot_manage_structure(client):
    headers = login(client, "student")
    response = client.post("/api/v1/faculties", headers=headers,
                           json={"name_uz": "X", "name_ru": "X"})
    assert response.status_code == 403
    assert client.get("/api/v1/users", headers=headers).status_code == 403


def test_unauthorized_rejected(client):
    assert client.get("/api/v1/faculties").status_code == 401


def test_duplicate_email_rejected(client):
    headers = login(client, "admin")
    response = client.post("/api/v1/users", headers=headers,
                           json={"role": "student", "full_name": "Dup",
                                 "email": "student@test.uz", "password": "pass1234"})
    assert response.status_code == 409
