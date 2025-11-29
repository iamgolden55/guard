#!/bin/bash
echo "Clearing Metro bundler cache..."
rm -rf node_modules/.cache
npx expo start --clear
