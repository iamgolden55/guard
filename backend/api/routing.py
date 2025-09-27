"""
WebSocket routing configuration for the Security Staff Management System.

Defines WebSocket URL patterns and their corresponding consumers.
"""

from django.urls import path
from .consumers import ReportsConsumer, NotificationConsumer

# WebSocket URL patterns
websocket_urlpatterns = [
    # Reports WebSocket - Real-time report progress and status updates
    path('ws/reports/', ReportsConsumer.as_asgi()),

    # Notifications WebSocket - General system notifications
    path('ws/notifications/', NotificationConsumer.as_asgi()),
]