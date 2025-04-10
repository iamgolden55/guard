#!/bin/bash

# Build the project
npm run build

# Create a deployment directory if it doesn't exist
mkdir -p ../deploy

# Navigate to the dist directory
cd dist

# Create a zip file of all contents
echo "Creating zip file for deployment..."
zip -rFS ../../deploy/output.zip .

echo "Deployment package created at ../deploy/output.zip"
