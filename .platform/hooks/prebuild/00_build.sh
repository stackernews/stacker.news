#!/usr/bin/env bash

echo installing yarn
sudo npm install yarn -g

echo link yarn
sudo ln -s "$(npm bin --global)"/yarn /usr/bin/yarn

echo install
yarn install

echo gen primsa client
prisma generate

echo build
yarn build