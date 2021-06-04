#!/usr/bin/env bash

# install yarn
sudo npm install yarn -g

# make sure it's in path
ln -s "$(npm bin --global)"/yarn /usr/bin/yarn

# build it
yarn build