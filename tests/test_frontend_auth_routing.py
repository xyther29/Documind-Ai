"""Integration tests for FastAPI serving of frontend authentication and workspace routes."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


AUTH_AND_WORKSPACE_ROUTES = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/demo",
    "/app",
    "/app/nested-route",
]


@pytest.mark.parametrize("route", AUTH_AND_WORKSPACE_ROUTES)
def test_frontend_routes_served_with_spa_index_html(client, route):
    """Verify that direct navigation or page refresh on all public, auth, app, and demo routes
    serves the React SPA dist/index.html with 200 OK and valid HTML content.
    """
    response = client.get(route)
    assert response.status_code == 200, f"Route {route} failed with status {response.status_code}"
    assert "text/html" in response.headers.get("content-type", "")
    assert '<div id="root">' in response.text
    assert "<title>DocuMind AI" in response.text


def test_public_marketing_routes_served(client):
    """Verify that marketing routes continue to be served cleanly."""
    for route in ["/", "/features", "/how-it-works", "/use-cases", "/about", "/contact", "/privacy", "/terms"]:
        response = client.get(route)
        assert response.status_code == 200
        assert '<div id="root">' in response.text
