#!/bin/sh
# Wait for port 5000 to be free, killing any stale process holding it
MAX_ATTEMPTS=10
ATTEMPT=0
while fuser 5000/tcp > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "Could not free port 5000 after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    echo "Port 5000 in use, killing stale process (attempt $ATTEMPT)..."
    fuser -k 5000/tcp > /dev/null 2>&1
    sleep 2
done

echo "Port 5000 is free, starting server..."
exec node "server zamin.js"
