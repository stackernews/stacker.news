#!/usr/bin/env bash

echo primsa migrate
npm run migrate

echo build with npm
npm run build

# echo installing yarn
# sudo npm install yarn -g

# echo link yarn $(npm bin --global) $(sudo npm bin --global)
# sudo ln -fs "$(npm bin --global)"/yarn /usr/bin/yarn

# echo install
# yarn install

# echo gen primsa client
# prisma generate

# echo build
# yarn build