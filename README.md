# Momento

## Project Description

Momento is a full-stack web application that allows friends to create shared digital spaces where they can organize plans, preserve memories, and document their shared experiences.

The platform combines digital scrapbooks, shared photo albums, sticky notes, bucket lists, inside jokes (Lore Cards), and a collaborative calendar.

Momento aims to turn shared plans into lasting memories.

## Technologies Used

**Frontend**
- React
- Vite
- JavaScript
- CSS

**Backend**
- Node.js
- Express.js

**Planned Database**
- MongoDB

## Project Structure

```text
Momento/
├── client/       # React frontend
├── server/       # Express backend
├── docs/         # Wireframes and database schema
└── README.md
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd Momento
```

### 2. Frontend Setup

```bash
cd client
npm install
```

Create a `.env` file in `client/` using `.env.example` as a template.

Start the frontend:

```bash
npm run dev
```

The frontend will normally run at `http://localhost:5173`.

### 3. Backend Setup

Open a second terminal.

```bash
cd server
npm install
```

Create a `.env` file in `server/` using `.env.example` as a template.

Start the backend:

```bash
npm run dev
```

The backend runs at `http://localhost:3000`.

The API health endpoint is:

`GET http://localhost:3000/api/health`

## Planned Features

- **Shared Spaces:** Invite friends to collaborate in a shared digital space.
- **Shared Albums:** Upload photos and decorate them with stickers in a scrapbook-style interface.
- **Sticky Notes:** Leave messages on a collaborative dashboard.
- **Bucket List:** Create and track activities to complete together.
- **Lore Cards:** Preserve inside jokes, alternate versions of events, and reactions.
- **Shared Calendar:** Schedule plans using personalized colors.
- **Themes:** Choose from three visual themes.

## Milestone 1

The first milestone focuses on establishing the foundation of the application, including:

- React and Express project scaffolding
- Environment configuration
- Project setup documentation
- User interface wireframes and navigation flow
- Database schema design

The application's complete functionality will be implemented in future milestones.


## Project Design

The interface and navigation of Momento are documented in the following files:

- [UI Wireframes](docs/wireframes.pdf) — Designs for the login, registration, shared-space setup, dashboard, albums, and scrapbook editor across three themes.
- [Navigation Flow](docs/navigation-flow.png) — Diagram showing how users navigate through the application, including authentication, shared spaces, and the main features.

These documents serve as references for the development of the React frontend.