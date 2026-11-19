# MOMENTO

**Live Website:** https://momento-teal-theta.vercel.app  
**Backend API:** https://momento-api-d00v.onrender.com

MOMENTO is a collaborative digital scrapbook for friends to organize plans, capture memories, and keep their shared stories in one place. Each group has a private space where members can contribute to albums, scrapbook pages, notes, plans, and inside jokes.

## Features

- **User accounts:** Register, log in, log out, update account details, and manage profile pictures.
- **Shared spaces:** Create a space or join an existing one with an invitation code. View group members and their avatars, and rename the group from the home dashboard.
- **Shared photo albums:** Create albums, upload and manage photos, and browse memories together.
- **Scrapbook editor:** Decorate photos with stickers and washi tape. Drag, resize, and rotate decorations, then save the layout for other members to view.
- **Lore Cards:** Record inside jokes and group stories on two-sided, flip-style cards. React with *Still Funny* and add alternative versions of events.
- **Sticky notes:** Post and edit notes on the shared dashboard.
- **Bucket list:** Add activities and track which ones the group has completed.
- **Shared calendar:** Schedule, edit, and view group events with member-specific colors.
- **Personalized themes:** Switch between the project's three scrapbook-inspired visual themes.

Shared content is saved in MongoDB and remains available after refreshes and subsequent logins.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, React Router, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js, REST API |
| Database | MongoDB Atlas, Mongoose |
| Authentication | `express-session`, `connect-mongo`, bcrypt |
| Security and validation | Helmet, CORS, rate limiting, Zod |
| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas (database) |
| Testing | Node.js built-in test runner, Oxlint, Vite production build |

## Architecture Overview

MOMENTO follows a client-server architecture:

1. **React frontend:** Renders the interface, manages page navigation, and sends HTTP requests to the API.
2. **Express backend:** Exposes REST endpoints for authentication, spaces, albums, scrapbook content, Lore Cards, notes, bucket lists, calendar events, and accounts. Protected routes check the user's session and permissions.
3. **MongoDB Atlas:** Stores users, shared-space data, photos and scrapbook metadata, and MongoDB-backed sessions.

In production, Vercel hosts the React application and forwards requests to `/api/*` to the Express API hosted on Render. This lets the browser use the same website origin for the frontend and API requests. The backend connects to MongoDB Atlas for persistent storage.

### Repository Structure

```text
Momento/
├── client/                 # React/Vite application
│   ├── src/                # Components, pages, themes, and utilities
│   └── vercel.json         # Production routing and API rewrites
├── server/                 # Express REST API
│   ├── models/             # MongoDB/Mongoose data models
│   ├── routes/             # API endpoints
│   ├── middleware/         # Authentication, validation, and security
│   └── tests/              # Backend automated tests
└── README.md
```

## Installation and Local Setup

### Prerequisites

- Node.js and npm (Node.js 24 is recommended for consistency with development).
- Access to a MongoDB Atlas database and a valid connection string.
- A MongoDB Atlas network access rule allowing your development IP address.

### 1. Clone the repository

```bash
git clone https://github.com/zeinamraddd/Momento.git
cd Momento
```

### 2. Configure and start the backend

Install the server dependencies:

```bash
cd server
npm install
```

Create a file named `.env` inside `server/` with these settings:

```dotenv
PORT=3000
NODE_ENV=development
MONGODB_URI=your_mongodb_atlas_connection_string
SESSION_SECRET=replace_with_a_long_random_secret_of_at_least_32_characters
CLIENT_ORIGIN=http://localhost:5173
```

Replace the placeholder values with your own MongoDB connection string and session secret. Do not commit `.env` files, passwords, or other credentials to Git.

Start the server:

```bash
npm run dev
```

The API runs at **http://localhost:3000**. To check that it is running, visit:

`http://localhost:3000/api/health`

### 3. Configure and start the frontend

Open a **second terminal** from the repository root, then run:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

The frontend uses `http://localhost:3000` as its API address during local development. A `client/.env` file is not required for the default setup. If your local API runs elsewhere, set `VITE_API_URL` in `client/.env` to that API's base URL.

### 4. Run checks

Backend automated tests (from `server/`):

```bash
npm test
```

Frontend lint and production build (from `client/`):

```bash
npm run lint
npm run build
```

These checks help verify the API routes, security behavior, client code, and production build before deployment.

## Deployment Notes

- **Frontend:** Deployed on Vercel from the `client/` directory.
- **Backend:** Deployed on Render from the `server/` directory.
- **Database:** MongoDB Atlas is used by the deployed API.
- **Configuration:** Hosting credentials and secrets are stored as environment variables on the hosting platforms, not in the repository.
- **Allowed frontend origin:** The backend's production `CLIENT_ORIGIN` is set to `https://momento-teal-theta.vercel.app`.
- **Email functionality:** Email notifications and password-reset emails require SMTP settings. They are not enabled in the hosted free-tier demo; the rest of the application works without SMTP.

To confirm the deployed API is reachable through the website, visit:

https://momento-teal-theta.vercel.app/api/health
