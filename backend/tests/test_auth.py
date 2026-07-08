from tests.conftest import login


def test_login_and_me(client):
    headers = login(client, "admin")
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"


def test_login_wrong_password(client):
    response = client.post("/api/v1/auth/login",
                           json={"email": "admin@test.uz", "password": "wrong"})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "invalid_credentials"


def test_refresh_flow(client):
    tokens = client.post("/api/v1/auth/login",
                         json={"email": "admin@test.uz", "password": "pass1234"}).json()
    refreshed = client.post("/api/v1/auth/refresh",
                            json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    assert "access_token" in refreshed.json()


def test_access_token_not_valid_as_refresh(client):
    tokens = client.post("/api/v1/auth/login",
                         json={"email": "admin@test.uz", "password": "pass1234"}).json()
    response = client.post("/api/v1/auth/refresh",
                           json={"refresh_token": tokens["access_token"]})
    assert response.status_code == 401
