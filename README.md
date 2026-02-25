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
- CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

Create frontend/.env.local with:
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

## Common Issues
- MongoDB not running: start your local MongoDB service or update MONGODB_URI.
- Upload errors: verify CLOUDINARY_URL and restart the backend.

## License
MIT
