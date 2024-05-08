# Use the official Golang image to create a build artifact.
# This is based on Debian and includes the Go development environment.
FROM golang:1.22 as builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Clone the our fork of lnproxy repository
RUN git clone https://github.com/huumn/lnproxy-relay.git .

# Change to the directory containing the main package
WORKDIR /app/cmd/http-relay

# Build the binary
RUN CGO_ENABLED=0 go build -o http-relay .

# Use a Docker multi-stage build to minimize the size of the final container
# Start from a fresh minimal base image to create a final image
FROM alpine:latest

# Install ca-certificates in case the application makes external HTTPS requests
RUN apk --no-cache add ca-certificates

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/cmd/http-relay/http-relay /usr/bin/lnproxy

EXPOSE 4747

# # Command to run the executable
CMD ["lnproxy"]