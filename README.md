# AI Summary Maker

## AWS Deployment

This repository uses:
- `frontend/` as the Next.js frontend service
- `backend/` as the main summary API service
- `twin-backend/` as the chatbot service deployed to AWS Lambda

> Note: the project uses AWS ECS Express mode for the backend and Lambda for the chatbot. Do not use App Runner commands here.

### Frontend on AWS

1. Build the frontend image:
```powershell
cd frontend
docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" --build-arg NEXT_PUBLIC_TWIN_API_URL="$env:NEXT_PUBLIC_TWIN_API_URL" -t bookify-frontend .
```
2. Push to ECR:
```powershell
aws ecr create-repository --repository-name bookify-frontend --region us-east-1
$accountId = (aws sts get-caller-identity --query Account --output text)
$repoUri = "$accountId.dkr.ecr.us-east-1.amazonaws.com/bookify-frontend"
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $repoUri
docker tag bookify-frontend $repoUri:latest
docker push $repoUri:latest
```
3. Update ECS service in Express mode:
```powershell
aws ecs update-service --cluster bookify-cluster --service bookify-frontend --force-new-deployment --region us-east-1
```

> If you did not create the ECS service yet, create it once using the AWS Console or ECS Express mode. Then use `update-service` for each new deployment.

### Backend on AWS ECS

1. Build the backend image:
```powershell
cd backend
docker build -t bookify-backend .
```
2. Push to ECR:
```powershell
aws ecr create-repository --repository-name bookify-backend --region us-east-1
$accountId = (aws sts get-caller-identity --query Account --output text)
$repoUri = "$accountId.dkr.ecr.us-east-1.amazonaws.com/bookify-backend"
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $repoUri
docker tag bookify-backend $repoUri:latest
docker push $repoUri:latest
```
3. Redeploy the ECS service:
```powershell
aws ecs update-service --cluster bookify-cluster --service bookify-backend --force-new-deployment --region us-east-1
```

> Backend environment variables must include `CLERK_SECRET_KEY` and `GCP_KEY_JSON` if required by your deployment.

### Chatbot on AWS Lambda

1. Create the Lambda deployment package using the repo script:
```powershell
cd twin-backend
python deploy.py
```
2. Upload the package to S3:
```powershell
$bucketName = "bookify-twin-lambda-$accountId"
aws s3 mb s3://$bucketName --region us-east-1
aws s3 cp lambda-deployment.zip s3://$bucketName/
```
3. Update the Lambda function code:
```powershell
aws lambda update-function-code --function-name bookify-twin --s3-bucket $bucketName --s3-key lambda-deployment.zip --region us-east-1
```

> If the Lambda function does not exist yet, create it once in the AWS Console or CLI, then update the code with the above command.

---

## Docker Deployment

These commands are for building and running the services as Docker containers locally.

### Frontend Docker

```powershell
cd frontend
docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" --build-arg NEXT_PUBLIC_TWIN_API_URL="$env:NEXT_PUBLIC_TWIN_API_URL" -t bookify-frontend .
docker run -p 80:80 bookify-frontend
```

### Backend Docker

```powershell
cd backend
docker build -t bookify-backend .
docker run -p 8000:8000 -e CLERK_SECRET_KEY="..." -e GCP_KEY_JSON="..." bookify-backend
```

### Chatbot Packaging

The chatbot service does not have a Docker runtime image in this repo. Use the packaging script to build the Lambda archive instead:
```powershell
cd twin-backend
python deploy.py
```

---

## Local Development

Run the services locally without Docker.

### Frontend Local

```powershell
cd frontend
npm install
npm run dev
```

### Backend Local

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Chatbot Local

```powershell
cd twin-backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

---

## Notes

- The frontend can be deployed as a container image or served as a static build depending on your AWS setup.
- The backend is deployed to AWS ECS in Express mode, not App Runner.
- The chatbot is deployed to AWS Lambda as a serverless function.
- Use AWS CLI commands only after you have created the required ECR repositories and ECS services once.
