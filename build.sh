#!/usr/bin/env bash

echo installing yarn

# install yarn
sudo npm install yarn -g

echo link

# make sure it's in path
sudo ln -s "$(npm bin --global)"/yarn /usr/bin/yarn

echo try to build

# build it
sudo yarn build