#!/bin/sh
# Kill any stale process on port 5000
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

# Run node in background so this shell can trap signals and kill node cleanly
node "server zamin.js" &
NODE_PID=$!

# Forward SIGTERM and SIGINT to node so it shuts down cleanly
trap "kill $NODE_PID 2>/dev/null; exit 0" TERM INT

# Wait for node to exit
wait $NODE_PID
