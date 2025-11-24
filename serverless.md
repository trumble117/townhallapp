# Serverless Deployment Guide for Town Hall App

This guide provides step-by-step instructions for deploying the Town Hall Question Display app to various serverless platforms using Docker.

## Docker Commands

### Build and Run Locally

```bash
# Build and run with Docker Compose
docker-compose up --build -d

# View running containers
docker-compose ps

# View logs
docker-compose logs -f townhall-app

# Stop the application
docker-compose down

# Rebuild after changes
docker-compose up --build --force-recreate -d
```

### Manual Docker Commands

```bash
# Build the image
docker build -t townhall-app .

# Run the container
docker run -d -p 8080:80 --name townhall-app townhall-app

# View logs
docker logs -f townhall-app

# Stop and remove
docker stop townhall-app
docker rm townhall-app
```

## Serverless Deployment

### AWS Fargate

1. **Build and push to ECR:**
```bash
# Authenticate Docker with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t townhall-app .
docker tag townhall-app:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/townhall-app:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/townhall-app:latest
```

2. **Create ECS Cluster:**
```bash
aws ecs create-cluster --cluster-name townhall-cluster
```

3. **Create Task Definition (save as task-definition.json):**
```json
{
  "family": "townhall-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "townhall-app",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/townhall-app:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

4. **Register Task Definition:**
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

5. **Create Service:**
```bash
aws ecs create-service \
  --cluster townhall-cluster \
  --service-name townhall-service \
  --task-definition townhall-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345]}"
```

### Google Cloud Run

1. **Build and push to GCR:**
```bash
# Build and tag
docker build -t gcr.io/YOUR_PROJECT/townhall-app .
docker push gcr.io/YOUR_PROJECT/townhall-app
```

2. **Deploy to Cloud Run:**
```bash
gcloud run deploy townhall-app \
  --image gcr.io/YOUR_PROJECT/townhall-app \
  --platform managed \
  --port 80 \
  --allow-unauthenticated \
  --region us-central1
```

### Azure Container Instances

1. **Build and push to ACR:**
```bash
# Login to ACR
az acr login --name yourregistry

# Build and tag
docker build -t yourregistry.azurecr.io/townhall-app:latest .
docker push yourregistry.azurecr.io/townhall-app:latest
```

2. **Create Container Instance:**
```bash
az container create \
  --resource-group myResourceGroup \
  --name townhall-app \
  --image yourregistry.azurecr.io/townhall-app:latest \
  --ports 80 \
  --dns-name-label townhall-app \
  --cpu 1 \
  --memory 1.5 \
  --registry-login-server yourregistry.azurecr.io \
  --registry-username yourregistry \
  --registry-password $(az acr credential show --name yourregistry --query passwords[0].value -o tsv)
```

## Environment Variables

The app does not require environment variables as configuration is handled client-side. However, you can set:

- `NGINX_PORT=80` (default)

## Scaling

- **AWS Fargate:** Update desired count in ECS service
- **Google Cloud Run:** Use `gcloud run services update` with `--concurrency` and `--max-instances`
- **Azure ACI:** Create multiple instances or use Azure Container Apps

## Monitoring

- **AWS:** Use CloudWatch for logs and metrics
- **Google:** Use Cloud Logging and Cloud Monitoring
- **Azure:** Use Azure Monitor and Log Analytics

## Cost Optimization

- Use spot instances where available
- Set appropriate CPU/memory limits
- Configure auto-scaling based on traffic
- Use reserved instances for predictable workloads
