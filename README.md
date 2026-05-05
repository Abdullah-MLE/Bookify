# AI Summary Maker

## Project Structure

```
AI-Summary-maker/
├── frontend/          ← Next.js app  │ Dockerfile → Docker
├── backend/           ← Summary API  │ Dockerfile → Docker
└── twin-backend/      ← Chatbot API  │ No Docker  → Cloud Function
```

---

## Local Development

**Frontend**
```powershell
cd frontend
npm run dev
```

**Summary Backend**
```powershell
cd backend
.\.venv\Scripts\activate
uvicorn main:app --reload
```

**Twin Backend (Chatbot)**
```powershell
cd twin-backend
.venv\Scripts\uvicorn server:app --reload --port 8001
```

---

## Docker (each service separately)

**Frontend**
```powershell
cd frontend
docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" -t summary-frontend .
docker run -p 80:80 summary-frontend
```

**Summary Backend**
```powershell
cd backend
docker build -t summary-backend .
docker run -p 8000:8000 -e CLERK_SECRET_KEY="..." -e GCP_KEY_JSON="..." summary-backend
```

**Twin Backend** → deployed as Cloud Function (see `twin-backend/`)
