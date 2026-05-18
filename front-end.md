You are a senior full-stack AI SaaS architect and engineer.

I already have an EXISTING chatbot backend with:
- RAG pipeline
- embeddings
- chunking
- vector search
- LLM integration
- FastAPI or Flask backend
- PostgreSQL database

I do NOT want to rebuild from scratch.

I want to EVOLVE the current chatbot into a MULTI-TENANT SaaS PLATFORM with:
- customer dashboard
- embeddable chatbot widget
- multiple chatbots
- separate knowledge bases
- public widget chat frontend

IMPORTANT:
Do NOT redesign the whole system.
Preserve the existing backend and refactor incrementally.

==================================================
HIGH LEVEL ARCHITECTURE
==================================================

The system should have 4 separate frontend/backend areas:

1. Marketing Website
2. Customer Dashboard
3. Widget Chat Frontend
4. Shared Backend API

Architecture:

yourcompany.com
- marketing website

app.yourcompany.com
- customer dashboard

widget.yourcompany.com
- public embeddable chatbot frontend

api.yourcompany.com
- shared backend API

==================================================
IMPORTANT FRONTEND REQUIREMENT
==================================================

I do NOT want to reuse my existing chatbot frontend as the widget frontend.

Reason:
- current frontend contains uploads/admin functionality
- widget should ONLY focus on chat
- widget should be lightweight and customer-facing

Therefore:
- create NEW widget frontend
- create NEW SaaS dashboard frontend
- existing chatbot frontend can remain internal/testing only

==================================================
TECH STACK
==================================================

Frontend:
- React
- TypeScript
- Vite
- TailwindCSS

Backend:
- FastAPI preferred
- SQLAlchemy
- Alembic

Database:
- PostgreSQL
- pgvector

AI:
- Ollama/OpenAI compatible

Infrastructure:
- Docker Compose
- Nginx

Optional:
- Redis
- Celery/RQ

==================================================
PRIMARY PRODUCT GOAL
==================================================

Users should be able to:

1. Register/login
2. Create chatbot
3. Upload PDF knowledge base
4. Generate chatbot
5. Copy embed code
6. Embed chatbot into website

Example embed:

<script
 src="https://widget.yourcompany.com/widget.js"
 data-chatbot-id="abc123">
</script>

==================================================
AUTHENTICATION REQUIREMENTS
==================================================

IMPORTANT:

Both CUSTOMER USERS and PLATFORM ADMINS should support:

1. Google Login (Gmail OAuth)
2. Traditional email/password login

Use modern authentication architecture.

Requirements:
- JWT auth
- refresh token
- secure session handling
- role-based access control

User roles:
- SUPER_ADMIN
- CUSTOMER_ADMIN
- CUSTOMER_USER

==================================================
MULTI-TENANT REQUIREMENTS
==================================================

The MOST IMPORTANT refactor is introducing:

chatbot_id

into:
- documents
- chunks
- conversations
- retrieval queries

Every retrieval query MUST be filtered by chatbot_id.

This prevents cross-tenant data leakage.

==================================================
DATABASE STRUCTURE
==================================================

Generate recommended schema for:

users
- id
- email
- password_hash (nullable for Google login)
- google_id (nullable)
- role
- organization_id
- created_at

organizations
- id
- name

chatbots
- id
- organization_id
- name
- welcome_message
- theme_color
- system_prompt

documents
- id
- chatbot_id
- filename

chunks
- id
- chatbot_id
- document_id
- text
- embedding

==================================================
BACKEND REQUIREMENTS
==================================================

Create architecture for:
- routers
- services
- repositories
- schemas
- auth
- dependency injection

Required APIs:

AUTH:
POST /auth/register
POST /auth/login
POST /auth/google
POST /auth/refresh

CHATBOTS:
POST /chatbots
GET /chatbots
PUT /chatbots/{id}

DOCUMENTS:
POST /documents/upload

PUBLIC:
POST /public/chat
GET /public/config/{chatbot_id}

==================================================
PUBLIC CHAT FLOW
==================================================

The widget frontend should call:

POST /public/chat

Input:
{
  "chatbot_id": "abc123",
  "message": "Hello"
}

Backend flow:
1. validate chatbot exists
2. retrieve chatbot config
3. generate embedding
4. retrieve chunks filtered by chatbot_id
5. build prompt
6. call LLM
7. return response

==================================================
WIDGET FRONTEND REQUIREMENTS
==================================================

Create a SEPARATE lightweight frontend specifically for embedding.

The widget frontend should ONLY include:
- chat interface
- streaming messages
- chatbot branding
- typing indicator
- mobile responsiveness

The widget frontend should NOT include:
- uploads
- admin pages
- settings
- dashboard functionality

==================================================
WIDGET EMBED ARCHITECTURE
==================================================

Use iframe architecture.

Customer Website
    ↓
widget.js
    ↓
iframe popup
    ↓
widget.yourcompany.com/chatbot/{chatbot_id}

The widget.js script should:
- create floating button
- open/close iframe
- support theme customization

Explain:
- iframe isolation benefits
- CSS isolation
- security considerations
- mobile responsiveness

==================================================
CUSTOMER DASHBOARD REQUIREMENTS
==================================================

Create separate SaaS dashboard frontend.

Dashboard pages:
- Login/Register
- Google Login
- Chatbot List
- Create Chatbot
- Upload Documents
- Chatbot Settings
- Embed Code Page

Embed code page should display:

<script
 src="https://widget.yourcompany.com/widget.js"
 data-chatbot-id="abc123">
</script>

with copy button.

==================================================
ADMIN PANEL REQUIREMENTS
==================================================

Admins should log in using:
- Google login
- or email/password

Admin panel should be separate from customer dashboard.

Example:
admin.yourcompany.com

Admin features:
- manage organizations
- manage users
- disable chatbots
- monitor usage
- inspect conversations

IMPORTANT:
Do NOT mix customer dashboard and admin dashboard.

==================================================
DEVOPS REQUIREMENTS
==================================================

Generate:
- Dockerfiles
- docker-compose.yml
- Nginx config

Suggested services:
- frontend-dashboard
- frontend-widget
- backend-api
- postgres
- redis
- ollama

==================================================
IMPORTANT CONSTRAINTS
==================================================

DO NOT:
- rebuild everything
- overengineer
- introduce Kubernetes
- introduce microservices
- introduce event buses
- create complex AI agents

Focus ONLY on:
- multi-tenancy
- chatbot isolation
- embeddable widget
- dashboard
- authentication
- SaaS conversion

==================================================
RESPONSE STYLE
==================================================

Act like a senior engineer helping evolve an existing chatbot into a real SaaS platform.

Provide:
- practical architecture
- incremental migration strategy
- production-ready code
- security considerations
- scalability considerations

Build step-by-step.

Do NOT skip implementation details.

Always explain:
- why the architecture is designed that way
- what should be built first
- migration risks
- recommended order of implementation