#!/usr/bin/env bash

echo primsa migrate
npm run migrate

echo build with npm
sudo -u webapp npm run build