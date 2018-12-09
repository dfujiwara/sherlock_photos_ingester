#!/usr/bin/env bash

cd $(dirname "$0")
GOOGLE_APPLICATION_CREDENTIALS=./keys.json node ./index.js
