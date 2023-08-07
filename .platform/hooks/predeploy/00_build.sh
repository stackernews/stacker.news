#!/usr/bin/env bash

echo primsa migrate
npm run migrate

echo build with npm
sudo -E -u webapp npm run build