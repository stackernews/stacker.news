#!/bin/bash

pip3 install --upgrade virtualenv awscli awscli-local requests
awslocal s3 mb s3://uploads
awslocal s3api put-bucket-cors --bucket uploads --cors-configuration file:///etc/localstack/init/ready.d/cors.json
echo "Localstack S3 bucket 'uploads' created and CORS configuration added"