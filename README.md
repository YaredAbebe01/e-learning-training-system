# LearnHub - E-Learning & Training Platform

A full-stack learning platform with separate frontend (Next.js) and backend (Express + MongoDB). Instructors can create courses, add modules/lessons, upload thumbnails to Cloudinary, and manage quizzes. Learners can enroll, track progress, and earn certificates. Admins can manage users and courses.

## Project Structure
- frontend: Next.js app (UI)
- backend: Express API (auth, courses, uploads)

## Requirements
- Node.js 18+ (or newer)
- MongoDB (local or Atlas)
- Cloudinary account (for image uploads)

## Environment Setup
Create backend/.env with:
- MONGODB_URI=mongodb://localhost:27017/learnhub
- JWT_SECRET=your-secret
- PORT=4000
- FRONTEND_URL=http://localhost:3000
- CORS_ALLOWED_ORIGINS=http://localhost:3000
- CORS_ALLOWED_ORIGIN_PATTERNS=*.vercel.app
- COOKIE_SAME_SITE=lax
- COOKIE_SECURE=false
- CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

Create frontend/.env.local with:
- API_BASE_URL=http://localhost:4000
- NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

## Run the Backend
From the backend folder:
- npm install
- npm run dev

Backend will start at http://localhost:4000

## Run the Frontend
From the frontend folder:
- npm install
- npm run dev

Frontend will start at http://localhost:3000


## Notes
- Image uploads require a logged-in instructor.
- If you change env values, restart the backend.

## Deploy: Vercel + Render
Use Vercel for the frontend and Render for the backend.

### Render backend
- Service type: Web Service
- Root directory: `backend`
- Build command: `npm install`
- Start command: `node src/server.js`
- Health check path: `/health`

Set these Render environment variables:
- `NODE_ENV=production`
- `PORT=10000`
- `MONGODB_URI=<your mongodb atlas uri>`
- `JWT_SECRET=<a long random secret>`
- `FRONTEND_URL=https://your-frontend-domain.vercel.app`
- `CORS_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app`
- `CORS_ALLOWED_ORIGIN_PATTERNS=*.vercel.app`
- `COOKIE_SAME_SITE=lax`
- `COOKIE_SECURE=true`
- `CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>`

### Vercel frontend
- Import the same repository into Vercel
- Set the project Root Directory to `frontend`
- Framework preset: Next.js

Set these Vercel environment variables:
- `API_BASE_URL=https://your-backend-name.onrender.com`
- `NEXT_PUBLIC_API_BASE_URL=https://your-backend-name.onrender.com`

Files added for deployment:
- `frontend/vercel.json`
- `render.yaml`
- `frontend/.env.example`
- `backend/.env.example`

### Important production note
Login, register, and logout now go through the frontend `/api` proxy so auth cookies stay on the Vercel domain. This is important for server-rendered dashboard pages to keep working in production.

## Common Issues
- MongoDB not running: start your local MongoDB service or update MONGODB_URI.
- Upload errors: verify CLOUDINARY_URL and restart the backend.

## License
MIT
