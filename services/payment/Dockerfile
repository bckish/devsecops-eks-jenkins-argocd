FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod main.go main_test.go ./
RUN go test ./... && CGO_ENABLED=0 go build -trimpath -o /app .
FROM scratch
COPY --from=build /app /app
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/app"]
